import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { connectDB } from '@/lib/db';
import { OddsSnapshot } from '@/models/OddsSnapshot';
import { NFLService } from '@/services/nflService';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to get all games and check which ones are missing odds snapshots
 */
export async function GET(req: Request) {
	try {
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const weekParam = searchParams.get('week');
		const week = weekParam ? parseInt(weekParam) : await NFLService.getCurrentWeek();
		const season = new Date().getFullYear();

		// Fetch all games for the week
		const weeklyGames = await NFLService.getWeeklyGames(week);

		await connectDB();

		// Fetch all odds snapshots for this week
		const snapshots = await OddsSnapshot.find({ week, season }).lean();
		const snapshotGameIds = new Set(snapshots.map(s => s.gameId));

		// Build response with games and whether they have odds
		const gamesWithOddsStatus = weeklyGames.map(game => ({
			id: game.id,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status,
			date: game.date,
			homeScore: game.home.score,
			awayScore: game.away.score,
			hasOdds: snapshotGameIds.has(game.id)
		}));

		// Sort: games without odds first, then by date
		gamesWithOddsStatus.sort((a, b) => {
			if (a.hasOdds !== b.hasOdds) {
				return a.hasOdds ? 1 : -1; // Put games without odds first
			}
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

		const missingCount = gamesWithOddsStatus.filter(g => !g.hasOdds).length;
		const hasOddsCount = gamesWithOddsStatus.filter(g => g.hasOdds).length;

		return NextResponse.json({
			week,
			season,
			totalGames: gamesWithOddsStatus.length,
			missingOdds: missingCount,
			hasOdds: hasOddsCount,
			games: gamesWithOddsStatus
		});
	} catch (error) {
		console.error('[Admin] Error fetching games missing odds:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch games',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
