// src/services/statsService.ts

export interface WeeklyStats {
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
	weeklyPoints: number;
}

export interface SeasonStats {
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number; // Explicitly track total TFS points
	weeklyStats: Record<number, WeeklyStats>;
	winPercentage: number;
}

export class StatsService {
	private static STORAGE_KEY = 'nfl_pick5_stats';

	static getStoredStats(): SeasonStats {
		const storedStats = localStorage.getItem(this.STORAGE_KEY);
		if (storedStats) {
			return JSON.parse(storedStats);
		}
		return {
			totalPoints: 0,
			correctPicks: 0,
			totalPicks: 0,
			totalTFSPoints: 0, // Initialize total TFS points
			weeklyStats: {},
			winPercentage: 0
		};
	}

	static updateWeekStats(week: number, stats: WeeklyStats): SeasonStats {
		const seasonStats = this.getStoredStats();

		// Update weekly stats
		seasonStats.weeklyStats[week] = stats;

		// Recalculate season totals
		const totals = Object.values(seasonStats.weeklyStats).reduce(
			(acc, weekStats) => ({
				points: acc.points + weekStats.weeklyPoints,
				correct: acc.correct + weekStats.correctPicks,
				picks: acc.picks + weekStats.totalPicks,
				tfs: acc.tfs + weekStats.tfsPoints // Explicitly sum TFS points
			}),
			{ points: 0, correct: 0, picks: 0, tfs: 0 }
		);

		// Update season stats
		seasonStats.totalPoints = totals.points;
		seasonStats.correctPicks = totals.correct;
		seasonStats.totalPicks = totals.picks;
		seasonStats.totalTFSPoints = totals.tfs; // Set total TFS points
		seasonStats.winPercentage = totals.picks > 0 ? (totals.correct / totals.picks) * 100 : 0;

		// Save updated stats
		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seasonStats));

		return seasonStats;
	}

	static getWeekStats(week: number): WeeklyStats | null {
		const seasonStats = this.getStoredStats();
		return seasonStats.weeklyStats[week] || null;
	}

	static clearStats() {
		localStorage.removeItem(this.STORAGE_KEY);
	}
}
