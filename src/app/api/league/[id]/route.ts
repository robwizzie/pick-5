import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic'; // Ensure dynamic behavior

export async function GET(req: Request, context: { params: { id: string } }) {
	try {
		// Connect to the database
		await connectDB();

		// Ensure params is resolved before use
		const resolvedParams = await context.params;
		const { id } = resolvedParams;

		// Log the resolved params for debugging
		console.log('[API Debug] Resolved Params:', resolvedParams);
		console.log('[API Debug] Extracted ID:', id);

		// Ensure `id` is available
		if (!id) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		// Find the league by ID
		const league = await League.findById(id);

		// Log the league data
		console.log('[API Debug] League Data:', league);

		// Handle the case where the league is not found
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Return the league data
		return NextResponse.json(league);
	} catch (error) {
		console.error('[API Debug] Error fetching league:', error);
		return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
	}
}

export async function PATCH(req: Request, context: { params: { id: string } }) {
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
		const { name } = body;

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

		// Save the updated league
		await league.save();

		return NextResponse.json({ success: true, league });
	} catch (error) {
		console.error('[API Debug] Error updating league:', error);
		return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
	}
}
