// src/app/api/picks/user/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { authOptions } from '@/lib/auth';

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

		console.log('[Picks API] Session user:', session.user);
		console.log('[Picks API] Extracted userId:', userId);
		console.log('[Picks API] Query params - week:', week, 'leagueId:', leagueId);

		await connectDB();

		// If week is provided, return picks for that specific week
		if (week) {
			if (!leagueId) {
				return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
			}

			const picks = await Pick.findOne({
				userId,
				week: parseInt(week, 10),
				leagueId
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
				leagueId
			}).sort({ week: 1 });

			console.log('[Picks API] Found', picks.length, 'picks for userId:', userId, 'leagueId:', leagueId);
			return NextResponse.json(picks);
		}

		// If no params provided, return all picks for the user
		const picks = await Pick.find({ userId }).sort({ week: 1 });
		console.log('[Picks API] Found', picks.length, 'picks for userId:', userId);
		return NextResponse.json(picks);
	} catch (error) {
		console.error('Error fetching user picks:', error);
		return NextResponse.json({ error: 'Error fetching user picks' }, { status: 500 });
	}
}

