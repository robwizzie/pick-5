import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { cleanSettings } from '@/lib/leagueRules';

export const dynamic = 'force-dynamic'; // Ensure dynamic behavior

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await context.params;
		if (!id) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();
		const league = await League.findById(id);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Only members may view a league; the invite code is the commissioner's to share
		if (!league.members.map(String).includes(userId)) {
			return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
		}
		const data = league.toJSON();
		if (String(league.creatorId) !== userId) delete data.inviteCode;

		return NextResponse.json(data);
	} catch (error) {
		console.error('Error fetching league:', error);
		return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
	}
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		// Check authentication
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Connect to the database
		await connectDB();

		// Ensure params is resolved before use
		const resolvedParams = await context.params;
		const { id } = resolvedParams;

		if (!id) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		// Find the league
		const league = await League.findById(id);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Check if user is the commissioner
		if (league.creatorId !== session.user.id) {
			return NextResponse.json({ error: 'Only the commissioner can update league settings' }, { status: 403 });
		}

		// Get update data from request body
		const body = await req.json();
		const { name, password, settings } = body;

		// Validate and update fields
		if (name !== undefined) {
			if (typeof name !== 'string' || name.trim().length === 0) {
				return NextResponse.json({ error: 'League name cannot be empty' }, { status: 400 });
			}
			if (name.trim().length > 100) {
				return NextResponse.json({ error: 'League name is too long (max 100 characters)' }, { status: 400 });
			}
			league.name = name.trim();
		}

		if (password !== undefined) {
			if (typeof password !== 'string' || password.trim().length === 0) {
				return NextResponse.json({ error: 'Password cannot be empty' }, { status: 400 });
			}
			if (password.trim().length < 4) {
				return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
			}
			if (password.trim().length > 50) {
				return NextResponse.json({ error: 'Password is too long (max 50 characters)' }, { status: 400 });
			}
			// Password will be automatically hashed by the pre-save hook
			league.password = password.trim();
		}

		// Commissioner settings: trophy, punishment, lock multiplier, TFS on/off (merged into the current ones)
		if (settings !== undefined) {
			const cleaned = cleanSettings(settings);
			if ('error' in cleaned) {
				return NextResponse.json({ error: cleaned.error }, { status: 400 });
			}
			for (const [key, value] of Object.entries(cleaned.settings)) league.set(`settings.${key}`, value);
		}

		// Save the updated league
		await league.save();

		return NextResponse.json({ success: true, league });
	} catch (error) {
		console.error('[API Debug] Error updating league:', error);
		return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
	}
}
