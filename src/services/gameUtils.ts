// src/services/gameUtils.ts
import type { Game } from '@/components/games/GameCard';

/**
 * Check if a game has started (status is 'in' or 'post', or game has scores)
 */
export function hasGameStarted(game: Game): boolean {
	// Game has started if it has scores
	if (typeof game.home.score === 'number' || typeof game.away.score === 'number') {
		return true;
	}

	// Game has started if status is 'in' (in progress) or 'post' (finished)
	if (game.status === 'in' || game.status === 'post') {
		return true;
	}

	// Game has started if the game date has passed
	if (game.date) {
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
	return typeof game.home.score === 'number' && typeof game.away.score === 'number';
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
