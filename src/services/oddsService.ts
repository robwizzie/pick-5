// src/services/oddsService.ts
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
	bookmakers: OddsApiBookmaker[];
}

export class OddsService {
	private static API_KEY = process.env.NEXT_PUBLIC_ODDS_API_KEY;
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
}
