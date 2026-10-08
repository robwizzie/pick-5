// src/services/seasonService.ts
import { connectDB } from '@/lib/db';
import { SeasonConfig } from '@/models/SeasonConfig';
import { SeasonHistory } from '@/models/SeasonHistory';
import { League } from '@/models/League';
import { NFLService } from './nflService';
import { clearSeasonWeeksCache, ensurePickSeasonMigration, getCurrentSeasonYear, getSeasonFinalWeek, getSeasonWeeks } from '@/lib/season';
import { REGULAR_SEASON_WEEKS, resolveSeasonWeeks } from '@/lib/seasonYear';
import { loadLeagueSeason } from '@/lib/leagueSeason';

export interface ArchivePreview {
	leagueId: string;
	leagueName: string;
	players: number;
	weeksPlayed: number;
	champions: string[];
	podium: Array<{ rank: number; name: string; points: number }>;
}

export interface SeasonStatus {
	isActive: boolean;
	seasonYear: number;
	currentWeek: number;
	/** The first week that counts this season */
	startWeek: number;
	/** The last week that counts this season (picks close after it) */
	finalWeek: number;
	lastCompletedWeek: number;
	isArchived: boolean;
	canSubmitPicks: boolean;
	canSendNotifications: boolean; // For cron jobs - allows the final week's notifications even after ESPN moves on a week
	message?: string;
}

interface WeeklyStat {
	week: number;
	points: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

interface PlayerWeeks {
	userId: string;
	userName: string;
	userImage: string | null;
	weeklyStats: WeeklyStat[];
}

/**
 * Final standings, champions and season stats from each player's weekly results.
 * Ranks use competition ranking (ties share a rank: 1, 1, 3); a week is "won" by everyone
 * tied for that week's top score (when it's above 0).
 */
function buildStandings(players: PlayerWeeks[]) {
	const weeks = Array.from(new Set(players.flatMap(p => p.weeklyStats.map(w => w.week)))).sort((a, b) => a - b);
	const topByWeek = new Map(weeks.map(week => [week, Math.max(0, ...players.flatMap(p => p.weeklyStats.filter(w => w.week === week).map(w => w.points)))]));

	let highestWeeklyScore: { userId: string; userName: string; week: number; points: number } | null = null;
	for (const week of weeks) {
		for (const p of players) {
			const w = p.weeklyStats.find(s => s.week === week);
			if (w && (!highestWeeklyScore || w.points > highestWeeklyScore.points)) {
				highestWeeklyScore = { userId: p.userId, userName: p.userName, week, points: w.points };
			}
		}
	}

	const totals = players.map(p => {
		const weeklyStats = [...p.weeklyStats].sort((a, b) => a.week - b.week);
		const sum = (key: keyof Omit<WeeklyStat, 'week'>) => weeklyStats.reduce((acc, w) => acc + (w[key] || 0), 0);
		const totalPicks = sum('totalPicks');
		const correctPicks = sum('correctPicks');
		return {
			userId: p.userId,
			userName: p.userName,
			userImage: p.userImage,
			totalPoints: sum('points'),
			correctPicks,
			totalPicks,
			tfsPoints: sum('tfsPoints'),
			weeksWon: weeklyStats.filter(w => (topByWeek.get(w.week) ?? 0) > 0 && w.points === topByWeek.get(w.week)).length,
			winPercentage: totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
			weeklyStats
		};
	});

	const sorted = [...totals].sort((a, b) => b.totalPoints - a.totalPoints);
	const standings = sorted.map(p => ({ ...p, rank: sorted.findIndex(q => q.totalPoints === p.totalPoints) + 1 }));
	const top = standings[0]?.totalPoints ?? 0;
	const champions = standings.filter(s => s.totalPoints === top).map(s => ({ userId: s.userId, userName: s.userName, totalPoints: s.totalPoints }));
	const totalPicksMade = standings.reduce((sum, s) => sum + s.totalPicks, 0);

	return { standings, champions, weeksPlayed: weeks.length, totalPicksMade, highestWeeklyScore };
}

type HistoryRecord = {
	leagueId: string;
	seasonYear: number;
	standings?: Array<PlayerWeeks & Record<string, unknown>>;
	champions?: unknown[];
	seasonStats?: Record<string, unknown>;
};

/**
 * Seasons archived before their start/final weeks were set can include weeks that don't count (e.g.
 * week 18 of 2025). Rebuild those records from the stored weekly breakdown and save the corrected version.
 */
async function withoutUncountedWeeks<T extends HistoryRecord>(record: T): Promise<T> {
	const { startWeek, finalWeek } = await getSeasonWeeks(record.seasonYear);
	const counts = (week: number) => week >= startWeek && week <= finalWeek;
	const standings = record.standings ?? [];
	if (standings.every(p => (p.weeklyStats ?? []).every(w => counts(w.week)))) return record;

	const players = standings
		.map(p => ({ userId: p.userId, userName: p.userName, userImage: p.userImage ?? null, weeklyStats: (p.weeklyStats ?? []).filter(w => counts(w.week)) }))
		.filter(p => p.weeklyStats.length > 0);
	const rebuilt = buildStandings(players);
	const seasonStats: Record<string, unknown> = {
		...(record.seasonStats ?? {}),
		totalWeeksPlayed: rebuilt.weeksPlayed,
		totalGamesPlayed: rebuilt.totalPicksMade,
		totalPicksMade: rebuilt.totalPicksMade,
		highestWeeklyScore: rebuilt.highestWeeklyScore ?? undefined
	};
	// A biggest upset from a week that no longer counts doesn't belong in the record
	const upset = seasonStats.biggestUpset as { week?: number } | undefined;
	if (upset?.week && !counts(upset.week)) delete seasonStats.biggestUpset;

	const update = { standings: rebuilt.standings, champions: rebuilt.champions, seasonStats };
	try {
		await SeasonHistory.updateOne({ leagueId: record.leagueId, seasonYear: record.seasonYear }, { $set: update });
	} catch (error) {
		// Still serve the corrected standings; the next read retries the save
		console.error(`[SeasonService] Failed to save corrected ${record.seasonYear} history for league ${record.leagueId}:`, error);
	}
	return { ...record, ...update };
}

export class SeasonService {
	/**
	 * Get the current NFL season year
	 */
	static getCurrentSeasonYear(): number {
		return getCurrentSeasonYear();
	}

	/**
	 * Get or create the season config for a season (default: the current season)
	 */
	static async getOrCreateSeasonConfig(seasonYear: number = getCurrentSeasonYear()): Promise<typeof SeasonConfig.prototype> {
		await connectDB();

		let config = await SeasonConfig.findOne({ seasonYear });

		if (!config) {
			// Create new season config
			// A config created for a past season (e.g. to archive it) is already over.
			const isPastSeason = seasonYear < getCurrentSeasonYear();
			config = await SeasonConfig.create({
				seasonYear,
				isActive: !isPastSeason,
				lastCompletedWeek: isPastSeason ? await getSeasonFinalWeek(seasonYear) : 0,
				isArchived: false
			});
		}

		return config;
	}

	/**
	 * Get the current season status
	 */
	static async getSeasonStatus(): Promise<SeasonStatus> {
		const config = await this.getOrCreateSeasonConfig();
		const currentWeek = await NFLService.getCurrentWeek(false);
		const { startWeek, finalWeek } = resolveSeasonWeeks(config.seasonYear, config);

		// Use the raw (uncapped) week number to detect if we're past the regular season.
		// calculateCurrentWeek() caps at 18, which makes it impossible to detect the off-season.
		// The raw week number continues past 18 (e.g., week 30 in April) so we can tell
		// the regular season is truly over and stop all notifications/scoring.
		const rawWeek = NFLService.calculateRawWeekNumber();
		const isPastRegularSeason = rawWeek > REGULAR_SEASON_WEEKS + 1;

		// Season is not active if:
		// 1. isActive is false in config
		// 2. Current week is past this season's final week
		// 3. We're well past the regular season window
		const isSeasonActive = config.isActive && currentWeek <= finalWeek && !isPastRegularSeason;

		// Can submit picks if season is active
		const canSubmitPicks = isSeasonActive;

		// Can send notifications if:
		// 1. Config isActive is true (admin hasn't manually deactivated)
		// 2. Current week is at most one past the final week (ESPN can move on before the
		//    Tuesday cron sends the final week's scoring emails)
		// 3. We're NOT past the regular season window
		const canSendNotifications = config.isActive && currentWeek <= finalWeek + 1 && !isPastRegularSeason;

		let message: string | undefined;
		if (!isSeasonActive) {
			if (isPastRegularSeason || currentWeek > finalWeek) {
				message = `The Pick 5 season ended after week ${finalWeek}. Pick 5 will return next season!`;
			} else if (!config.isActive) {
				message = 'Pick 5 is currently on break between seasons.';
			}
		}

		return {
			isActive: isSeasonActive,
			seasonYear: config.seasonYear,
			currentWeek,
			startWeek,
			finalWeek,
			lastCompletedWeek: config.lastCompletedWeek,
			isArchived: config.isArchived,
			canSubmitPicks,
			canSendNotifications,
			message
		};
	}

	/**
	 * Set the first and last weeks that count in a season (1-18, start <= final). Weeks outside the
	 * range stop counting toward standings, stats and badges right away; archived history needs a
	 * re-archive (with "Replace existing") to pick up weeks that were added back.
	 */
	static async setSeasonWeeks(seasonYear: number, { startWeek, finalWeek }: { startWeek: number; finalWeek: number }): Promise<{ startWeek: number; finalWeek: number }> {
		const valid = (week: number) => Number.isInteger(week) && week >= 1 && week <= REGULAR_SEASON_WEEKS;
		if (!valid(startWeek) || !valid(finalWeek)) throw new Error(`Weeks must be whole numbers from 1 to ${REGULAR_SEASON_WEEKS}`);
		if (startWeek > finalWeek) throw new Error('The start week must be on or before the final week');

		const config = await this.getOrCreateSeasonConfig(seasonYear);
		config.startWeek = startWeek;
		config.finalWeek = finalWeek;
		await config.save();
		clearSeasonWeeksCache(seasonYear);
		return { startWeek, finalWeek };
	}

	/**
	 * Deactivate the current season (called when its final week completes)
	 */
	static async deactivateSeason(): Promise<void> {
		await connectDB();

		const config = await this.getOrCreateSeasonConfig();
		config.isActive = false;
		config.deactivatedAt = new Date();
		config.lastCompletedWeek = resolveSeasonWeeks(config.seasonYear, config).finalWeek;
		await config.save();

		console.log(`[SeasonService] Deactivated season ${config.seasonYear}`);
	}

	/**
	 * Archive (or preview) a season's final standings into League History.
	 * - dryRun: compute and return previews without writing anything
	 * - replace: rebuild leagues that already have history for this season
	 * Leagues with no picks that season are skipped (no empty "everyone tied at 0" history).
	 */
	static async archiveSeason(
		seasonYear: number = getCurrentSeasonYear(),
		{ dryRun = false, replace = false }: { dryRun?: boolean; replace?: boolean } = {}
	): Promise<{ success: boolean; leaguesArchived: number; skipped: number; previews: ArchivePreview[]; errors: string[] }> {
		await connectDB();
		// Picks must be season-tagged before they can be attributed to a season
		await ensurePickSeasonMigration();

		const config = await this.getOrCreateSeasonConfig(seasonYear);
		if (config.isArchived && !dryRun && !replace) {
			return { success: false, leaguesArchived: 0, skipped: 0, previews: [], errors: ['Season already archived. Use "Replace existing" to rebuild it.'] };
		}

		const leagues = await League.find({}, '_id name').lean<Array<{ _id: unknown; name: string }>>();
		const errors: string[] = [];
		const previews: ArchivePreview[] = [];
		let leaguesArchived = 0;
		let skipped = 0;

		// Archive sequentially. Each league can fan out to as many as 18 ESPN requests;
		// doing several leagues concurrently is unnecessarily bursty on Workers and can make
		// a historical archive fail part-way through due to subrequest/runtime limits.
		for (const league of leagues) {
			const leagueId = String(league._id);
			try {
				const outcome = await this.archiveLeagueSeason(leagueId, seasonYear, { dryRun, replace });
				if (outcome.preview) previews.push(outcome.preview);
				if (outcome.status === 'archived') leaguesArchived++;
				else skipped++;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Failed to archive league ${league.name}: ${message}`);
				console.error(`[SeasonService] Error archiving league ${league.name}:`, error);
			}
		}
		previews.sort((a, b) => a.leagueName.localeCompare(b.leagueName));

		if (!dryRun && leaguesArchived > 0) {
			config.isArchived = true;
			config.archivedAt = new Date();
			await config.save();
		}
		return { success: dryRun ? errors.length === 0 : leaguesArchived > 0 || (skipped > 0 && errors.length === 0), leaguesArchived, skipped, previews, errors };
	}

	/**
	 * Build one league's final standings for a season from live-scored picks, and save them to
	 * SeasonHistory unless dryRun. Only players who made picks that season are included.
	 */
	static async archiveLeagueSeason(
		leagueId: string,
		seasonYear: number,
		{ dryRun = false, replace = false }: { dryRun?: boolean; replace?: boolean } = {}
	): Promise<{ status: 'archived' | 'previewed' | 'skipped_existing' | 'skipped_empty'; preview?: ArchivePreview }> {
		await connectDB();

		if (!replace && !dryRun && (await SeasonHistory.exists({ leagueId, seasonYear }))) {
			return { status: 'skipped_existing' };
		}

		const season = await loadLeagueSeason(leagueId, seasonYear);
		if (!season) throw new Error('League not found');

		// Only the weeks that count this season (its start week through its final week)
		const { startWeek, finalWeek } = await getSeasonWeeks(seasonYear);
		const regularWeeks = Array.from(season.weeks.keys()).filter(w => w >= startWeek && w <= finalWeek);
		if (regularWeeks.length === 0) return { status: 'skipped_empty' };

		// Each player's weekly results
		const byPlayer = new Map<string, PlayerWeeks>();
		for (const week of regularWeeks.sort((a, b) => a - b)) {
			season.weeks.get(week)!.forEach((w, userId) => {
				const member = season.members.find(m => m.userId === userId);
				const player = byPlayer.get(userId) ?? { userId, userName: member?.name || 'Unknown', userImage: member?.image ?? null, weeklyStats: [] };
				player.weeklyStats.push({ week, points: w.weeklyPoints, correctPicks: w.correctPicks, totalPicks: w.completedGames, tfsPoints: w.tfsPoints });
				byPlayer.set(userId, player);
			});
		}
		const { standings, champions, totalPicksMade, highestWeeklyScore } = buildStandings(Array.from(byPlayer.values()));

		const preview: ArchivePreview = {
			leagueId,
			leagueName: season.leagueName,
			players: standings.length,
			weeksPlayed: regularWeeks.length,
			champions: champions.map(c => c.userName),
			podium: standings.slice(0, 3).map(s => ({ rank: s.rank, name: s.userName, points: s.totalPoints }))
		};
		if (dryRun) return { status: 'previewed', preview };

		const record = {
			leagueId,
			leagueName: season.leagueName,
			leagueMode: season.mode,
			seasonYear,
			standings,
			champions,
			seasonStats: {
				totalWeeksPlayed: regularWeeks.length,
				totalGamesPlayed: totalPicksMade,
				totalPicksMade,
				highestWeeklyScore: highestWeeklyScore ?? undefined
			},
			archivedAt: new Date()
		};
		await SeasonHistory.findOneAndUpdate({ leagueId, seasonYear }, record, { upsert: true });
		return { status: 'archived', preview };
	}

	/**
	 * Start a new season (reset standings, activate season)
	 */
	static async startNewSeason(): Promise<{ success: boolean; message: string }> {
		await connectDB();

		// Make sure picks are season-scoped (and the legacy per-week unique index is gone)
		// before the new season's picks start coming in.
		await ensurePickSeasonMigration();

		const newSeasonYear = this.getCurrentSeasonYear();

		// Check if there's already a config for this year
		const existingConfig = await SeasonConfig.findOne({ seasonYear: newSeasonYear });
		if (existingConfig && existingConfig.isActive) {
			return { success: false, message: `Season ${newSeasonYear} is already active` };
		}

		// Create or update the season config
		if (existingConfig) {
			existingConfig.isActive = true;
			existingConfig.lastCompletedWeek = 0;
			existingConfig.isArchived = false;
			existingConfig.deactivatedAt = null;
			existingConfig.archivedAt = null;
			await existingConfig.save();
		} else {
			await SeasonConfig.create({
				seasonYear: newSeasonYear,
				isActive: true,
				lastCompletedWeek: 0,
				isArchived: false
			});
		}

		// Picks are not deleted: they're preserved for history and scoped by `season`.

		return { success: true, message: `Season ${newSeasonYear} is now active` };
	}

	/**
	 * Get the league history for a specific league
	 */
	static async getLeagueHistory(leagueId: string): Promise<typeof SeasonHistory.prototype[]> {
		await connectDB();

		const history = await SeasonHistory.find({ leagueId })
			.sort({ seasonYear: -1 })
			.lean<HistoryRecord[]>();

		return Promise.all(history.map(withoutUncountedWeeks));
	}

	/**
	 * Get a specific season's history for a league
	 */
	static async getLeagueSeasonHistory(leagueId: string, seasonYear: number): Promise<typeof SeasonHistory.prototype | null> {
		await connectDB();

		const history = await SeasonHistory.findOne({ leagueId, seasonYear }).lean<HistoryRecord>();
		return history ? withoutUncountedWeeks(history) : null;
	}
}
