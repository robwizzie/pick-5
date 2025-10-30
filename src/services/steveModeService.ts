// src/services/steveModeService.ts
import { cachedFetch } from './cacheService';

export interface SteveModeGame {
	id: string;
	homeTeam: string;
	awayTeam: string;
	homeScore?: number;
	awayScore?: number;
	status: 'scheduled' | 'in_progress' | 'final';
	date: string;
	week: number;
}

export interface SteveModePick {
	gameId: string;
	pick: 'home' | 'away';
	confidence: number; // 1-5
}

export class SteveModeService {
	private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	/**
	 * Get games for a specific week in Steve mode format
	 */
	static async getWeeklyGames(week: number, season: number = 2024): Promise<SteveModeGame[]> {
		try {
			// Use ESPN API to get games
			const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&season=${season}`;

			const data = await cachedFetch<{ events: any[] }>(url, {}, this.CACHE_TTL);

			if (!data.events || data.events.length === 0) {
				console.warn(`No games found for week ${week}, season ${season}`);
				return [];
			}

			return this.formatGamesForSteveMode(data.events, week);
		} catch (error) {
			console.error('Error fetching games for Steve mode:', error);
			return [];
		}
	}

	/**
	 * Submit picks in Steve mode format
	 */
	static async submitPicks(leagueId: string, week: number, picks: SteveModePick[], userId: string): Promise<{ success: boolean; message: string }> {
		try {
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					leagueId,
					week,
					picks: picks.map(pick => ({
						gameId: pick.gameId,
						team: pick.pick,
						confidence: pick.confidence
					})),
					userId
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			return { success: true, message: 'Picks submitted successfully' };
		} catch (error) {
			console.error('Error submitting picks:', error);
			return { success: false, message: 'Failed to submit picks' };
		}
	}

	/**
	 * Get user's picks for a specific week
	 */
	static async getUserPicks(leagueId: string, week: number, userId: string): Promise<SteveModePick[]> {
		try {
			const response = await fetch(`/api/picks?leagueId=${leagueId}&week=${week}&userId=${userId}`, {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data.picks || [];
		} catch (error) {
			console.error('Error fetching user picks:', error);
			return [];
		}
	}

	/**
	 * Get leaderboard for Steve mode
	 */
	static async getLeaderboard(leagueId: string, week?: number): Promise<{ player: string; points: number; correct: number; total: number }[]> {
		try {
			const url = week ? `/api/leaderboard?leagueId=${leagueId}&week=${week}` : `/api/leaderboard?leagueId=${leagueId}`;

			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return data.leaderboard || [];
		} catch (error) {
			console.error('Error fetching leaderboard:', error);
			return [];
		}
	}

	/**
	 * Format ESPN games data for Steve mode
	 */
	private static formatGamesForSteveMode(events: any[], week: number): SteveModeGame[] {
		return events
			.map(event => {
				try {
					const competition = event.competitions?.[0];
					if (!competition) return null;

					const homeTeam = competition.competitors?.find((team: any) => team.homeAway === 'home');
					const awayTeam = competition.competitors?.find((team: any) => team.homeAway === 'away');

					if (!homeTeam || !awayTeam) return null;

					return {
						id: event.id,
						homeTeam: homeTeam.team?.displayName || 'Unknown',
						awayTeam: awayTeam.team?.displayName || 'Unknown',
						homeScore: homeTeam.score ? parseInt(homeTeam.score) : undefined,
						awayScore: awayTeam.score ? parseInt(awayTeam.score) : undefined,
						status: this.mapGameStatus(event.status?.type?.state),
						date: event.date,
						week
					};
				} catch (error) {
					console.error('Error formatting game for Steve mode:', error);
					return null;
				}
			})
			.filter(Boolean) as SteveModeGame[];
	}

	/**
	 * Map ESPN game status to Steve mode status
	 */
	private static mapGameStatus(espnStatus: string): 'scheduled' | 'in_progress' | 'final' {
		switch (espnStatus) {
			case 'pre':
				return 'scheduled';
			case 'in':
				return 'in_progress';
			case 'post':
				return 'final';
			default:
				return 'scheduled';
		}
	}

	/**
	 * Validate picks for Steve mode
	 */
	static validatePicks(picks: SteveModePick[]): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (picks.length === 0) {
			errors.push('No picks submitted');
			return { valid: false, errors };
		}

		if (picks.length > 5) {
			errors.push('Maximum 5 picks allowed');
		}

		const gameIds = new Set();
		picks.forEach((pick, index) => {
			if (!pick.gameId) {
				errors.push(`Pick ${index + 1}: Game ID is required`);
			}

			if (!pick.pick || !['home', 'away'].includes(pick.pick)) {
				errors.push(`Pick ${index + 1}: Invalid team selection`);
			}

			if (!pick.confidence || pick.confidence < 1 || pick.confidence > 5) {
				errors.push(`Pick ${index + 1}: Confidence must be between 1 and 5`);
			}

			if (gameIds.has(pick.gameId)) {
				errors.push(`Pick ${index + 1}: Duplicate game selection`);
			}

			gameIds.add(pick.gameId);
		});

		return { valid: errors.length === 0, errors };
	}
}
