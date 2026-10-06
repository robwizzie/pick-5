import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic';

/** The signed-in user's most recently created league (used after creating one). */
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();
		const latestLeague = await League.findOne({ creatorId: session.user.id }).sort({ createdAt: -1 }).exec();
		if (!latestLeague) {
			return NextResponse.json({ error: 'No leagues found' }, { status: 404 });
		}

		return NextResponse.json(latestLeague);
	} catch (error) {
		console.error('Error fetching latest league:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
