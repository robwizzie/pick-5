// src/app/api/league/history/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { SeasonService } from '@/services/seasonService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/league/history?leagueId={id}&seasonYear={year}
 * Get the season history for a league
 * If seasonYear is not provided, returns all seasons
 */
export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const leagueId = searchParams.get('leagueId');
		const seasonYear = searchParams.get('seasonYear');

		if (!leagueId) {
			return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
		}

		await connectDB();

		// Verify user is a member of the league
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		const isMember = league.members.some((memberId: string) => memberId.toString() === session.user.id);
		if (!isMember) {
			return NextResponse.json({ error: 'You are not a member of this league' }, { status: 403 });
		}

		// Get history
		if (seasonYear) {
			const history = await SeasonService.getLeagueSeasonHistory(leagueId, parseInt(seasonYear, 10));
			if (!history) {
				return NextResponse.json({ error: 'No history found for this season' }, { status: 404 });
			}
			return NextResponse.json(history);
		} else {
			const history = await SeasonService.getLeagueHistory(leagueId);
			return NextResponse.json(history);
		}
	} catch (error) {
		console.error('[League History API] Error fetching history:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch league history',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
