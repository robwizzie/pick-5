// src/services/nflService.ts
import type { Game, TeamInfo } from '@/components/games/GameCard';

export class NFLService {
	static async getWeeklyGames(week: number): Promise<Game[]> {
		try {
			// Include seasontype=2 for regular season, dates parameter helps with current data
			const year = new Date().getFullYear();
			const response = await fetch(
				`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&dates=${year}`,
				{
					headers: {
						'Accept': 'application/json',
					}
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();

			if (!data.events || data.events.length === 0) {
				console.warn(`No events found for week ${week}. Response:`, data);
				return [];
			}

			return this.formatGameData(data.events);
		} catch (error) {
			console.error('Error fetching games:', error);
			throw error;
		}
	}

	/**
	 * Calculate the current NFL week based on the date
	 * NFL season typically starts early September and runs 18 weeks
	 */
	static getCurrentWeek(): number {
		const now = new Date();
		const year = now.getFullYear();

		// NFL season typically starts the first Thursday after Labor Day (first Monday in September)
		// For 2025, season starts approximately September 4th
		// This is a simplified calculation - adjust the start date as needed
		const seasonStart = new Date(year, 8, 4); // September 4, 2025 (month is 0-indexed)

		// If we're before the season start, return week 1
		if (now < seasonStart) {
			return 1;
		}

		// Calculate weeks elapsed since season start
		const msPerWeek = 7 * 24 * 60 * 60 * 1000;
		const weeksPassed = Math.floor((now.getTime() - seasonStart.getTime()) / msPerWeek);

		// NFL regular season is 18 weeks
		const currentWeek = Math.min(weeksPassed + 1, 18);

		return currentWeek;
	}

	private static formatGameData(events: any[]): Game[] {
		return events.map(event => {
			const homeTeam = event.competitions[0].competitors.find((team: any) => team.homeAway === 'home');
			const awayTeam = event.competitions[0].competitors.find((team: any) => team.homeAway === 'away');

			const formatTeam = (team: any): TeamInfo => ({
				team: team.team.displayName,
				abbreviation: team.team.abbreviation,
				logo: team.team.logo,
				record: team.records?.[0]?.summary || '',
				score: parseInt(team.score) || undefined
			});

			return {
				id: event.id,
				date: new Date(event.date),
				status: event.status.type.state,
				home: formatTeam(homeTeam),
				away: formatTeam(awayTeam)
			};
		});
	}
}
