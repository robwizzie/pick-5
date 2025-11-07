import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Generate a unique, URL-safe invite code
function generateInviteCode(): string {
	return crypto.randomBytes(12).toString('base64url'); // Creates a 16-character URL-safe string
}

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

		// Generate a unique invite code
		let inviteCode = generateInviteCode();
		let attempts = 0;
		const maxAttempts = 5;

		// Ensure the invite code is unique (very unlikely to collide, but check anyway)
		while (attempts < maxAttempts) {
			const existing = await League.findOne({ inviteCode });
			if (!existing) break;
			inviteCode = generateInviteCode();
			attempts++;
		}

		if (attempts === maxAttempts) {
			throw new Error('Failed to generate unique invite code');
		}

		// Create a new league with creatorId and inviteCode
		const newLeague = await League.create({
			sport,
			mode: scoringMode,
			name,
			password,
			creatorId: session.user.id, // Set creatorId from the session
			members: [session.user.id], // Add creator to the league members
			inviteCode
		});

		return NextResponse.json(newLeague, { status: 201 });
	} catch (error) {
		console.error('Error creating league:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
