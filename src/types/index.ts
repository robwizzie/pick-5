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

// ESPN Summary API types (detailed game data)
export interface EspnClock {
	displayValue?: string; // e.g., "12:34"
}

export interface EspnPeriod {
	number?: number; // Quarter number (1-4)
	displayValue?: string; // e.g., "1st Quarter"
}

export interface EspnSituationStatus {
	clock?: EspnClock;
	period?: EspnPeriod;
	type?: {
		name?: string; // "STATUS_IN_PROGRESS", "STATUS_FINAL", etc.
		state?: string; // "in", "post", "pre"
		completed?: boolean;
		description?: string;
		detail?: string;
		shortDetail?: string;
	};
}

export interface EspnOddsOutcome {
	odds?: string; // e.g., "-110"
	outcome?: string; // "WIN", "LOSS", etc.
}

export interface EspnMoneyline {
	away?: {
		close?: EspnOddsOutcome;
		open?: EspnOddsOutcome;
	};
	home?: {
		close?: EspnOddsOutcome;
		open?: EspnOddsOutcome;
	};
}

export interface EspnPickCenter {
	provider?: {
		id?: string;
		name?: string; // e.g., "ESPN BET"
	};
	details?: string; // e.g., "GB -1.5"
	spread?: number;
	overUnder?: number;
	overOdds?: number;
	underOdds?: number;
	moneyline?: EspnMoneyline;
	awayTeamOdds?: {
		moneyLine?: number;
		spreadOdds?: number;
		favorite?: boolean;
		underdog?: boolean;
	};
	homeTeamOdds?: {
		moneyLine?: number;
		spreadOdds?: number;
		favorite?: boolean;
		underdog?: boolean;
	};
}

export interface EspnBoxscoreTeam {
	team?: {
		id?: string;
		displayName?: string;
		abbreviation?: string;
		logo?: string;
	};
	statistics?: Array<{
		name?: string;
		displayValue?: string;
	}>;
}

export interface EspnGameSummary {
	boxscore?: {
		teams?: EspnBoxscoreTeam[];
	};
	header?: {
		id?: string;
		season?: {
			year?: number;
			type?: number;
		};
		week?: number;
		competitions?: Array<{
			status?: EspnSituationStatus;
			competitors?: EspnCompetitor[];
		}>;
	};
	pickcenter?: EspnPickCenter[];
	gameInfo?: {
		attendance?: number;
		venue?: {
			fullName?: string;
			address?: {
				city?: string;
				state?: string;
			};
		};
	};
}
