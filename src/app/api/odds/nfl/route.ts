import { NextResponse } from 'next/server';

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

// Cache odds data for 1 hour to avoid excessive API calls
let oddsCache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

export async function GET() {
	try {
		// Check cache first
		if (oddsCache && Date.now() - oddsCache.timestamp < CACHE_DURATION) {
			console.log('[Odds API] Returning cached odds data');
			return NextResponse.json(oddsCache.data);
		}

		const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;

		if (!apiKey) {
			console.error('[Odds API] No API key configured');
			return NextResponse.json({ error: 'Odds API not configured' }, { status: 500 });
		}

		const response = await fetch(
			`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`,
			{ next: { revalidate: 3600 } } // Cache for 1 hour
		);

		if (!response.ok) {
			console.error('[Odds API] Failed to fetch odds:', response.status);
			return NextResponse.json({ error: 'Failed to fetch odds' }, { status: response.status });
		}

		const rawData: OddsApiGame[] = await response.json();

		// Transform the data to a simpler format
		const transformedData = rawData.map((game: OddsApiGame) => {
			// Get the first available bookmaker's odds
			const bookmaker = game.bookmakers[0];
			if (!bookmaker) {
				return {
					id: game.id,
					home_team: game.home_team,
					away_team: game.away_team,
					home: { odds: 0 },
					away: { odds: 0 }
				};
			}

			const market = bookmaker.markets.find((m: OddsApiMarket) => m.key === 'h2h');
			if (!market) {
				return {
					id: game.id,
					home_team: game.home_team,
					away_team: game.away_team,
					home: { odds: 0 },
					away: { odds: 0 }
				};
			}

			const homeOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === game.home_team);
			const awayOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === game.away_team);

			return {
				id: game.id,
				home_team: game.home_team,
				away_team: game.away_team,
				home: {
					odds: homeOutcome ? parseInt(String(homeOutcome.price)) : 0
				},
				away: {
					odds: awayOutcome ? parseInt(String(awayOutcome.price)) : 0
				}
			};
		});

		// Update cache
		oddsCache = {
			data: transformedData,
			timestamp: Date.now()
		};

		console.log(`[Odds API] Successfully fetched odds for ${transformedData.length} games`);
		return NextResponse.json(transformedData);
	} catch (error) {
		console.error('[Odds API] Error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
