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

// ESPN API types
export interface EspnTeamRef {
	displayName?: string;
	abbreviation?: string;
	logo?: string;
}

export interface EspnRecord {
	summary?: string;
}

export interface EspnCompetitor {
	homeAway: 'home' | 'away';
	team?: EspnTeamRef;
	score?: string;
	records?: EspnRecord[];
}

export interface EspnCompetition {
	competitors?: EspnCompetitor[];
}

export interface EspnStatusType {
	state?: string;
}

export interface EspnStatus {
	type?: EspnStatusType;
}

export interface EspnEvent {
	id: string;
	date: string;
	competitions?: EspnCompetition[];
	status?: EspnStatus;
}
