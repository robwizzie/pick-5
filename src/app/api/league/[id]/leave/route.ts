import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: leagueId } = await params;

		await connectDB();

		// Find the league
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Check if user is the commissioner
		if (league.creatorId === session.user.id) {
			return NextResponse.json({
				error: 'Commissioners cannot leave their own league. Please transfer ownership or delete the league.'
			}, { status: 400 });
		}

		// Check if user is a member
		if (!league.members.includes(session.user.id)) {
			return NextResponse.json({ error: 'You are not a member of this league' }, { status: 400 });
		}

		// Remove user from league members
		league.members = league.members.filter((memberId: string) => memberId !== session.user.id);
		await league.save();

		// Delete all of user's picks for this league
		await Pick.deleteMany({
			userId: session.user.id,
			leagueId: leagueId
		});

		return NextResponse.json({
			success: true,
			message: 'Successfully left the league'
		});
	} catch (error: unknown) {
		console.error('Error leaving league:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error('Error details:', { message: errorMessage, stack: errorStack });
		return NextResponse.json({
			error: 'Failed to leave league',
			details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
		}, { status: 500 });
	}
}
