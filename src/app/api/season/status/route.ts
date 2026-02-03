// src/app/api/season/status/route.ts
import { NextResponse } from 'next/server';
import { SeasonService } from '@/services/seasonService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/season/status
 * Get the current season status (public endpoint)
 */
export async function GET() {
	try {
		const status = await SeasonService.getSeasonStatus();
		return NextResponse.json(status);
	} catch (error) {
		console.error('[Season Status API] Error getting season status:', error);
		return NextResponse.json(
			{ error: 'Failed to get season status' },
			{ status: 500 }
		);
	}
}
