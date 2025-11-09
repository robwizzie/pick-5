// src/services/gameUtils.ts
import type { Game } from '@/components/games/GameCard';

/**
 * Check if a game has started (status is 'in' or 'post', or game has actual scores)
 */
export function hasGameStarted(game: Game): boolean {
	// Game has started if status is 'in' (in progress) or 'post' (finished)
	if (game.status === 'in' || game.status === 'post') {
		return true;
	}

	// Game has started if it has actual scores (not just 0, which is a default)
	// Check if both scores exist and at least one is greater than 0
	const homeScore = game.home.score;
	const awayScore = game.away.score;
	if (typeof homeScore === 'number' && typeof awayScore === 'number' && (homeScore > 0 || awayScore > 0)) {
		return true;
	}

	// Game has started if the game date has passed (and it's not just scheduled)
	if (game.date && game.status !== 'pre' && game.status !== 'scheduled') {
		const gameDate = new Date(game.date);
		const now = new Date();
		return gameDate <= now;
	}

	return false;
}

/**
 * Check if a game has finished (has final scores)
 */
export function hasGameFinished(game: Game): boolean {
	// Game is finished ONLY if status is 'post' or 'final'
	// Do NOT check scores - in-progress games have scores but aren't finished
	return game.status === 'post' || game.status === 'final';
}

/**
 * Check if any of the picked games have started
 */
export function hasAnyPickedGameStarted(picks: { gameId: string }[], games: Game[]): boolean {
	return picks.some(pick => {
		const game = games.find(g => g.id === pick.gameId);
		return game ? hasGameStarted(game) : false;
	});
}

/**
 * Check if all picked games have started
 */
export function haveAllPickedGamesStarted(picks: { gameId: string }[], games: Game[]): boolean {
	if (picks.length === 0) return false;
	return picks.every(pick => {
		const game = games.find(g => g.id === pick.gameId);
		return game ? hasGameStarted(game) : false;
	});
}
