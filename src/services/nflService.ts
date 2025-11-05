// src/services/nflService.ts
import type { Game, TeamInfo } from '@/components/games/GameCard';
import type { EspnEvent } from '@/types';
import { cachedFetch } from './cacheService';

export class NFLService {
	private static readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes for live data

	private static getCurrentSeason(): number {
		const now = new Date();
		const year = now.getFullYear();
		// NFL season typically starts in September; before Sep -> use previous year
		const seasonYear = now.getMonth() < 8 ? year - 1 : year;
		return seasonYear;
	}

	/**
	 * Check if we're running on the server side
	 */
	private static isServer(): boolean {
		return typeof window === 'undefined';
	}

	static async getWeeklyGames(week: number, season?: number): Promise<Game[]> {
		try {
			const effectiveSeason = season ?? this.getCurrentSeason();

			// If we're on the server, call ESPN API directly to avoid relative URL issues
			if (this.isServer()) {
				const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&dates=${effectiveSeason}`;

				const response = await fetch(espnUrl, {
					headers: {
						'User-Agent': 'pick-5/1.0',
						'Accept': 'application/json'
					},
					next: { revalidate: 120 } // Cache for 2 minutes
				});

				if (!response.ok) {
					console.error(`ESPN API error: ${response.status} ${response.statusText}`);
					return [];
				}

				const data = await response.json();

				if (!data.events || data.events.length === 0) {
					console.warn(`No games found for week ${week}, season ${effectiveSeason}`);
					return [];
				}

				return this.formatGameData(data.events);
			}

			// On the client, use the proxy API
			const url = `/api/nfl/scoreboard?week=${week}&season=${effectiveSeason}&seasontype=2`;
			const data = await cachedFetch<{ events: EspnEvent[] }>(url, {}, this.CACHE_TTL);

			if (!data.events || data.events.length === 0) {
				console.warn(`No games found for week ${week}, season ${effectiveSeason}`);
				return [];
			}

			return this.formatGameData(data.events);
		} catch (error) {
			console.error('Error fetching games:', error);
			// Return empty array instead of throwing to prevent app crashes
			return [];
		}
	}

	static async getCurrentWeek(): Promise<number> {
		try {
			// If on server, call ESPN directly
			if (this.isServer()) {
				const effectiveSeason = this.getCurrentSeason();
				const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&dates=${effectiveSeason}`;

				const response = await fetch(espnUrl, {
					headers: {
						'User-Agent': 'pick-5/1.0',
						'Accept': 'application/json'
					},
					next: { revalidate: 600 } // Cache for 10 minutes
				});

				if (response.ok) {
					const data = await response.json();
					return data.week?.number || this.calculateCurrentWeek();
				}
			} else {
				// On client, use proxy API
				const url = '/api/nfl/scoreboard';
				const data = await cachedFetch<{ week: { number: number } }>(url, {}, 10 * 60 * 1000);
				return data.week?.number || this.calculateCurrentWeek();
			}

			// Fallback to calculation
			return this.calculateCurrentWeek();
		} catch (error) {
			console.error('Error fetching current week:', error);
			// Fallback to calculating week based on date
			return this.calculateCurrentWeek();
		}
	}

	static calculateCurrentWeek(): number {
		const now = new Date();
		const seasonYear = this.getCurrentSeason();
		// Approx season start: first Thursday of September
		const sepFirst = new Date(seasonYear, 8, 1);
		const day = sepFirst.getDay(); // 0 Sun ... 4 Thu ...
		const deltaToThu = (4 - day + 7) % 7;
		const seasonStart = new Date(sepFirst);
		seasonStart.setDate(sepFirst.getDate() + deltaToThu);
		const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
		return Math.max(1, Math.min(18, weeksSinceStart + 1));
	}

	private static formatGameData(events: EspnEvent[]): Game[] {
		return events
			.map(event => {
				try {
					const competition = event.competitions?.[0];
					if (!competition) return null;

					const homeTeam = competition.competitors?.find(team => team.homeAway === 'home');
					const awayTeam = competition.competitors?.find(team => team.homeAway === 'away');

					if (!homeTeam || !awayTeam) return null;

					const formatTeam = (team: NonNullable<typeof homeTeam>): TeamInfo => ({
						team: team.team?.displayName || 'Unknown',
						abbreviation: team.team?.abbreviation || 'UNK',
						logo: team.team?.logo || '',
						record: team.records?.[0]?.summary || '',
						score: team.score ? parseInt(team.score) : undefined
					});

					return {
						id: event.id,
						date: new Date(event.date),
						status: event.status?.type?.state || 'scheduled',
						home: formatTeam(homeTeam),
						away: formatTeam(awayTeam)
					};
				} catch (error) {
					console.error('Error formatting game data:', error);
					return null;
				}
			})
			.filter(Boolean) as Game[];
	}
}
