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
		const userId = searchParams.get('userId');

		if (!week || !leagueId || !userId) {
			return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
		}

		await connectDB();

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
	} catch (error) {
		console.error('Error fetching user picks:', error);
		return NextResponse.json({ error: 'Error fetching user picks' }, { status: 500 });
	}
}

