'use client';

import { WeeklyStats, SeasonStats } from '@/types';

const DEFAULT_STATS: SeasonStats = {
	totalPoints: 0,
	correctPicks: 0,
	totalPicks: 0,
	totalTFSPoints: 0,
	weeklyStats: {},
	winPercentage: 0
};

export class StatsService {
	private static STORAGE_KEY = 'nfl_pick5_stats';

	static getStoredStats(): SeasonStats {
		if (typeof window === 'undefined') {
			return DEFAULT_STATS;
		}

		try {
			const storedStats = localStorage.getItem(this.STORAGE_KEY);
			return storedStats ? JSON.parse(storedStats) : DEFAULT_STATS;
		} catch (error) {
			console.error('Error reading from localStorage:', error);
			return DEFAULT_STATS;
		}
	}

	static async updateMongoStats(userId: string, weeklyStats: WeeklyStats, week: number): Promise<void> {
		try {
			const response = await fetch('/api/stats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, weeklyStats, week })
			});

			if (!response.ok) throw new Error('Failed to update stats');

			this.updateWeekStats(week, weeklyStats);
		} catch (error) {
			console.error('Error updating MongoDB stats:', error);
			throw error;
		}
	}

	static updateWeekStats(week: number, stats: WeeklyStats): SeasonStats {
		if (typeof window === 'undefined') return DEFAULT_STATS;

		const seasonStats = this.getStoredStats();
		seasonStats.weeklyStats[week] = stats;

		const totals = Object.values(seasonStats.weeklyStats).reduce(
			(acc, weekStats) => ({
				points: acc.points + weekStats.weeklyPoints,
				correct: acc.correct + weekStats.correctPicks,
				picks: acc.picks + weekStats.totalPicks,
				tfs: acc.tfs + weekStats.tfsPoints
			}),
			{ points: 0, correct: 0, picks: 0, tfs: 0 }
		);

		seasonStats.totalPoints = totals.points;
		seasonStats.correctPicks = totals.correct;
		seasonStats.totalPicks = totals.picks;
		seasonStats.totalTFSPoints = totals.tfs;
		seasonStats.winPercentage = totals.picks > 0 ? (totals.correct / totals.picks) * 100 : 0;

		localStorage.setItem(this.STORAGE_KEY, JSON.stringify(seasonStats));
		return seasonStats;
	}
}
