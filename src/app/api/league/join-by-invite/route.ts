// src/app/api/league/join-by-invite/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { inviteCode } = await req.json();
		if (!inviteCode) {
			return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
		}

		await connectDB();

		// Find the league by invite code
		const league = await League.findOne({ inviteCode });
		if (!league) {
			return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
		}

		// Check if user is already a member
		if (league.members.includes(session.user.id)) {
			return NextResponse.json({
				message: 'Already a member',
				league: {
					id: league._id.toString(),
					name: league.name
				}
			});
		}

		// Add user to the league
		league.members.push(session.user.id);
		await league.save();

		return NextResponse.json({
			message: 'Successfully joined league',
			league: {
				id: league._id.toString(),
				name: league.name
			}
		});
	} catch (error) {
		console.error('Error joining league by invite:', error);
		return NextResponse.json({ error: 'Failed to join league' }, { status: 500 });
	}
}
