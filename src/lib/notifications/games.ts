// src/lib/notifications/games.ts
// NFL schedule helpers for the notification jobs (ESPN via NFLService).
import type { Game } from '@/components/games/GameCard';
import { NFLService } from '@/services/nflService';
import { getSeasonWeeks } from '@/lib/season';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { ScoringService } from '@/services/scoringService';

/** ESPN `status.type.state` is 'pre' | 'in' | 'post'; older data used 'final'. */
export function isFinal(game: Pick<Game, 'status'>): boolean {
	const status = game.status?.toLowerCase();
	return status === 'post' || status === 'final' || status === 'status_final';
}

/** Results in the shape ScoringService expects. */
export function toGameResults(games: Game[]) {
	return games.map(game => ({
		id: game.id,
		homeScore: game.home.score || 0,
		awayScore: game.away.score || 0,
		homeTeam: game.home.team,
		awayTeam: game.away.team,
		status: game.status || 'Unknown'
	}));
}

export type GameResultRow = ReturnType<typeof toGameResults>[number];

/**
 * The most recent week (within the season's start..final weeks) whose games are all final, or null.
 * Unlike `getCurrentWeek(true) - 1` this is right for the final week too and doesn't depend
 * on when ESPN flips its default week.
 */
export async function getLastCompletedWeek(season: number): Promise<{ week: number; games: Game[] } | null> {
	const [currentWeek, { startWeek, finalWeek }] = await Promise.all([NFLService.getCurrentWeek(false), getSeasonWeeks(season)]);
	const espnWeek = Math.min(finalWeek, currentWeek);
	for (const week of [espnWeek, espnWeek - 1]) {
		if (week < startWeek) continue;
		const games = await NFLService.getWeeklyGames(week, season);
		if (games.length > 0 && games.every(isFinal)) return { week, games };
	}
	return null;
}

const etWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });

/** The week's first game kicking off on a Thursday (Eastern), if any. */
export function findThursdayGame(games: Game[]): Game | null {
	return (
		games
			.filter(game => etWeekday.format(new Date(game.date)) === 'Thu')
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null
	);
}

export function formatKickoffEt(date: Date | string): string {
	return new Date(date).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'America/New_York',
		timeZoneName: 'short'
	});
}

/** Points for a correct pick, matching ScoringService.calculateWeekScore. */
export function pointsForCorrectPick(leagueMode: string | undefined, odds: number | undefined | null, isLock = false): number {
	return ScoringService.pointsForPick({ odds: typeof odds === 'number' ? odds : undefined }, leagueMode || 'standard', calculatePointsFromOdds, isLock);
}
