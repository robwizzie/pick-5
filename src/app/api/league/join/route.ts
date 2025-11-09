import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { leagueId, password } = body;

		if (!leagueId || !password) {
			return NextResponse.json({ error: 'Please provide league ID and password' }, { status: 400 });
		}

		await connectDB();

		// Find the league by ID and verify password
		const league = await League.findById(leagueId);

		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Verify the password matches
		if (league.password !== password) {
			return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
		}

		// Check if the user is already a member
		if (league.members.includes(session.user.id)) {
			return NextResponse.json({
				error: 'You are already a member of this league',
				league: {
					id: league._id.toString(),
					name: league.name
				}
			}, { status: 400 });
		}

		// Add the user to the league
		league.members.push(session.user.id);
		await league.save();

		return NextResponse.json({
			success: true,
			league: {
				id: league._id.toString(),
				name: league.name
			}
		});
	} catch (error: unknown) {
		console.error('Error joining league:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error('Error details:', { message: errorMessage, stack: errorStack });
		return NextResponse.json({
			error: 'Failed to join league',
			details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
		}, { status: 500 });
	}
}
