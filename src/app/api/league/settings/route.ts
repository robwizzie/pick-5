import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export async function GET(req: Request) {
	try {
		// Parse the URL to access searchParams
		const { searchParams } = new URL(req.url);

		// Example league ID; replace this logic with your actual league determination
		const leagueId = searchParams.get('leagueId');
		if (!leagueId) {
			return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
		}

		// Connect to the database and fetch league settings
		await connectDB();
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		return NextResponse.json({ mode: league.mode }); // Return the league's mode
	} catch (error) {
		console.error('Error fetching league settings:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
