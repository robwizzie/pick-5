import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export async function POST(req: Request) {
	try {
		// Verify session
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Parse request body
		const { sport, scoringMode, name, password } = await req.json();
		if (!sport || !scoringMode || !name || !password) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Connect to the database
		await connectDB();

		// Create a new league with creatorId
		const newLeague = await League.create({
			sport,
			mode: scoringMode,
			name,
			password,
			creatorId: session.user.id, // Set creatorId from the session
			members: [session.user.id] // Add creator to the league members
		});

		return NextResponse.json(newLeague, { status: 201 });
	} catch (error) {
		console.error('Error creating league:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
