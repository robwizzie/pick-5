// src/app/api/stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Pick } from '@/models/Pick';
import { authOptions } from '@/lib/auth';
import { WeeklyStats } from '@/types';

export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();
		const userPicks = await Pick.find({ userId: session.user.id });

		const weeklyStats: Record<string, { weeklyPoints: number; correctPicks: number; totalPicks: number; tfsPoints: number }> = {};
		let totalPoints = 0;
		let correctPicks = 0;
		let totalPicks = 0;
		let totalTFSPoints = 0;

		userPicks.forEach(pick => {
			weeklyStats[pick.week] = {
				weeklyPoints: pick.weeklyPoints,
				correctPicks: pick.correctPicks,
				totalPicks: pick.picks.length,
				tfsPoints: pick.tfsPoints
			};

			totalPoints += pick.weeklyPoints;
			correctPicks += pick.correctPicks;
			totalPicks += pick.picks.length;
			totalTFSPoints += pick.tfsPoints;
		});

		return NextResponse.json({
			weeklyStats,
			totalPoints,
			correctPicks,
			totalPicks,
			totalTFSPoints
		});
	} catch (error) {
		console.error('Error fetching stats:', error);
		return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
	}
}

export async function POST() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const allPicks = await Pick.find({ userId: session.user.id });
		const weeklyStatsMap: Record<number, WeeklyStats> = {};
		allPicks.forEach(pick => {
			weeklyStatsMap[pick.week] = {
				weeklyPoints: pick.weeklyPoints,
				correctPicks: pick.correctPicks,
				totalPicks: pick.picks.length,
				tfsPoints: pick.tfsPoints
			};
		});

		const totals = Object.values(weeklyStatsMap).reduce(
			(acc, stat) => ({
				totalPoints: acc.totalPoints + stat.weeklyPoints,
				correctPicks: acc.correctPicks + stat.correctPicks,
				totalPicks: acc.totalPicks + stat.totalPicks,
				totalTFSPoints: acc.totalTFSPoints + stat.tfsPoints
			}),
			{
				totalPoints: 0,
				correctPicks: 0,
				totalPicks: 0,
				totalTFSPoints: 0
			}
		);

		const seasonStats = {
			...totals,
			weeklyStats: weeklyStatsMap
		};

		await User.findByIdAndUpdate(session.user.id, { $set: seasonStats }, { new: true });

		return NextResponse.json(seasonStats);
	} catch (error) {
		console.error('Error updating stats:', error);
		return NextResponse.json({ error: 'Error updating stats' }, { status: 500 });
	}
}
