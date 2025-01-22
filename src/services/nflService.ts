// src/services/nflService.ts
import type { Game, TeamInfo } from '@/components/games/GameCard';

export class NFLService {
	static async getWeeklyGames(week: number): Promise<Game[]> {
		try {
			const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`);

			if (!response.ok) {
				throw new Error('Failed to fetch games');
			}

			const data = await response.json();
			return this.formatGameData(data.events);
		} catch (error) {
			console.error('Error fetching games:', error);
			throw error;
		}
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
