// Head-to-head rivalries: every week each league's members are paired 1-v-1 and whoever
// scores more that week wins the matchup. Pure functions (no DB): safe on client and server.
//
// Pairing: a deterministic round-robin (circle method). Members are sorted by userId and then
// shuffled with a PRNG seeded by the league id, so different leagues get different schedules
// but a league's schedule never changes while its membership doesn't. Week w plays round
// (w - 1) mod (n - 1), so everyone faces everyone once before any rematch.
//
// Odd member counts: a BYE slot is added. The member drawn against it plays the LEAGUE MEDIAN
// instead: the median weekly score of the other members who submitted picks that week
// (0 if nobody else did). Beating it is a W, losing an L, matching it a T — so nobody's
// record stalls on a bye week.
//
// Known limitation: pairings are derived from the league's CURRENT membership. If a member
// joins or leaves, the rotation is rebuilt, so future pairings shift and past weeks are
// recomputed against the new rotation (records can change retroactively). Persisting each
// week's pairings when the week goes final would fix this; until then the schedule is
// stable for as long as membership is.
import type { LeagueSeason, MemberWeek } from '@/lib/leagueSeason';

export const MEDIAN_ID = 'MEDIAN';
const BYE = '__BYE__';

export type MatchupStatus = 'upcoming' | 'live' | 'final';

export interface MatchupSide {
	/** A member's userId, or MEDIAN_ID for the league-median opponent of a bye week */
	userId: string;
	kind: 'member' | 'median';
	name: string;
	image: string | null;
	/** Live points (finished games only, locks applied) */
	points: number;
	correct: number;
	/** Picked games that are final */
	completedGames: number;
	/** Picked games */
	totalGames: number;
	/** Picked games currently in progress */
	liveGames: number;
	hasPicks: boolean;
}

export interface Matchup {
	id: string;
	week: number;
	status: MatchupStatus;
	isBye: boolean;
	sides: [MatchupSide, MatchupSide];
	/** userId (or MEDIAN_ID) of the winner once final; null while undecided or tied */
	winnerId: string | null;
	isTie: boolean;
	/** Neither member submitted picks: the matchup doesn't count toward records */
	noContest: boolean;
}

export interface H2HRecord {
	wins: number;
	losses: number;
	ties: number;
}

/** GET /api/league/[id]/matchups?week=N */
export interface MatchupsResponse {
	leagueId: string;
	season: number;
	week: number;
	matchups: Matchup[];
	/** Season W-L-T per member over final matchups through `week` */
	records: Record<string, H2HRecord>;
	myMatchupId: string | null;
}

/* --------------------------------- pairing -------------------------------- */

function hashString(value: string): number {
	// FNV-1a, 32-bit
	let h = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		h ^= value.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Members sorted by userId, then shuffled deterministically by the league id. BYE appended when odd. */
export function rotationOrder(memberIds: string[], seed: string): string[] {
	const order = Array.from(new Set(memberIds)).sort();
	const rand = mulberry32(hashString(seed));
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	if (order.length % 2 === 1) order.push(BYE);
	return order;
}

/**
 * Pairs for one week. `b` is null when `a` has the bye (plays the league median).
 * Fewer than 2 members → no matchups.
 */
export function weeklyPairings(memberIds: string[], seed: string, week: number): Array<{ a: string; b: string | null }> {
	const order = rotationOrder(memberIds, seed);
	const n = order.length;
	if (n < 2 || memberIds.length < 2) return [];
	const rounds = n - 1;
	const round = (((week - 1) % rounds) + rounds) % rounds;

	// Circle method: slot 0 stays put, the rest rotate one step per round
	const rest = order.slice(1);
	const rotated = rest.map((_, i) => rest[(i - round + rest.length) % rest.length]);
	const circle = [order[0], ...rotated];

	const pairs: Array<{ a: string; b: string | null }> = [];
	for (let i = 0; i < n / 2; i++) {
		const x = circle[i];
		const y = circle[n - 1 - i];
		if (x === BYE) pairs.push({ a: y, b: null });
		else if (y === BYE) pairs.push({ a: x, b: null });
		else pairs.push({ a: x, b: y });
	}
	return pairs;
}

/* --------------------------------- scoring -------------------------------- */

const isFinal = (status?: string) => status === 'post' || status === 'final';
const isStarted = (status?: string) => status === 'in' || isFinal(status);

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((x, y) => x - y);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function memberSide(season: LeagueSeason, userId: string, mw: MemberWeek | undefined, statusById: Map<string, string | undefined>): MatchupSide {
	const member = season.members.find(m => m.userId === userId);
	const picks = mw?.picks ?? [];
	return {
		userId,
		kind: 'member',
		name: member?.name ?? 'Unknown Player',
		image: member?.image ?? null,
		points: mw?.weeklyPoints ?? 0,
		correct: mw?.correctPicks ?? 0,
		completedGames: mw?.completedGames ?? 0,
		totalGames: picks.length,
		liveGames: picks.filter(p => statusById.get(p.gameId) === 'in').length,
		hasPicks: picks.length > 0
	};
}

const PICKS_PER_WEEK = 5;

/**
 * Status of a matchup. Live/upcoming follows the picked games. It's final once every picked
 * game is final — but if a side could still add picks (fewer than 5) or the opponent is the
 * league median (others may still pick), only once the whole week's slate is final.
 */
function statusOf(gameIds: string[], settled: boolean, statusById: Map<string, string | undefined>): MatchupStatus {
	const slate = Array.from(statusById.keys());
	const finalSet = settled && gameIds.length ? gameIds : slate;
	if (finalSet.length > 0 && finalSet.every(id => isFinal(statusById.get(id)))) return 'final';
	return (gameIds.length ? gameIds : slate).some(id => isStarted(statusById.get(id))) ? 'live' : 'upcoming';
}

/** Every matchup of `week`, live-scored. */
export function weekMatchups(season: LeagueSeason, week: number): Matchup[] {
	const memberIds = season.members.map(m => m.userId);
	const pairs = weeklyPairings(memberIds, season.leagueId, week);
	if (pairs.length === 0) return [];

	const byUser = season.weeks.get(week) ?? new Map<string, MemberWeek>();
	const statusById = new Map((season.resultsByWeek.get(week) ?? []).map(r => [r.id, r.status]));
	const gamesOf = (userId: string) => (byUser.get(userId)?.picks ?? []).map(p => p.gameId);

	return pairs.map(({ a, b }) => {
		const sideA = memberSide(season, a, byUser.get(a), statusById);
		let sideB: MatchupSide;
		let gameIds: string[];

		if (b) {
			sideB = memberSide(season, b, byUser.get(b), statusById);
			gameIds = [...gamesOf(a), ...gamesOf(b)];
		} else {
			// Bye: play the median of everyone else who picked this week
			const others = memberIds.filter(id => id !== a && (byUser.get(id)?.picks.length ?? 0) > 0);
			const othersWeeks = others.map(id => byUser.get(id)!);
			sideB = {
				userId: MEDIAN_ID,
				kind: 'median',
				name: 'League median',
				image: null,
				points: median(othersWeeks.map(w => w.weeklyPoints)),
				correct: median(othersWeeks.map(w => w.correctPicks)),
				completedGames: othersWeeks.reduce((s, w) => s + w.completedGames, 0),
				totalGames: othersWeeks.reduce((s, w) => s + w.picks.length, 0),
				liveGames: othersWeeks.reduce((s, w) => s + w.picks.filter(p => statusById.get(p.gameId) === 'in').length, 0),
				hasPicks: othersWeeks.length > 0
			};
			gameIds = [...gamesOf(a), ...others.flatMap(gamesOf)];
		}

		const settled = !!b && sideA.totalGames >= PICKS_PER_WEEK && sideB.totalGames >= PICKS_PER_WEEK;
		const status = statusOf(Array.from(new Set(gameIds)), settled, statusById);
		// Without the bye player's own picks there's nothing to play for
		const noContest = b ? !sideA.hasPicks && !sideB.hasPicks : !sideA.hasPicks;
		const decided = status === 'final' && !noContest;
		// Equal points: showing up beats a no-show; otherwise it's a tie
		const diff = sideA.points - sideB.points || Number(sideA.hasPicks) - Number(sideB.hasPicks);
		const isTie = decided && diff === 0;
		const winnerId = decided && !isTie ? (diff > 0 ? sideA.userId : sideB.userId) : null;

		return {
			id: `${week}:${a}:${b ?? MEDIAN_ID}`,
			week,
			status,
			isBye: !b,
			sides: [sideA, sideB],
			winnerId,
			isTie,
			noContest
		};
	});
}

/**
 * Season H2H records from every FINAL matchup in weeks <= throughWeek (weeks nobody picked
 * are skipped: they'd all be no-contests). Median "opponents" don't get a record.
 */
export function seasonRecords(season: LeagueSeason, throughWeek: number): Record<string, H2HRecord> {
	const records: Record<string, H2HRecord> = Object.fromEntries(season.members.map(m => [m.userId, { wins: 0, losses: 0, ties: 0 }]));
	const weeks = Array.from(season.weeks.keys()).filter(w => w <= throughWeek);
	for (const week of weeks) {
		for (const m of weekMatchups(season, week)) {
			if (m.status !== 'final' || m.noContest) continue;
			for (const side of m.sides) {
				const rec = records[side.userId];
				if (!rec) continue;
				if (m.isTie) rec.ties++;
				else if (m.winnerId === side.userId) rec.wins++;
				else rec.losses++;
			}
		}
	}
	return records;
}

export const formatRecord = (r: H2HRecord | undefined) => (r ? `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}` : '0-0');
