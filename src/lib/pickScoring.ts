// Server-side helpers for scoring and revealing pick documents.
import { NFLService } from '@/services/nflService';
import { ScoringService, type ScoringInput } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export interface GameResult {
	id: string;
	homeScore: number | undefined;
	awayScore: number | undefined;
	homeTeam: string;
	awayTeam: string;
	status?: string;
}

export interface PickEntry {
	gameId: string;
	team: string;
	isHome: boolean;
	odds?: number;
}

export interface PickDocLike {
	week: number;
	picks: PickEntry[];
	tfsGame?: string | null;
	tfsScore?: number | null;
	lockGameId?: string | null;
}

/** Game results for each week, fetched in parallel. */
export async function loadGameResults(weeks: number[], season: number): Promise<Map<number, GameResult[]>> {
	const unique = Array.from(new Set(weeks));
	const results = await Promise.all(
		unique.map(async week =>
			(await NFLService.getWeeklyGames(week, season)).map(game => ({
				id: game.id,
				homeScore: typeof game.home.score === 'number' ? game.home.score : undefined,
				awayScore: typeof game.away.score === 'number' ? game.away.score : undefined,
				homeTeam: game.home.team,
				awayTeam: game.away.team,
				status: game.status
			}))
		)
	);
	return new Map(unique.map((week, i) => [week, results[i]]));
}

/** Re-score a pick document against live results (stored scores can be stale). */
export function rescore(doc: PickDocLike, results: GameResult[], league: ScoringInput) {
	const { scoredPicks, weeklyPoints, correctPicks, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
		doc.picks,
		results,
		doc.tfsGame ?? null,
		doc.tfsScore ?? null,
		league,
		calculatePointsFromOdds,
		doc.lockGameId
	);
	return { picks: scoredPicks, weeklyPoints, correctPicks, tfsPoints, completedGames };
}

export const hasKickedOff = (status?: string) => status === 'in' || status === 'post' || status === 'final';

/**
 * Hide another player's picks (and TFS guess) for games that haven't kicked off,
 * so league-mates can't copy each other.
 */
export function revealStartedOnly<T extends { picks: PickEntry[]; tfsGame?: string | null; tfsScore?: number | null; lockGameId?: string | null }>(
	doc: T,
	results: GameResult[]
): T & { hiddenPicks: number } {
	const statusById = new Map(results.map(r => [r.id, r.status]));
	const tfsVisible = !!doc.tfsGame && hasKickedOff(statusById.get(doc.tfsGame));
	const picks = doc.picks.filter(p => hasKickedOff(statusById.get(p.gameId)));
	return {
		...doc,
		picks,
		// The count (not the teams) so the UI can say "2 more picks revealed at kickoff"
		hiddenPicks: doc.picks.length - picks.length,
		// The lock is part of the strategy too: reveal it once that game kicks off
		lockGameId: doc.lockGameId && hasKickedOff(statusById.get(doc.lockGameId)) ? doc.lockGameId : null,
		tfsGame: tfsVisible ? doc.tfsGame : null,
		tfsScore: tfsVisible ? doc.tfsScore : null
	};
}
