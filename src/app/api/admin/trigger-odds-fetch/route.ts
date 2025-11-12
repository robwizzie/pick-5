import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { OddsService } from '@/services/oddsService';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to manually trigger odds fetch
 * This bypasses the cron secret requirement for emergency manual fetches
 */
export async function POST(req: Request) {
	try {
		// Verify user is admin
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		// Parse request body for optional week parameter
		const body = await req.json().catch(() => ({}));
		const targetWeek = body.week ? parseInt(body.week) : undefined;

		console.log(`[Admin Trigger] ${session.user?.email} manually triggering odds fetch${targetWeek ? ` for week ${targetWeek}` : ''}`);

		// Call the shared service function directly
		const result = await OddsService.fetchAndStoreOdds(targetWeek);

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
