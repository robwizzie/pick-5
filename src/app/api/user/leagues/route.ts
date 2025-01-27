import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const leagues = await League.find({ members: session.user.id });
		return NextResponse.json(leagues);
	} catch (error) {
		console.error('Error fetching user leagues:', error);
		return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
	}
}
