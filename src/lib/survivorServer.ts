// Server-side loader for Survivor leagues (see src/lib/survivor.ts for the rules).
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { SurvivorPick } from '@/models/SurvivorPick';
import { User } from '@/models/User';
import { getCurrentSeasonYear, getSeasonWeeks } from '@/lib/season';
import { computeSurvivor, type GameOutcome, type RawSurvivorPick, type SurvivorResponse } from '@/lib/survivor';
import { NFLService } from '@/services/nflService';
import type { Game } from '@/components/games/GameCard';

export interface SurvivorLeague {
	leagueId: string;
	name: string;
	mode: string;
	memberIds: string[];
}

export const toOutcome = (g: Game): GameOutcome => ({
	id: g.id,
	homeTeam: g.home.team,
	awayTeam: g.away.team,
	homeScore: typeof g.home.score === 'number' ? g.home.score : undefined,
	awayScore: typeof g.away.score === 'number' ? g.away.score : undefined,
	status: g.status
});

/** The week being played in a season: the live NFL week for the current season, else its final week. */
export async function survivorCurrentWeek(season: number, startWeek: number, finalWeek: number): Promise<number> {
	if (season !== getCurrentSeasonYear()) return finalWeek;
	const live = await NFLService.getCurrentWeek(true);
	return Math.min(finalWeek, Math.max(startWeek, live));
}

/**
 * A Survivor league's standings for a season. `viewerId` sees all of their own picks; other
 * members' picks stay hidden until that game kicks off. Returns null when the league doesn't exist.
 */
export async function loadSurvivor(leagueId: string, season: number, viewerId: string): Promise<{ league: SurvivorLeague; data: SurvivorResponse; games: Map<number, Game[]> } | null> {
	await connectDB();
	const league = await League.findById(leagueId, 'name mode members').lean<{ name: string; mode?: string; members?: string[] }>();
	if (!league) return null;
	const memberIds = (league.members ?? []).map(String);

	const { startWeek, finalWeek } = await getSeasonWeeks(season);
	const currentWeek = await survivorCurrentWeek(season, startWeek, finalWeek);
	const weeks = Array.from({ length: currentWeek - startWeek + 1 }, (_, i) => startWeek + i);

	const [users, docs, gameLists] = await Promise.all([
		User.find({ _id: { $in: memberIds } }, 'name image').lean<Array<{ _id: unknown; name?: string; image?: string | null }>>(),
		SurvivorPick.find({ leagueId, season, week: { $gte: startWeek, $lte: finalWeek } }).lean<Array<RawSurvivorPick>>(),
		Promise.all(weeks.map(week => NFLService.getWeeklyGames(week, season).catch(() => [] as Game[])))
	]);
	const games = new Map(weeks.map((week, i) => [week, gameLists[i]]));
	const gamesByWeek = new Map(weeks.map((week, i) => [week, gameLists[i].map(toOutcome)]));

	const userById = new Map(users.map(u => [String(u._id), u]));
	const members = memberIds.map(id => ({ userId: id, name: userById.get(id)?.name || 'Unknown Player', image: userById.get(id)?.image ?? null }));
	const picks = docs.filter(d => memberIds.includes(String(d.userId))).map(d => ({ ...d, userId: String(d.userId) }));

	const computed = computeSurvivor({ members, picks, gamesByWeek, startWeek, finalWeek });

	// Other members' picks are secret until their game kicks off
	const started = (week: number, gameId: string) => {
		const game = games.get(week)?.find(g => g.id === gameId);
		const status = game?.status?.toLowerCase();
		return status === 'in' || status === 'post' || status === 'final';
	};
	for (const member of computed.members) {
		if (member.userId === viewerId) continue;
		for (const entry of Object.values(member.picks)) {
			if (!started(entry.week, entry.gameId)) Object.assign(entry, { team: '', abbreviation: '', logo: '', gameId: '', hidden: true });
		}
	}

	const usedTeams: Record<string, number> = {};
	for (const p of picks) if (p.userId === viewerId) usedTeams[p.team] = p.week;

	return {
		league: { leagueId, name: league.name, mode: league.mode || 'standard', memberIds },
		games,
		data: { leagueId, season, startWeek, finalWeek, currentWeek, ...computed, usedTeams }
	};
}
