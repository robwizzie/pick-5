import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OddsService } from '@/services/oddsService';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to manually trigger odds fetch
 * This bypasses the cron secret requirement for emergency manual fetches
 */
export async function POST(req: Request) {
	try {
		// Verify user is authenticated (basic protection)
		const session = await getServerSession(authOptions);

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - must be logged in' }, { status: 401 });
		}

		console.log(`[Admin Trigger] ${session.user?.email} manually triggering odds fetch`);

		// Call the shared service function directly
		const result = await OddsService.fetchAndStoreOdds();

		if (!result.success) {
			return NextResponse.json(
				{
					error: 'Failed to fetch odds',
					details: result.error
				},
				{ status: 500 }
			);
		}

		console.log('[Admin Trigger] Odds fetch completed:', result);

		return NextResponse.json({
			success: true,
			message: 'Odds fetched successfully',
			result
		});
	} catch (error) {
		console.error('[Admin Trigger] Error:', error);
		return NextResponse.json(
			{
				error: 'Failed to trigger odds fetch',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
