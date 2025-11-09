import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { User } from '@/models/User';

export async function GET(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const league = await League.findById(params.id);
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
