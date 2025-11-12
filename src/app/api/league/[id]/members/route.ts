import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { User } from '@/models/User';
import { Pick } from '@/models/Pick';

export async function GET(req: Request, context: { params: { id: string } }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const resolvedParams = await context.params;
		const { id } = resolvedParams;

		const league = await League.findById(id);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Check if user is a member of this league
		// members is an array of user ID strings, not objects
		const isMember = league.members.some((userId: string) => userId.toString() === session.user.id);
		if (!isMember) {
			return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
		}

		// Fetch user details for all members
		// members array already contains user IDs
		const users = await User.find({ _id: { $in: league.members } }).select('_id name image');

		return NextResponse.json(users);
	} catch (error) {
		console.error('Error fetching league members:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function DELETE(req: Request, context: { params: { id: string } }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const resolvedParams = await context.params;
		const { id } = resolvedParams;

		const league = await League.findById(id);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Only commissioner can remove members
		if (league.creatorId !== session.user.id) {
			return NextResponse.json({ error: 'Only the commissioner can remove members' }, { status: 403 });
		}

		// Get userId to remove from request body
		const body = await req.json();
		const { userId } = body;

		if (!userId) {
			return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
		}

		// Cannot remove the commissioner
		if (userId === league.creatorId) {
			return NextResponse.json({ error: 'Cannot remove the commissioner from the league' }, { status: 400 });
		}

		// Check if user is actually a member
		const memberIndex = league.members.indexOf(userId);
		if (memberIndex === -1) {
			return NextResponse.json({ error: 'User is not a member of this league' }, { status: 404 });
		}

		// Remove user from league members
		league.members.splice(memberIndex, 1);
		await league.save();

		// Delete all picks by this user in this league
		await Pick.deleteMany({ userId, leagueId: id });

		return NextResponse.json({ success: true, message: 'Member removed successfully' });
	} catch (error) {
		console.error('Error removing league member:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
