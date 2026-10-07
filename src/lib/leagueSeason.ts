// Server-side loader for a league's whole season, re-scored live (locks applied).
// Shared by matchups, badges and the live "sweat" view.
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { countedWeeks, seasonPickFilter } from '@/lib/season';
import { loadGameResults, rescore, type GameResult, type PickDocLike } from '@/lib/pickScoring';

export interface LeagueMember {
	userId: string;
	name: string;
	image: string | null;
}

export interface ScoredPick {
	gameId: string;
	team: string;
	opponent?: string;
	isHome: boolean;
	odds?: number;
	isCorrect: boolean | null;
	isLock: boolean;
	points: number;
}

export interface MemberWeek {
	userId: string;
	week: number;
	weeklyPoints: number;
	correctPicks: number;
	/** Picks whose games are final */
	completedGames: number;
	tfsPoints: number;
	tfsGame: string | null;
	tfsScore: number | null;
	lockGameId: string | null;
	picks: ScoredPick[];
}

export interface LeagueSeason {
	leagueId: string;
	leagueName: string;
	mode: string;
	creatorId?: string;
	members: LeagueMember[];
	season: number;
	/** Game results (with live scores and status) for every week anyone picked */
	resultsByWeek: Map<number, GameResult[]>;
	/** week -> userId -> that member's scored week (only members who picked) */
	weeks: Map<number, Map<string, MemberWeek>>;
}

type PickDoc = PickDocLike & { userId: string; leagueId: string; lockGameId?: string | null; picks: Array<PickDocLike['picks'][number] & { opponent?: string }> };

/** Load and live-score a league's season. Returns null if the league doesn't exist. */
export async function loadLeagueSeason(leagueId: string, season: number, opts: { extraWeeks?: number[] } = {}): Promise<LeagueSeason | null> {
	await connectDB();
	const league = await League.findById(leagueId, 'name mode members creatorId').lean<{ name: string; mode?: string; members?: string[]; creatorId?: string }>();
	if (!league) return null;

	const memberIds = (league.members ?? []).map(String);
	const [users, docs] = await Promise.all([
		User.find({ _id: { $in: memberIds } }, 'name image').lean<Array<{ _id: unknown; name?: string; image?: string | null }>>(),
		// Weeks after the season's final week don't count
		Pick.find({ leagueId, week: countedWeeks(season), ...seasonPickFilter(season) }).lean<PickDoc[]>()
	]);
	const mode = league.mode || 'standard';
	const resultsByWeek = await loadGameResults([...docs.map(d => d.week), ...(opts.extraWeeks ?? [])], season);

	const weeks = new Map<number, Map<string, MemberWeek>>();
	for (const doc of docs) {
		const userId = String(doc.userId);
		if (!memberIds.includes(userId)) continue;
		const scored = rescore(doc, resultsByWeek.get(doc.week) ?? [], mode);
		const byUser = weeks.get(doc.week) ?? new Map<string, MemberWeek>();
		byUser.set(userId, {
			userId,
			week: doc.week,
			weeklyPoints: scored.weeklyPoints,
			correctPicks: scored.correctPicks,
			completedGames: scored.completedGames,
			tfsPoints: scored.tfsPoints,
			tfsGame: doc.tfsGame ?? null,
			tfsScore: doc.tfsScore ?? null,
			lockGameId: doc.lockGameId ?? null,
			picks: scored.picks as ScoredPick[]
		});
		weeks.set(doc.week, byUser);
	}

	const nameById = new Map(users.map(u => [String(u._id), u]));
	return {
		leagueId,
		leagueName: league.name,
		mode,
		creatorId: league.creatorId,
		season,
		members: memberIds.map(id => ({ userId: id, name: nameById.get(id)?.name || 'Unknown Player', image: nameById.get(id)?.image ?? null })),
		resultsByWeek,
		weeks
	};
}

/** Season points per member, optionally excluding one week (e.g. the week being projected). */
export function seasonTotals(season: LeagueSeason, excludeWeek?: number): Map<string, number> {
	const totals = new Map(season.members.map(m => [m.userId, 0]));
	season.weeks.forEach((byUser, week) => {
		if (week === excludeWeek) return;
		byUser.forEach((w, userId) => totals.set(userId, (totals.get(userId) ?? 0) + w.weeklyPoints));
	});
	return totals;
}

/** Whether the viewer is a member (all league endpoints require it). */
export function isMember(season: LeagueSeason, userId: string | undefined): boolean {
	return !!userId && season.members.some(m => m.userId === userId);
}
