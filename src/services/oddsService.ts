// src/services/oddsService.ts
import { connectDB } from '@/lib/db';
import { OddsSnapshot } from '@/models/OddsSnapshot';
import { NFLService } from '@/services/nflService';

interface OddsData {
	home: { odds: number; bookmaker: string };
	away: { odds: number; bookmaker: string };
	lastUpdated: Date;
}

interface OddsApiOutcome {
	name: string;
	price: string | number;
}

interface OddsApiMarket {
	key: string;
	outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
	title: string;
	markets: OddsApiMarket[];
}

interface OddsApiGame {
	id: string;
	home_team: string;
	away_team: string;
	commence_time?: string;
	bookmakers: OddsApiBookmaker[];
}

export interface OddsFetchResult {
	success: boolean;
	week?: number;
	season?: number;
	totalGames?: number;
	snapshotsCreated?: number;
	snapshotsUpdated?: number;
	snapshotsSkipped?: number;
	timestamp?: string;
	error?: string;
}

export class OddsService {
	// ODDS_API_KEY is preferred (server-only, read at runtime); NEXT_PUBLIC_ODDS_API_KEY kept for existing deployments.
	private static API_KEY = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
	private static BASE_URL = 'https://api.the-odds-api.com/v4';
	private static oddsCache: Record<string, { data: OddsData; timestamp: number }> = {};

	static async getGameOdds(gameId: string): Promise<OddsData | null> {
		// Check cache first
		const cached = this.oddsCache[gameId];
		if (cached && Date.now() - cached.timestamp < 3600000) {
			// 1 hour cache
			return cached.data;
		}

		try {
			const response = await fetch(`${this.BASE_URL}/sports/americanfootball_nfl/odds/?apiKey=${this.API_KEY}&regions=us&markets=h2h&oddsFormat=american`);

			if (!response.ok) {
				throw new Error('Failed to fetch odds');
			}

			const data = await response.json();
			const odds = this.formatOddsData(data, gameId);

			if (odds) {
				// Cache the result
				this.oddsCache[gameId] = {
					data: odds,
					timestamp: Date.now()
				};
			}

			return odds;
		} catch (error) {
			console.error('Error fetching odds:', error);
			return null;
		}
	}

	private static formatOddsData(rawData: OddsApiGame[], gameId: string): OddsData | null {
		const game = rawData.find((g: OddsApiGame) => g.id === gameId);
		if (!game) return null;

		const bestOdds = {
			home: { odds: 0, bookmaker: '' },
			away: { odds: 0, bookmaker: '' }
		};

		game.bookmakers.forEach((bookmaker: OddsApiBookmaker) => {
			const market = bookmaker.markets.find((m: OddsApiMarket) => m.key === 'h2h');
			if (!market) return;

			const homeOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === game.home_team);
			const awayOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === game.away_team);
			const homeOdds = homeOutcome ? parseInt(String(homeOutcome.price)) : 0;
			const awayOdds = awayOutcome ? parseInt(String(awayOutcome.price)) : 0;

			if (homeOdds > bestOdds.home.odds) {
				bestOdds.home = { odds: homeOdds, bookmaker: bookmaker.title };
			}
			if (awayOdds > bestOdds.away.odds) {
				bestOdds.away = { odds: awayOdds, bookmaker: bookmaker.title };
			}
		});

		return {
			home: bestOdds.home,
			away: bestOdds.away,
			lastUpdated: new Date()
		};
	}

	static calculatePotentialWin(odds: number, betAmount: number = 100): number {
		if (odds > 0) {
			return betAmount * (odds / 100);
		} else {
			return betAmount * (100 / Math.abs(odds));
		}
	}

	/**
	 * Shared service to fetch and store odds snapshots
	 * Can be called from cron jobs or admin endpoints
	 * @param targetWeek - Optional week number to fetch odds for (defaults to current week)
	 */
	static async fetchAndStoreOdds(targetWeek?: number): Promise<OddsFetchResult> {
		try {
			console.log('[OddsService] Starting odds snapshot fetch...');

			const apiKey = process.env.ODDS_API_KEY || process.env.NEXT_PUBLIC_ODDS_API_KEY;
			if (!apiKey) {
				console.error('[OddsService] No API key configured');
				return { success: false, error: 'Odds API not configured' };
			}

			await connectDB();

			// Fetch odds from The Odds API
			const response = await fetch(
				`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`
			);

			if (!response.ok) {
				console.error('[OddsService] Failed to fetch odds:', response.status);
				return { success: false, error: `Failed to fetch odds: ${response.status}` };
			}

			const oddsData: OddsApiGame[] = await response.json();
			console.log(`[OddsService] Fetched odds for ${oddsData.length} games from API`);

			// Get current week and season
			const currentWeek = targetWeek || (await NFLService.getCurrentWeek());
			const currentSeason = new Date().getFullYear();
			console.log(`[OddsService] Fetching odds for Week ${currentWeek}, Season ${currentSeason}`);

			// Fetch weekly games from ESPN to match game IDs
			const weeklyGames = await NFLService.getWeeklyGames(currentWeek);

			let snapshotsCreated = 0;
			let snapshotsUpdated = 0;
			let snapshotsSkipped = 0;

			// Process each game from the odds API
			for (const oddsGame of oddsData) {
				// Check if game has already started
				if (oddsGame.commence_time) {
					const gameStartTime = new Date(oddsGame.commence_time);
					const now = new Date();
					if (now >= gameStartTime) {
						console.log(`[OddsService] Skipping started game: ${oddsGame.away_team} @ ${oddsGame.home_team}`);
						snapshotsSkipped++;
						continue;
					}
				}

				// Find matching ESPN game by team names
				const espnGame = weeklyGames.find(
					g => g.home.team === oddsGame.home_team && g.away.team === oddsGame.away_team
				);

				if (!espnGame) {
					console.warn(`[OddsService] No ESPN game found for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
					continue;
				}

				// Extract odds from bookmaker
				const bookmaker = oddsGame.bookmakers[0];
				if (!bookmaker) {
					console.warn(`[OddsService] No bookmaker data for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
					continue;
				}

				const market = bookmaker.markets.find((m: OddsApiMarket) => m.key === 'h2h');
				if (!market) {
					console.warn(`[OddsService] No h2h market for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
					continue;
				}

				const homeOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === oddsGame.home_team);
				const awayOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === oddsGame.away_team);

				if (!homeOutcome || !awayOutcome) {
					console.warn(`[OddsService] Missing outcomes for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
					continue;
				}

				const homeOdds = parseInt(String(homeOutcome.price));
				const awayOdds = parseInt(String(awayOutcome.price));

				// Check if snapshot already exists to determine if this is create or update
				const existingSnapshot = await OddsSnapshot.findOne({
					week: currentWeek,
					season: currentSeason,
					gameId: espnGame.id
				});

				const isUpdate = !!existingSnapshot;

				// Upsert the odds snapshot
				await OddsSnapshot.findOneAndUpdate(
					{
						week: currentWeek,
						season: currentSeason,
						gameId: espnGame.id
					},
					{
						week: currentWeek,
						season: currentSeason,
						gameId: espnGame.id,
						homeTeam: oddsGame.home_team,
						awayTeam: oddsGame.away_team,
						homeOdds,
						awayOdds,
						commenceTime: oddsGame.commence_time ? new Date(oddsGame.commence_time) : new Date(),
						lastUpdated: new Date(),
						source: 'odds-api'
					},
					{
						upsert: true,
						new: true
					}
				);

				if (isUpdate) {
					snapshotsUpdated++;
					console.log(`[OddsService] Updated snapshot for ${oddsGame.away_team} @ ${oddsGame.home_team} (${espnGame.id}): ${awayOdds}/${homeOdds}`);
				} else {
					snapshotsCreated++;
					console.log(`[OddsService] Created snapshot for ${oddsGame.away_team} @ ${oddsGame.home_team} (${espnGame.id}): ${awayOdds}/${homeOdds}`);
				}
			}

			const result = {
				success: true,
				week: currentWeek,
				season: currentSeason,
				totalGames: oddsData.length,
				snapshotsCreated,
				snapshotsUpdated,
				snapshotsSkipped,
				timestamp: new Date().toISOString()
			};

			console.log('[OddsService] Completed:', result);
			return result;
		} catch (error) {
			console.error('[OddsService] Error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}
}
