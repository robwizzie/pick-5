// src/services/seasonService.ts
import { connectDB } from '@/lib/db';
import { SeasonConfig } from '@/models/SeasonConfig';
import { SeasonHistory } from '@/models/SeasonHistory';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { NFLService } from './nflService';
import { ScoringService } from './scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export interface SeasonStatus {
	isActive: boolean;
	seasonYear: number;
	currentWeek: number;
	lastCompletedWeek: number;
	isArchived: boolean;
	canSubmitPicks: boolean;
	message?: string;
}

export class SeasonService {
	/**
	 * Get the current NFL season year
	 */
	static getCurrentSeasonYear(): number {
		const now = new Date();
		const year = now.getFullYear();
		// NFL season starts in September; before Sep -> use previous year
		return now.getMonth() < 8 ? year - 1 : year;
	}

	/**
	 * Get or create the season config for the current season
	 */
	static async getOrCreateSeasonConfig(): Promise<typeof SeasonConfig.prototype> {
		await connectDB();

		const seasonYear = this.getCurrentSeasonYear();
		let config = await SeasonConfig.findOne({ seasonYear });

		if (!config) {
			// Create new season config
			config = await SeasonConfig.create({
				seasonYear,
				isActive: true,
				lastCompletedWeek: 0,
				isArchived: false
			});
			console.log(`[SeasonService] Created new season config for ${seasonYear}`);
		}

		return config;
	}

	/**
	 * Get the current season status
	 */
	static async getSeasonStatus(): Promise<SeasonStatus> {
		const config = await this.getOrCreateSeasonConfig();
		const currentWeek = await NFLService.getCurrentWeek(false);

		// Season is not active if:
		// 1. isActive is false in config
		// 2. Current week is > 18 (after the regular season)
		// 3. The season has been archived and we're past week 18
		const isSeasonActive = config.isActive && currentWeek <= 18;

		// Can submit picks if:
		// 1. Season is active
		// 2. Current week <= 18
		const canSubmitPicks = isSeasonActive && currentWeek <= 18;

		let message: string | undefined;
		if (!isSeasonActive) {
			if (currentWeek > 18) {
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
			message
		};
	}

	/**
	 * Check if the season is active (for cron jobs and pick submission)
	 */
	static async isSeasonActive(): Promise<boolean> {
		const status = await this.getSeasonStatus();
		return status.isActive;
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
	 * Archive the season standings for all leagues
	 * This saves the final standings to SeasonHistory
	 */
	static async archiveSeason(): Promise<{ success: boolean; leaguesArchived: number; errors: string[] }> {
		await connectDB();

		const config = await this.getOrCreateSeasonConfig();

		if (config.isArchived) {
			return { success: false, leaguesArchived: 0, errors: ['Season already archived'] };
		}

		const leagues = await League.find({});
		let leaguesArchived = 0;
		const errors: string[] = [];

		for (const league of leagues) {
			try {
				await this.archiveLeagueSeason(league._id.toString(), config.seasonYear);
				leaguesArchived++;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Failed to archive league ${league.name}: ${errorMsg}`);
				console.error(`[SeasonService] Error archiving league ${league.name}:`, error);
			}
		}

		// Mark season as archived
		config.isArchived = true;
		config.archivedAt = new Date();
		await config.save();

		console.log(`[SeasonService] Archived ${leaguesArchived} leagues for season ${config.seasonYear}`);

		return { success: true, leaguesArchived, errors };
	}

	/**
	 * Archive a single league's season standings
	 */
	static async archiveLeagueSeason(leagueId: string, seasonYear: number): Promise<void> {
		await connectDB();

		const league = await League.findById(leagueId);
		if (!league) {
			throw new Error('League not found');
		}

		// Check if already archived
		const existingHistory = await SeasonHistory.findOne({ leagueId, seasonYear });
		if (existingHistory) {
			console.log(`[SeasonService] League ${league.name} already archived for season ${seasonYear}`);
			return;
		}

		// Get all members
		const memberIds = league.members;

		// Calculate final standings
		const standings = [];
		const weeklyWinners: Map<number, { userId: string; points: number }[]> = new Map();

		// Cache game results for all weeks
		const gameResultsCache: Map<number, Array<{
			id: string;
			homeScore: number;
			awayScore: number;
			homeTeam: string;
			awayTeam: string;
			status: string;
		}>> = new Map();

		// Pre-fetch all game results
		for (let week = 1; week <= 18; week++) {
			try {
				const games = await NFLService.getWeeklyGames(week, seasonYear);
				const results = games.map(g => ({
					id: g.id,
					homeScore: g.home.score || 0,
					awayScore: g.away.score || 0,
					homeTeam: g.home.team,
					awayTeam: g.away.team,
					status: g.status || 'Unknown'
				}));
				gameResultsCache.set(week, results);
			} catch (error) {
				console.error(`[SeasonService] Error fetching games for week ${week}:`, error);
				gameResultsCache.set(week, []);
			}
		}

		// Calculate stats for each member
		for (const memberId of memberIds) {
			const user = await User.findById(memberId);
			if (!user) continue;

			const userPicks = await Pick.find({
				userId: memberId,
				leagueId,
				week: { $lte: 18 }
			}).lean();

			let totalPoints = 0;
			let totalCorrectPicks = 0;
			let totalPicksCount = 0;
			let totalTfsPoints = 0;
			const weeklyStats: Array<{
				week: number;
				points: number;
				correctPicks: number;
				totalPicks: number;
				tfsPoints: number;
			}> = [];

			for (const pick of userPicks) {
				const gameResults = gameResultsCache.get(pick.week) || [];

				const { weeklyPoints, correctPicks, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
					pick.picks,
					gameResults,
					pick.tfsGame,
					pick.tfsScore,
					league.mode || 'standard',
					calculatePointsFromOdds
				);

				totalPoints += weeklyPoints;
				totalCorrectPicks += correctPicks;
				totalPicksCount += completedGames;
				totalTfsPoints += tfsPoints;

				weeklyStats.push({
					week: pick.week,
					points: weeklyPoints,
					correctPicks,
					totalPicks: completedGames,
					tfsPoints
				});

				// Track weekly winners for "weeks won" calculation
				if (!weeklyWinners.has(pick.week)) {
					weeklyWinners.set(pick.week, []);
				}
				weeklyWinners.get(pick.week)!.push({ userId: memberId, points: weeklyPoints });
			}

			const winPercentage = totalPicksCount > 0 ? Math.round((totalCorrectPicks / totalPicksCount) * 100) : 0;

			standings.push({
				userId: memberId,
				userName: user.name || 'Unknown',
				userImage: user.image || null,
				rank: 0, // Will be calculated after sorting
				totalPoints,
				correctPicks: totalCorrectPicks,
				totalPicks: totalPicksCount,
				tfsPoints: totalTfsPoints,
				weeksWon: 0, // Will be calculated below
				winPercentage,
				weeklyStats
			});
		}

		// Calculate weeks won for each player
		for (const [, weekResults] of Array.from(weeklyWinners.entries())) {
			if (weekResults.length === 0) continue;

			const maxPoints = Math.max(...weekResults.map(r => r.points));
			const winners = weekResults.filter(r => r.points === maxPoints);

			for (const winner of winners) {
				const standing = standings.find(s => s.userId === winner.userId);
				if (standing) {
					standing.weeksWon++;
				}
			}
		}

		// Sort by total points and assign ranks
		standings.sort((a, b) => b.totalPoints - a.totalPoints);
		standings.forEach((standing, index) => {
			standing.rank = index + 1;
		});

		// Determine champions (handle ties)
		const maxPoints = standings.length > 0 ? standings[0].totalPoints : 0;
		const champions = standings
			.filter(s => s.totalPoints === maxPoints)
			.map(s => ({
				userId: s.userId,
				userName: s.userName,
				totalPoints: s.totalPoints
			}));

		// Find highest weekly score
		let highestWeeklyScore: {
			userId: string;
			userName: string;
			week: number;
			points: number;
		} | null = null;

		for (const standing of standings) {
			for (const weekStat of standing.weeklyStats) {
				if (!highestWeeklyScore || weekStat.points > highestWeeklyScore.points) {
					highestWeeklyScore = {
						userId: standing.userId,
						userName: standing.userName,
						week: weekStat.week,
						points: weekStat.points
					};
				}
			}
		}

		// Calculate season stats
		const totalPicksMade = standings.reduce((sum, s) => sum + s.totalPicks, 0);

		// Create the season history record
		await SeasonHistory.create({
			leagueId,
			leagueName: league.name,
			leagueMode: league.mode || 'standard',
			seasonYear,
			standings,
			champions,
			seasonStats: {
				totalWeeksPlayed: 18,
				totalGamesPlayed: totalPicksMade,
				totalPicksMade,
				highestWeeklyScore: highestWeeklyScore || undefined
			},
			archivedAt: new Date()
		});

		console.log(`[SeasonService] Archived league ${league.name} for season ${seasonYear}`);
	}

	/**
	 * Start a new season (reset standings, activate season)
	 */
	static async startNewSeason(): Promise<{ success: boolean; message: string }> {
		await connectDB();

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

		// Note: We don't delete picks here - they're preserved for history
		// The LeaderBoard and SeasonStats components will need to be updated
		// to only show picks from the current season

		console.log(`[SeasonService] Started new season ${newSeasonYear}`);

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
