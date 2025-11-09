import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { OddsSnapshot } from '@/models/OddsSnapshot';
import { NFLService } from '@/services/nflService';

export const dynamic = 'force-dynamic';

/**
 * Get stored odds snapshots for a given week
 * This endpoint serves pre-game odds that have been fetched and stored by the cron job
 * This reduces API calls to The Odds API from ~hundreds to ~10-15 per month
 */
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const weekParam = searchParams.get('week');
		const seasonParam = searchParams.get('season');

		await connectDB();

		// Default to current week and season
		const week = weekParam ? parseInt(weekParam) : await NFLService.getCurrentWeek();
		const season = seasonParam ? parseInt(seasonParam) : new Date().getFullYear();

		// Fetch stored odds for the specified week
		const snapshots = await OddsSnapshot.find({
			week,
			season
		})
			.sort({ commenceTime: 1 })
			.lean();

		console.log(`[Odds Snapshot] Serving ${snapshots.length} stored odds for week ${week}, season ${season}`);

		// Transform to match the format expected by the frontend
		// Format: { id, home_team, away_team, home: { odds }, away: { odds } }
		const transformedData = snapshots.map(snapshot => ({
			id: snapshot.gameId,
			home_team: snapshot.homeTeam,
			away_team: snapshot.awayTeam,
			home: {
				odds: snapshot.homeOdds
			},
			away: {
				odds: snapshot.awayOdds
			},
			commence_time: snapshot.commenceTime,
			lastUpdated: snapshot.lastUpdated,
			source: snapshot.source
		}));

		return NextResponse.json({
			week,
			season,
			count: transformedData.length,
			odds: transformedData,
			lastUpdated: snapshots.length > 0 ? snapshots[0].lastUpdated : null
		});
	} catch (error) {
		console.error('[Odds Snapshot] Error:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch odds snapshots',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
