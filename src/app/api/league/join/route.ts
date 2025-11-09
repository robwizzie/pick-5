import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		console.log('[Join League] Request started');
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			console.log('[Join League] Unauthorized - no session');
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		console.log('[Join League] User authenticated:', session.user.id);

		const body = await req.json();
		const { leagueId, password } = body;
		console.log('[Join League] Request data:', { leagueId, passwordProvided: !!password });

		if (!leagueId || !password) {
			console.log('[Join League] Missing leagueId or password');
			return NextResponse.json({ error: 'Please provide league ID and password' }, { status: 400 });
		}

		await connectDB();
		console.log('[Join League] Database connected');

		// Find the league by ID and verify password
		const league = await League.findById(leagueId);
		console.log('[Join League] League found:', !!league, league ? league.name : 'N/A');

		if (!league) {
			console.log('[Join League] League not found');
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		console.log('[Join League] Comparing password...');
		console.log('[Join League] comparePassword method exists:', typeof league.comparePassword === 'function');

		// Verify the password matches using bcrypt comparison
		if (typeof league.comparePassword !== 'function') {
			console.error('[Join League] ERROR: comparePassword method not found on league document');
			throw new Error('comparePassword method not found on league document');
		}

		const isPasswordValid = await league.comparePassword(password);
		console.log('[Join League] Password valid:', isPasswordValid);

		if (!isPasswordValid) {
			console.log('[Join League] Incorrect password');
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
