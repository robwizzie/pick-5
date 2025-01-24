// src/types/index.ts
export interface WeeklyStats {
	weeklyPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

export interface SeasonStats {
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	weeklyStats: Record<number, WeeklyStats>;
	winPercentage: number;
}

export interface UserStats {
	totalPoints: number;
	weeklyScores: Record<string, number>;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}
