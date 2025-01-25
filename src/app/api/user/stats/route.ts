// src/app/api/user/stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { authOptions } from '@/lib/auth';

export async function GET() {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.email) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const user = await User.findOne({ email: session.user.email });

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({
			totalPoints: user.totalPoints,
			correctPicks: user.correctPicks,
			totalPicks: user.totalPicks,
			tfsPoints: user.tfsPoints
		});
	} catch (error) {
		console.error('Error fetching user stats:', error);
		return NextResponse.json({ error: 'Error fetching user stats' }, { status: 500 });
	}
}
