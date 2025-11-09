import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { OddsSnapshot } from '@/models/OddsSnapshot';
import { NFLService } from '@/services/nflService';

export const dynamic = 'force-dynamic';

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
	commence_time: string;
	bookmakers: OddsApiBookmaker[];
}

/**
 * Cron job endpoint to fetch and store odds snapshots
 * This should be called 2-3 times per week:
 * - Tuesday: When odds first become available
 * - Friday: To capture any major line movements
 * - Sunday morning: Final odds before games start
 */
export async function GET(req: Request) {
	try {
		// Verify this is being called by Vercel Cron
		const authHeader = req.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In development, allow without auth. In production, require cron secret
		if (process.env.NODE_ENV === 'production') {
			if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		console.log('[Odds Cron] Starting odds snapshot fetch...');

		const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
		if (!apiKey) {
			console.error('[Odds Cron] No API key configured');
			return NextResponse.json({ error: 'Odds API not configured' }, { status: 500 });
		}

		await connectDB();

		// Fetch odds from The Odds API
		const response = await fetch(
			`https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`
		);

		if (!response.ok) {
			console.error('[Odds Cron] Failed to fetch odds:', response.status);
			return NextResponse.json({ error: 'Failed to fetch odds' }, { status: response.status });
		}

		const oddsData: OddsApiGame[] = await response.json();
		console.log(`[Odds Cron] Fetched odds for ${oddsData.length} games from API`);

		// Get current week and season
		const currentWeek = await NFLService.getCurrentWeek();
		const currentSeason = new Date().getFullYear();

		// Fetch weekly games from ESPN to match game IDs
		const weeklyGames = await NFLService.getWeeklyGames(currentWeek);

		let snapshotsCreated = 0;
		let snapshotsUpdated = 0;
		let snapshotsSkipped = 0;

		// Process each game from the odds API
		for (const oddsGame of oddsData) {
			// Check if game has already started
			const gameStartTime = new Date(oddsGame.commence_time);
			const now = new Date();
			if (now >= gameStartTime) {
				console.log(`[Odds Cron] Skipping started game: ${oddsGame.away_team} @ ${oddsGame.home_team}`);
				snapshotsSkipped++;
				continue;
			}

			// Find matching ESPN game by team names
			const espnGame = weeklyGames.find(
				g => g.home.team === oddsGame.home_team && g.away.team === oddsGame.away_team
			);

			if (!espnGame) {
				console.warn(`[Odds Cron] No ESPN game found for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
				continue;
			}

			// Extract odds from bookmaker
			const bookmaker = oddsGame.bookmakers[0];
			if (!bookmaker) {
				console.warn(`[Odds Cron] No bookmaker data for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
				continue;
			}

			const market = bookmaker.markets.find((m: OddsApiMarket) => m.key === 'h2h');
			if (!market) {
				console.warn(`[Odds Cron] No h2h market for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
				continue;
			}

			const homeOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === oddsGame.home_team);
			const awayOutcome = market.outcomes.find((o: OddsApiOutcome) => o.name === oddsGame.away_team);

			if (!homeOutcome || !awayOutcome) {
				console.warn(`[Odds Cron] Missing outcomes for ${oddsGame.away_team} @ ${oddsGame.home_team}`);
				continue;
			}

			const homeOdds = parseInt(String(homeOutcome.price));
			const awayOdds = parseInt(String(awayOutcome.price));

			// Upsert the odds snapshot
			const result = await OddsSnapshot.findOneAndUpdate(
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
					commenceTime: gameStartTime,
					lastUpdated: new Date(),
					source: 'odds-api'
				},
				{
					upsert: true,
					new: true
				}
			);

			if (result) {
				// Check if this was an insert (created) or update
				const existing = await OddsSnapshot.findOne({
					week: currentWeek,
					season: currentSeason,
					gameId: espnGame.id
				}).lean();

				if (existing && existing.lastUpdated.getTime() === result.lastUpdated.getTime()) {
					snapshotsCreated++;
					console.log(`[Odds Cron] Created snapshot for ${oddsGame.away_team} @ ${oddsGame.home_team} (${espnGame.id}): ${awayOdds}/${homeOdds}`);
				} else {
					snapshotsUpdated++;
					console.log(`[Odds Cron] Updated snapshot for ${oddsGame.away_team} @ ${oddsGame.home_team} (${espnGame.id}): ${awayOdds}/${homeOdds}`);
				}
			}
		}

		const summary = {
			success: true,
			week: currentWeek,
			season: currentSeason,
			totalGames: oddsData.length,
			snapshotsCreated,
			snapshotsUpdated,
			snapshotsSkipped,
			timestamp: new Date().toISOString()
		};

		console.log('[Odds Cron] Completed:', summary);
		return NextResponse.json(summary);
	} catch (error) {
		console.error('[Odds Cron] Error:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch and store odds',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
