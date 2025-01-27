import { NextResponse } from 'next/server';
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
