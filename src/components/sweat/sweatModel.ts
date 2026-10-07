// Shared (client + server) model for the live "sweat" view: response types and the pure
// projection math. No server imports here, so the client can use the types and helpers too.

export type SweatPhase = 'pre' | 'in' | 'post';
export type SweatPickState = 'upcoming' | 'winning' | 'losing' | 'tied' | 'won' | 'lost';

export interface SweatTeam {
	team: string;
	abbreviation: string;
	logo: string;
	score: number | null;
}

export interface SweatGame {
	id: string;
	phase: SweatPhase;
	/** ISO kickoff time */
	date: string;
	clock: string | null;
	periodDisplay: string | null;
	home: SweatTeam;
	away: SweatTeam;
}

export interface SweatMyPick {
	gameId: string;
	isHome: boolean;
	isLock: boolean;
	odds: number | null;
	state: SweatPickState;
	/** What a correct pick is worth (lock multiplier applied) */
	value: number;
	/** Points already banked (final + correct) */
	earned: number;
	team: SweatTeam;
	opponent: SweatTeam;
	game: SweatGame;
}

/** Another member's pick — only ever sent for games that have kicked off. */
export interface SweatRevealedPick {
	gameId: string;
	abbreviation: string;
	logo: string;
	isLock: boolean;
	state: SweatPickState;
}

export interface SweatStanding {
	userId: string;
	name: string;
	image: string | null;
	hasPicks: boolean;
	/** Season points excluding this week */
	seasonBefore: number;
	/** This week's banked points (finals + TFS) */
	secured: number;
	/** Points from live picks currently winning */
	liveWinning: number;
	projectedWeek: number;
	projectedSeason: number;
	/** Rank by season total as it stands (finals only) */
	currentRank: number;
	/** Rank by projected season total */
	projectedRank: number;
	/** Rank by projected week points */
	projectedWeekRank: number;
	/** Started-game picks (others) or all picks (viewer) for the row's mini logos */
	picks: SweatRevealedPick[];
	/** Picks still hidden because their games haven't kicked off */
	hiddenPicks: number;
}

export interface SweatResponse {
	week: number;
	season: number;
	leagueName: string;
	leagueMode: string;
	games: { live: number; final: number; upcoming: number; total: number };
	/** ISO time of the next kickoff in this week, if any */
	nextKickoff: string | null;
	me: {
		hasPicks: boolean;
		picks: SweatMyPick[];
		secured: number;
		live: number;
		max: number;
	};
	standings: SweatStanding[];
	updatedAt: string;
}

export function sweatPhase(status?: string | null): SweatPhase {
	const s = status?.toLowerCase();
	if (s === 'post' || s === 'final' || s === 'status_final') return 'post';
	if (s === 'in' || s === 'in_progress') return 'in';
	return 'pre';
}

/**
 * Where a pick stands. Finals use the scored result when available (ties lose, like scoring);
 * live picks use the current score.
 */
export function pickState(phase: SweatPhase, pickScore: number | null, oppScore: number | null, isCorrect?: boolean | null): SweatPickState {
	if (phase === 'pre') return 'upcoming';
	if (phase === 'post') {
		if (typeof isCorrect === 'boolean') return isCorrect ? 'won' : 'lost';
		return (pickScore ?? 0) > (oppScore ?? 0) ? 'won' : 'lost';
	}
	const mine = pickScore ?? 0;
	const theirs = oppScore ?? 0;
	return mine > theirs ? 'winning' : mine < theirs ? 'losing' : 'tied';
}

/** Competition ranking (1, 2, 2, 4) by a numeric value, highest first. */
export function rankBy<T>(rows: T[], value: (row: T) => number, key: (row: T) => string): Map<string, number> {
	const sorted = [...rows].sort((a, b) => value(b) - value(a));
	const ranks = new Map<string, number>();
	sorted.forEach((row, i) => {
		const prev = sorted[i - 1];
		ranks.set(key(row), prev && value(prev) === value(row) ? ranks.get(key(prev))! : i + 1);
	});
	return ranks;
}

export interface ProjectionInput {
	userId: string;
	/** Season total excluding this week */
	seasonBefore: number;
	secured: number;
	liveWinning: number;
}

export interface Projection extends ProjectionInput {
	projectedWeek: number;
	projectedSeason: number;
	currentRank: number;
	projectedRank: number;
	projectedWeekRank: number;
}

/**
 * "If the games ended now": projected week = secured + live picks currently winning;
 * projected season = season before this week + projected week. Current rank uses what's
 * banked (season before + secured).
 */
export function project(rows: ProjectionInput[]): Projection[] {
	const withTotals = rows.map(r => ({ ...r, projectedWeek: r.secured + r.liveWinning, projectedSeason: r.seasonBefore + r.secured + r.liveWinning, currentSeason: r.seasonBefore + r.secured }));
	const key = (r: { userId: string }) => r.userId;
	const current = rankBy(withTotals, r => r.currentSeason, key);
	const projected = rankBy(withTotals, r => r.projectedSeason, key);
	const week = rankBy(withTotals, r => r.projectedWeek, key);
	return withTotals.map(r => ({
		userId: r.userId,
		seasonBefore: r.seasonBefore,
		secured: r.secured,
		liveWinning: r.liveWinning,
		projectedWeek: r.projectedWeek,
		projectedSeason: r.projectedSeason,
		currentRank: current.get(r.userId)!,
		projectedRank: projected.get(r.userId)!,
		projectedWeekRank: week.get(r.userId)!
	}));
}
