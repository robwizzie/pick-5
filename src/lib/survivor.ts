// Survivor leagues: every week each player still alive picks one team to win, and can't use a
// team twice in a season. A loss or tie knocks you out; so does having no pick once the week is
// over. If everyone still alive goes out in the same week, they all survive it instead. The last
// player standing wins; if several are still alive after the season's final week, they share it.
//
// Pure functions (no DB): safe on client and server.

export type SurvivorResult = 'win' | 'loss' | 'pending';

export interface SurvivorPickEntry {
	week: number;
	gameId: string;
	team: string;
	abbreviation: string;
	logo: string;
	result: SurvivorResult;
	/** Another member's pick for a game that hasn't kicked off yet: the team is hidden */
	hidden?: boolean;
}

export interface SurvivorMember {
	userId: string;
	name: string;
	image: string | null;
	alive: boolean;
	/** Week they went out (null while alive) */
	eliminatedWeek: number | null;
	/** Why they went out */
	eliminatedBy: 'loss' | 'no-pick' | null;
	picks: Record<number, SurvivorPickEntry>;
}

/** GET /api/league/[id]/survivor */
export interface SurvivorResponse {
	leagueId: string;
	season: number;
	startWeek: number;
	finalWeek: number;
	/** The week being played now (clamped to the season's weeks) */
	currentWeek: number;
	/** Last week whose games are all final */
	lastResolvedWeek: number | null;
	complete: boolean;
	/** Winners once the pool is decided (one player left, or everyone alive after the final week) */
	champions: string[];
	/** Weeks where everyone still alive lost, so nobody went out */
	reprieveWeeks: number[];
	members: SurvivorMember[];
	/** The viewer's teams already used this season: team name -> week */
	usedTeams: Record<string, number>;
}

export interface GameOutcome {
	id: string;
	homeTeam: string;
	awayTeam: string;
	homeScore?: number;
	awayScore?: number;
	status?: string;
}

const isFinal = (status?: string) => status === 'post' || status === 'final';

/** Win/loss of a picked team once its game is final (ties lose). */
export function pickResult(team: string, game: GameOutcome | undefined): SurvivorResult {
	if (!game || !isFinal(game.status)) return 'pending';
	const home = game.homeScore ?? 0;
	const away = game.awayScore ?? 0;
	if (home === away) return 'loss';
	const winner = home > away ? game.homeTeam : game.awayTeam;
	return winner === team ? 'win' : 'loss';
}

/** A week is resolved once every game on its slate is final. */
export function isWeekResolved(games: GameOutcome[] | undefined): boolean {
	return !!games && games.length > 0 && games.every(g => isFinal(g.status));
}

export interface RawSurvivorPick {
	userId: string;
	week: number;
	gameId: string;
	team: string;
	abbreviation?: string;
	logo?: string;
}

/**
 * Standings from every pick and each week's results. `gamesByWeek` should hold the weeks from
 * startWeek up to the current week. Members are everyone in the league now.
 */
export function computeSurvivor(input: {
	members: Array<{ userId: string; name: string; image: string | null }>;
	picks: RawSurvivorPick[];
	gamesByWeek: Map<number, GameOutcome[]>;
	startWeek: number;
	finalWeek: number;
}): Pick<SurvivorResponse, 'members' | 'champions' | 'complete' | 'reprieveWeeks' | 'lastResolvedWeek'> {
	const { members, picks, gamesByWeek, startWeek, finalWeek } = input;
	const pickOf = new Map(picks.map(p => [`${p.userId}:${p.week}`, p]));
	const state = new Map<string, SurvivorMember>(
		members.map(m => [m.userId, { ...m, alive: true, eliminatedWeek: null, eliminatedBy: null, picks: {} }])
	);

	// Every pick with its result (eliminated players' later picks can't exist: the API refuses them)
	for (const p of picks) {
		const member = state.get(p.userId);
		if (!member) continue;
		const game = gamesByWeek.get(p.week)?.find(g => g.id === p.gameId);
		member.picks[p.week] = { week: p.week, gameId: p.gameId, team: p.team, abbreviation: p.abbreviation ?? '', logo: p.logo ?? '', result: pickResult(p.team, game) };
	}

	const reprieveWeeks: number[] = [];
	let lastResolvedWeek: number | null = null;
	let complete = false;
	let champions: string[] = [];

	for (let week = startWeek; week <= finalWeek; week++) {
		if (!isWeekResolved(gamesByWeek.get(week))) break;
		lastResolvedWeek = week;
		const alive = Array.from(state.values()).filter(m => m.alive);
		if (alive.length === 0) break;

		const out = alive
			.map(m => {
				const p = pickOf.get(`${m.userId}:${week}`);
				if (!p) return { m, by: 'no-pick' as const };
				return m.picks[week]?.result === 'win' ? null : { m, by: 'loss' as const };
			})
			.filter((x): x is { m: SurvivorMember; by: 'loss' | 'no-pick' } => x !== null);

		if (out.length === alive.length) {
			// Everyone left went out together: they all live to fight another week
			reprieveWeeks.push(week);
		} else {
			for (const { m, by } of out) {
				m.alive = false;
				m.eliminatedWeek = week;
				m.eliminatedBy = by;
			}
		}

		const survivors = Array.from(state.values()).filter(m => m.alive);
		if (survivors.length <= 1 || week === finalWeek) {
			complete = true;
			champions = survivors.map(m => m.userId);
			break;
		}
	}

	// Alive first; the eliminated by how long they lasted
	const ordered = Array.from(state.values()).sort((a, b) => {
		if (a.alive !== b.alive) return a.alive ? -1 : 1;
		return (b.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0) || a.name.localeCompare(b.name);
	});
	return { members: ordered, champions, complete, reprieveWeeks, lastResolvedWeek };
}
