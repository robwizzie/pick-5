// src/app/api/picks/user/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { authOptions } from '@/lib/auth';
import { parseSeasonParam, seasonPickFilter } from '@/lib/season';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const week = searchParams.get('week');
		const leagueId = searchParams.get('leagueId');
		const userId = searchParams.get('userId') || (session.user as any).id;
		// Optional ?season=YYYY; defaults to the current season
		const seasonFilter = seasonPickFilter(parseSeasonParam(searchParams.get('season')));

		await connectDB();

		// If week is provided, return picks for that specific week
		if (week) {
			if (!leagueId) {
				return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
			}

			const picks = await Pick.findOne({
				userId,
				week: parseInt(week, 10),
				leagueId,
				...seasonFilter
			});

			if (!picks) {
				return NextResponse.json(null);
			}

			return NextResponse.json({
				picks: picks.picks,
				tfsGame: picks.tfsGame,
				tfsScore: picks.tfsScore,
				weeklyPoints: picks.weeklyPoints,
				correctPicks: picks.correctPicks,
				tfsPoints: picks.tfsPoints
			});
		}

		// If only leagueId is provided, return all picks for the user in that league
		if (leagueId) {
			const picks = await Pick.find({
				userId,
				leagueId,
				...seasonFilter
			}).sort({ week: 1 });

			return NextResponse.json(picks);
		}

		// If no params provided, return all picks for the user
		const picks = await Pick.find({ userId, ...seasonFilter }).sort({ week: 1 });
		return NextResponse.json(picks);
	} catch (error) {
		console.error('Error fetching user picks:', error);
		return NextResponse.json({ error: 'Error fetching user picks' }, { status: 500 });
	}
}

