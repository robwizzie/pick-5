// src/app/api/seasonStats/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Pick } from '@/models/Pick';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const userPicks = await Pick.find({ userId: session.user.id });
		const weeklyStats: Record<string, any> = {};

		userPicks.forEach(pick => {
			weeklyStats[pick.week] = {
				weeklyPoints: pick.weeklyPoints,
				correctPicks: pick.correctPicks,
				totalPicks: pick.picks.length,
				tfsPoints: pick.tfsPoints
			};
		});

		const totals = userPicks.reduce(
			(acc, pick) => ({
				totalPoints: acc.totalPoints + pick.weeklyPoints,
				correctPicks: acc.correctPicks + pick.correctPicks,
				totalPicks: acc.totalPicks + pick.picks.length,
				totalTFSPoints: acc.totalTFSPoints + pick.tfsPoints
			}),
			{
				totalPoints: 0,
				correctPicks: 0,
				totalPicks: 0,
				totalTFSPoints: 0
			}
		);

		return NextResponse.json({
			...totals,
			weeklyStats
		});
	} catch (error) {
		console.error('Error fetching season stats:', error);
		return NextResponse.json({ error: 'Failed to fetch season stats' }, { status: 500 });
	}
}
