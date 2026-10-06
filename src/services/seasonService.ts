// src/services/seasonService.ts
import { connectDB } from '@/lib/db';
import { SeasonConfig } from '@/models/SeasonConfig';
import { SeasonHistory } from '@/models/SeasonHistory';
import { League } from '@/models/League';
import { NFLService } from './nflService';
import { ensurePickSeasonMigration, getCurrentSeasonYear } from '@/lib/season';
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
	lastCompletedWeek: number;
	isArchived: boolean;
	canSubmitPicks: boolean;
	canSendNotifications: boolean; // For cron jobs - allows week 18 notifications even if ESPN shows week 19
	message?: string;
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
				lastCompletedWeek: isPastSeason ? 18 : 0,
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

		// Use the raw (uncapped) week number to detect if we're past the regular season.
		// calculateCurrentWeek() caps at 18, which makes it impossible to detect the off-season.
		// The raw week number continues past 18 (e.g., week 30 in April) so we can tell
		// the regular season is truly over and stop all notifications/scoring.
		const rawWeek = NFLService.calculateRawWeekNumber();
		const isPastRegularSeason = rawWeek > 19;

		// Season is not active if:
		// 1. isActive is false in config
		// 2. Current week is > 18 (after the regular season)
		// 3. We're well past the regular season window (raw week > 19)
		const isSeasonActive = config.isActive && currentWeek <= 18 && !isPastRegularSeason;

		// Can submit picks if season is active
		const canSubmitPicks = isSeasonActive;

		// Can send notifications if:
		// 1. Config isActive is true (admin hasn't manually deactivated)
		// 2. Current week is <= 19 (allows week 18 scoring emails even if ESPN reports week 19/playoffs)
		// 3. We're NOT past the regular season window (raw week <= 19)
		// This handles the case where ESPN shows week 19 before Tuesday cron runs after week 18 MNF,
		// but prevents notifications from continuing indefinitely in the off-season.
		const canSendNotifications = config.isActive && currentWeek <= 19 && !isPastRegularSeason;

		let message: string | undefined;
		if (!isSeasonActive) {
			if (isPastRegularSeason || currentWeek > 18) {
				message = 'The NFL regular season has ended. Pick 5 will return next season!';
			} else if (!config.isActive) {
				message = 'Pick 5 is currently on break between seasons.';
			}
		}

		return {
			isActive: isSeasonActive,
			seasonYear: config.seasonYear,
			currentWeek,
			lastCompletedWeek: config.lastCompletedWeek,
			isArchived: config.isArchived,
			canSubmitPicks,
			canSendNotifications,
			message
		};
	}

	/**
	 * Deactivate the current season (called when week 18 completes)
	 */
	static async deactivateSeason(): Promise<void> {
		await connectDB();

		const config = await this.getOrCreateSeasonConfig();
		config.isActive = false;
		config.deactivatedAt = new Date();
		config.lastCompletedWeek = 18;
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

		// A few leagues at a time: each one fans out to up to 18 ESPN requests
		for (let i = 0; i < leagues.length; i += 4) {
			await Promise.all(
				leagues.slice(i, i + 4).map(async league => {
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
				})
			);
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

		const regularWeeks = Array.from(season.weeks.keys()).filter(w => w >= 1 && w <= 18).sort((a, b) => a - b);
		if (regularWeeks.length === 0) return { status: 'skipped_empty' };

		// Per-player totals
		const players = new Map<string, { totalPoints: number; correctPicks: number; totalPicks: number; tfsPoints: number; weeksWon: number; weeklyStats: Array<{ week: number; points: number; correctPicks: number; totalPicks: number; tfsPoints: number }> }>();
		let highestWeeklyScore: { userId: string; userName: string; week: number; points: number } | null = null;
		const nameOf = (id: string) => season.members.find(m => m.userId === id)?.name || 'Unknown';

		for (const week of regularWeeks) {
			const byUser = season.weeks.get(week)!;
			let max = 0;
			byUser.forEach(w => (max = Math.max(max, w.weeklyPoints)));
			byUser.forEach((w, userId) => {
				const p = players.get(userId) ?? { totalPoints: 0, correctPicks: 0, totalPicks: 0, tfsPoints: 0, weeksWon: 0, weeklyStats: [] };
				p.totalPoints += w.weeklyPoints;
				p.correctPicks += w.correctPicks;
				p.totalPicks += w.completedGames;
				p.tfsPoints += w.tfsPoints;
				if (max > 0 && w.weeklyPoints === max) p.weeksWon++;
				p.weeklyStats.push({ week, points: w.weeklyPoints, correctPicks: w.correctPicks, totalPicks: w.completedGames, tfsPoints: w.tfsPoints });
				players.set(userId, p);
				if (!highestWeeklyScore || w.weeklyPoints > highestWeeklyScore.points) {
					highestWeeklyScore = { userId, userName: nameOf(userId), week, points: w.weeklyPoints };
				}
			});
		}

		// Competition ranking: ties share a rank (1, 1, 3)
		const sorted = Array.from(players.entries()).sort((a, b) => b[1].totalPoints - a[1].totalPoints);
		const standings = sorted.map(([userId, p], i) => {
			const member = season.members.find(m => m.userId === userId);
			const rank = sorted.findIndex(([, q]) => q.totalPoints === p.totalPoints) + 1;
			return {
				userId,
				userName: member?.name || 'Unknown',
				userImage: member?.image ?? null,
				rank: rank || i + 1,
				totalPoints: p.totalPoints,
				correctPicks: p.correctPicks,
				totalPicks: p.totalPicks,
				tfsPoints: p.tfsPoints,
				weeksWon: p.weeksWon,
				winPercentage: p.totalPicks > 0 ? Math.round((p.correctPicks / p.totalPicks) * 100) : 0,
				weeklyStats: p.weeklyStats
			};
		});
		const top = standings[0]?.totalPoints ?? 0;
		const champions = standings.filter(s => s.totalPoints === top).map(s => ({ userId: s.userId, userName: s.userName, totalPoints: s.totalPoints }));
		const totalPicksMade = standings.reduce((sum, s) => sum + s.totalPicks, 0);

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
			.lean();

		return history;
	}

	/**
	 * Get a specific season's history for a league
	 */
	static async getLeagueSeasonHistory(leagueId: string, seasonYear: number): Promise<typeof SeasonHistory.prototype | null> {
		await connectDB();

		const history = await SeasonHistory.findOne({ leagueId, seasonYear }).lean();
		return history;
	}
}
