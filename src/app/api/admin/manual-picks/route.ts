// src/app/api/admin/manual-picks/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// TODO: Add admin check if you want to restrict this endpoint
		// For now, any authenticated user can access

		const body = await req.json();
		const { userId, leagueId, week, picks, tfsGame, tfsScore } = body;

		// Validation
		if (!userId || !leagueId || !week || !picks || picks.length !== 5) {
			return NextResponse.json({ error: 'Invalid input: userId, leagueId, week, and 5 picks are required' }, { status: 400 });
		}

		await connectDB();

		// Verify user exists and is member of the league
		const user = await User.findById(userId);
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Check if user is member of the league
		const isMember = (league as any).members.some((memberId: any) => memberId.toString() === userId);
		if (!isMember) {
			return NextResponse.json({ error: 'User is not a member of this league' }, { status: 400 });
		}

		// Check if picks already exist for this user/league/week
		const existingPick = await Pick.findOne({ userId, leagueId, week });

		if (existingPick) {
			// Update existing picks
			existingPick.picks = picks;
			existingPick.tfsGame = tfsGame || null;
			existingPick.tfsScore = tfsScore || null;
			existingPick.submitted = true;
			existingPick.submittedAt = new Date();
			await existingPick.save();

			return NextResponse.json({
				message: `Successfully updated picks for ${user.name} in week ${week}`,
				pickId: existingPick._id
			});
		} else {
			// Create new pick
			const newPick = new Pick({
				userId,
				leagueId,
				week,
				picks,
				tfsGame: tfsGame || null,
				tfsScore: tfsScore || null,
				submitted: true,
				submittedAt: new Date()
			});

			await newPick.save();

			return NextResponse.json({
				message: `Successfully created picks for ${user.name} in week ${week}`,
				pickId: newPick._id
			});
		}
	} catch (error) {
		console.error('Error in manual picks admin:', error);
		return NextResponse.json({ error: 'Failed to process manual picks' }, { status: 500 });
	}
}
