import { NextResponse } from 'next/server';
import { NFLService } from '@/services/nflService';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const week = await NFLService.getCurrentWeek();
		return NextResponse.json({ week });
	} catch (error) {
		console.error('Error fetching current week:', error);
		return NextResponse.json({ error: 'Failed to fetch current week' }, { status: 500 });
	}
}
