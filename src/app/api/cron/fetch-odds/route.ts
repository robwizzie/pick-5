import { NextResponse } from 'next/server';
import { OddsService } from '@/services/oddsService';

export const dynamic = 'force-dynamic';

/**
 * Cron job endpoint to fetch and store odds snapshots
 * This should be called 2-3 times per week:
 * - Tuesday: When odds first become available
 * - Friday: To capture any major line movements
 * - Sunday morning: Final odds before games start
 */
export async function GET(req: Request) {
	try {
		// Verify this is being called by Vercel Cron
		const authHeader = req.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In development, allow without auth. In production, require cron secret
		if (process.env.NODE_ENV === 'production') {
			if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		console.log('[Odds Cron] Starting odds snapshot fetch via shared service...');

		// Call the shared service function
		const result = await OddsService.fetchAndStoreOdds();

		if (!result.success) {
			return NextResponse.json(
				{
					error: result.error || 'Failed to fetch and store odds',
					details: result.error
				},
				{ status: 500 }
			);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error('[Odds Cron] Error:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch and store odds',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
