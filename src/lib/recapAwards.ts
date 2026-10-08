// Weekly recap awards, computed from a finished week's re-scored picks (pure: safe on client and server).
//
// - Bold Call: the longest-odds underdog that hit.
// - Chalk Eater: every one of your picks was a favorite (needs stored odds).
// - Lock Bust: your lock of the week lost.
// - Wooden Spoon: lowest score of the week (3+ players).
// - Worst Beat: the biggest favorite that lost on someone (without odds: the narrowest loss).
// - Heater: the longest current run of correct picks in the league (from the season's streaks).
import type { ScoringRules } from '@/lib/leagueRules';
import type { Streak } from '@/lib/badges';

export interface AwardPlayer {
	userId: string;
	name: string;
	image: string | null;
}

export interface RecapAwards {
	boldCall: (AwardPlayer & { team: string; opponent: string; odds: number; points: number }) | null;
	chalkEaters: AwardPlayer[];
	lockBusts: Array<AwardPlayer & { team: string; multiplier: number }>;
	woodenSpoon: Array<AwardPlayer & { points: number }>;
	worstBeat: (AwardPlayer & { team: string; opponent: string; odds: number | null; score: string }) | null;
	heater: (AwardPlayer & { length: number }) | null;
}

interface ScoredPick {
	gameId: string;
	team: string;
	isHome: boolean;
	odds?: number;
	isCorrect: boolean | null;
	points: number;
}

interface GameLike {
	id: string;
	home: { team: string; abbreviation: string; score?: number };
	away: { team: string; abbreviation: string; score?: number };
}

export function computeRecapAwards(input: {
	scored: Array<{ userId: string; lockGameId: string | null; weeklyPoints: number; picks: ScoredPick[] }>;
	games: GameLike[];
	rules: ScoringRules;
	user: (userId: string) => AwardPlayer;
	streaks: Record<string, Streak>;
}): RecapAwards {
	const { scored, games, rules, user, streaks } = input;
	const gameById = new Map(games.map(g => [g.id, g]));
	const sideOf = (p: ScoredPick) => {
		const game = gameById.get(p.gameId);
		if (!game) return null;
		const mine = p.isHome ? game.home : game.away;
		const theirs = p.isHome ? game.away : game.home;
		return { mine, theirs, score: `${mine.score ?? 0}–${theirs.score ?? 0}`, margin: (theirs.score ?? 0) - (mine.score ?? 0) };
	};
	const hasOdds = (p: ScoredPick): p is ScoredPick & { odds: number } => typeof p.odds === 'number';

	let boldCall: RecapAwards['boldCall'] = null;
	let worstBeat: RecapAwards['worstBeat'] = null;
	let worstKey = -Infinity;
	const chalkEaters: AwardPlayer[] = [];
	const lockBusts: RecapAwards['lockBusts'] = [];

	for (const s of scored) {
		for (const p of s.picks) {
			const side = sideOf(p);
			if (!side) continue;
			if (p.isCorrect && hasOdds(p) && p.odds > 0 && (!boldCall || p.odds > boldCall.odds)) {
				boldCall = { ...user(s.userId), team: side.mine.abbreviation, opponent: side.theirs.abbreviation, odds: p.odds, points: p.points };
			}
			if (p.isCorrect === false) {
				// Biggest favorite first (most negative odds), else the closest loss
				const key = hasOdds(p) ? 10_000 - p.odds : -side.margin;
				if (key > worstKey) {
					worstKey = key;
					worstBeat = { ...user(s.userId), team: side.mine.abbreviation, opponent: side.theirs.abbreviation, odds: hasOdds(p) ? p.odds : null, score: side.score };
				}
			}
		}
		if (s.picks.length >= 5 && s.picks.every(p => hasOdds(p) && p.odds < 0)) chalkEaters.push(user(s.userId));
		if (rules.lockMultiplier > 1 && s.lockGameId) {
			const lock = s.picks.find(p => p.gameId === s.lockGameId);
			const side = lock ? sideOf(lock) : null;
			if (lock?.isCorrect === false && side) lockBusts.push({ ...user(s.userId), team: side.mine.abbreviation, multiplier: rules.lockMultiplier });
		}
	}

	let woodenSpoon: RecapAwards['woodenSpoon'] = [];
	if (scored.length >= 3) {
		const low = Math.min(...scored.map(s => s.weeklyPoints));
		woodenSpoon = scored.filter(s => s.weeklyPoints === low).map(s => ({ ...user(s.userId), points: low }));
	}

	const hottest = Object.entries(streaks)
		.filter(([, st]) => st.kind === 'hot')
		.sort((a, b) => b[1].length - a[1].length)[0];
	const heater = hottest ? { ...user(hottest[0]), length: hottest[1].length } : null;

	return { boldCall, chalkEaters, lockBusts, woodenSpoon, worstBeat, heater };
}
