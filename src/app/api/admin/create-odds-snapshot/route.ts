import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { connectDB } from '@/lib/db';
import { OddsSnapshot } from '@/models/OddsSnapshot';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to manually create an odds snapshot for a specific game
 * Useful for fixing games that already started before we had snapshots
 */
export async function POST(req: Request) {
	try {
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		const { gameId, week, season, homeTeam, awayTeam, homeOdds, awayOdds } = await req.json();

		if (!gameId || !week || !homeTeam || !awayTeam || homeOdds === undefined || awayOdds === undefined) {
			return NextResponse.json(
				{
					error: 'Missing required fields',
					required: ['gameId', 'week', 'homeTeam', 'awayTeam', 'homeOdds', 'awayOdds']
				},
				{ status: 400 }
			);
		}

		await connectDB();

		const currentSeason = season || new Date().getFullYear();

		console.log(`[Admin] Creating odds snapshot for ${awayTeam} @ ${homeTeam}, Week ${week}`);

		// Upsert the odds snapshot
		const snapshot = await OddsSnapshot.findOneAndUpdate(
			{
				week: parseInt(week),
				season: currentSeason,
				gameId: gameId
			},
			{
				week: parseInt(week),
				season: currentSeason,
				gameId: gameId,
				homeTeam: homeTeam,
				awayTeam: awayTeam,
				homeOdds: parseInt(homeOdds),
				awayOdds: parseInt(awayOdds),
				commenceTime: new Date(),
				lastUpdated: new Date(),
				source: 'admin-manual'
			},
			{
				upsert: true,
				new: true
			}
		);

		console.log(`[Admin] Created/updated odds snapshot:`, snapshot);

		return NextResponse.json({
			success: true,
			message: `Odds snapshot created for ${awayTeam} @ ${homeTeam}`,
			snapshot: {
				gameId: snapshot.gameId,
				week: snapshot.week,
				season: snapshot.season,
				homeTeam: snapshot.homeTeam,
				awayTeam: snapshot.awayTeam,
				homeOdds: snapshot.homeOdds,
				awayOdds: snapshot.awayOdds
			}
		});
	} catch (error) {
		console.error('[Admin] Error creating odds snapshot:', error);
		return NextResponse.json(
			{
				error: 'Failed to create odds snapshot',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
