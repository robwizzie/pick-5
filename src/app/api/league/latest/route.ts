import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export async function GET() {
	try {
		await connectDB();

		// Fetch the most recently created league
		const latestLeague = await League.findOne().sort({ createdAt: -1 }).exec();
		if (!latestLeague) {
			return NextResponse.json({ error: 'No leagues found' }, { status: 404 });
		}

		return NextResponse.json(latestLeague);
	} catch (error) {
		console.error('Error fetching latest league:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
