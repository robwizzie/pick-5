// src/services/nflService.ts
import type { Game, TeamInfo } from '@/components/games/GameCard';
import type { EspnEvent, EspnGameSummary } from '@/types';
import { cachedFetch } from './cacheService';

export class NFLService {
	private static readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes for live data

	/**
	 * Get recommended polling interval based on whether games are likely in progress
	 * This helps avoid rate limiting while still providing timely updates during games
	 */
	static getPollingInterval(): number {
		const now = new Date();
		const day = now.getDay(); // 0 = Sunday, 4 = Thursday, 1 = Monday
		const hour = now.getHours();

		// Thursday Night Football (typically 8:15 PM ET - midnight ET)
		if (day === 4 && hour >= 19 && hour <= 23) {
			return 2 * 60 * 1000; // 2 minutes during Thursday games
		}

		// Sunday games (typically 1 PM - midnight ET)
		if (day === 0 && hour >= 12 && hour <= 23) {
			return 2 * 60 * 1000; // 2 minutes during Sunday games
		}

		// Monday Night Football (typically 8:15 PM ET - midnight ET)
		if (day === 1 && hour >= 19 && hour <= 23) {
			return 2 * 60 * 1000; // 2 minutes during Monday games
		}

		// Outside game windows: poll every 5 minutes to reduce API load
		return 5 * 60 * 1000; // 5 minutes
	}

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

	static async getCurrentWeek(autoAdvance: boolean = true): Promise<number> {
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
					const espnWeek = data.week?.number || this.calculateCurrentWeek();

					// Only auto-advance if requested (for scoring, not for pick reminders)
					if (autoAdvance && data.events && data.events.length > 0) {
						const allGamesCompleted = data.events.every((event: EspnEvent) => {
							const status = event.status?.type?.state?.toLowerCase();
							return status === 'post' || status === 'final';
						});

						if (allGamesCompleted && espnWeek < 18) {
							console.log(`[NFLService] All Week ${espnWeek} games completed, advancing to Week ${espnWeek + 1}`);
							return espnWeek + 1;
						}
					}

					return espnWeek;
				}
			} else {
				// On client, use proxy API
				const url = '/api/nfl/scoreboard';
				const data = await cachedFetch<{ week: { number: number }, events: EspnEvent[] }>(url, {}, 10 * 60 * 1000);
				const espnWeek = data.week?.number || this.calculateCurrentWeek();

				// Only auto-advance if requested
				if (autoAdvance && data.events && data.events.length > 0) {
					const allGamesCompleted = data.events.every((event: EspnEvent) => {
						const status = event.status?.type?.state?.toLowerCase();
						return status === 'post' || status === 'final';
					});

					if (allGamesCompleted && espnWeek < 18) {
						console.log(`[NFLService] All Week ${espnWeek} games completed, advancing to Week ${espnWeek + 1}`);
						return espnWeek + 1;
					}
				}

				return espnWeek;
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

	/**
	 * Fetch detailed game summary with live clock, period, and odds data
	 * @param gameId ESPN game ID
	 * @returns Enhanced game data with live info
	 */
	static async getGameSummary(gameId: string): Promise<Partial<Game> | null> {
		try {
			const espnUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/summary?region=us&lang=en&contentorigin=espn&event=${gameId}`;

			const response = await fetch(espnUrl, {
				headers: {
					'User-Agent': 'pick-5/1.0',
					Accept: 'application/json'
				},
				next: { revalidate: 30 } // Cache for 30 seconds during live games
			});

			if (!response.ok) {
				console.error(`ESPN Summary API error for game ${gameId}: ${response.status}`);
				return null;
			}

			const data: EspnGameSummary = await response.json();

			// Extract live game info
			const competition = data.header?.competitions?.[0];
			const status = competition?.status;
			const period = status?.period?.number;
			const clock = status?.clock?.displayValue;
			const state = status?.type?.state;

			// Get period display (Q1, Q2, Q3, Q4, OT, etc.)
			const getPeriodDisplay = (periodNum?: number): string | undefined => {
				if (!periodNum) return undefined;
				if (periodNum <= 4) return `Q${periodNum}`;
				return 'OT';
			};

			// Extract odds from pickcenter
			const odds = data.pickcenter?.[0];
			const homeOdds = odds?.homeTeamOdds?.moneyLine;
			const awayOdds = odds?.awayTeamOdds?.moneyLine;

			// Extract scores
			const homeTeam = competition?.competitors?.find(team => team.homeAway === 'home');
			const awayTeam = competition?.competitors?.find(team => team.homeAway === 'away');

			return {
				clock,
				period,
				periodDisplay: getPeriodDisplay(period),
				status: state,
				home: {
					score: homeTeam?.score ? parseInt(homeTeam.score) : undefined,
					odds: homeOdds,
					team: homeTeam?.team?.displayName || '',
					abbreviation: homeTeam?.team?.abbreviation || '',
					logo: homeTeam?.team?.logo || '',
					record: homeTeam?.records?.[0]?.summary || ''
				},
				away: {
					score: awayTeam?.score ? parseInt(awayTeam.score) : undefined,
					odds: awayOdds,
					team: awayTeam?.team?.displayName || '',
					abbreviation: awayTeam?.team?.abbreviation || '',
					logo: awayTeam?.team?.logo || '',
					record: awayTeam?.records?.[0]?.summary || ''
				}
			};
		} catch (error) {
			console.error(`Error fetching game summary for ${gameId}:`, error);
			return null;
		}
	}

	/**
	 * Enrich existing games with live data from summary API
	 * @param games Base game data from scoreboard
	 * @returns Games enriched with live clock/period data
	 */
	static async enrichGamesWithLiveData(games: Game[]): Promise<Game[]> {
		// Only fetch live data for in-progress games
		const liveGames = games.filter(g => g.status === 'in' || g.status === 'in_progress');

		if (liveGames.length === 0) {
			return games;
		}

		// Fetch summaries in parallel
		const summaries = await Promise.all(liveGames.map(game => this.getGameSummary(game.id)));

		// Merge summary data into games
		return games.map(game => {
			const summaryIndex = liveGames.findIndex(g => g.id === game.id);
			if (summaryIndex === -1) return game;

			const summary = summaries[summaryIndex];
			if (!summary) return game;

			return {
				...game,
				clock: summary.clock,
				period: summary.period,
				periodDisplay: summary.periodDisplay,
				home: {
					...game.home,
					score: summary.home?.score ?? game.home.score,
					odds: summary.home?.odds ?? game.home.odds
				},
				away: {
					...game.away,
					score: summary.away?.score ?? game.away.score,
					odds: summary.away?.odds ?? game.away.odds
				}
			};
		});
	}
}
