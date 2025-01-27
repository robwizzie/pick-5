import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { password } = body;

		if (!password) {
			return NextResponse.json({ error: 'Please provide a league password' }, { status: 400 });
		}

		await connectDB();

		// Find the league by password
		const league = await League.findOne({ password });

		if (!league) {
			return NextResponse.json({ error: 'Invalid password or league not found' }, { status: 404 });
		}

		// Check if the user is already a member
		if (league.members.includes(session.user.id)) {
			return NextResponse.json({ error: 'You are already a member of this league' }, { status: 400 });
		}

		// Add the user to the league
		league.members.push(session.user.id);
		await league.save();

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error joining league:', error);
		return NextResponse.json({ error: 'Failed to join league' }, { status: 500 });
	}
}
