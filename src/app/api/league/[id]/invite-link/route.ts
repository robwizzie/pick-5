// src/app/api/league/[id]/invite-link/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const league = await League.findById(params.id);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Only the commissioner (creator) can get the invite link
		if (league.creatorId !== session.user.id) {
			return NextResponse.json({ error: 'Only the commissioner can access the invite link' }, { status: 403 });
		}

		// Generate the full invite URL
		const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
		const inviteUrl = `${baseUrl}/league/join/${league.inviteCode}`;

		return NextResponse.json({
			inviteCode: league.inviteCode,
			inviteUrl
		});
	} catch (error) {
		console.error('Error fetching invite link:', error);
		return NextResponse.json({ error: 'Failed to fetch invite link' }, { status: 500 });
	}
}
