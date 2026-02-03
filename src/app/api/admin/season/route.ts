// src/app/api/admin/season/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ADMIN_USER_ID } from '@/lib/constants';
import { SeasonService } from '@/services/seasonService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/season
 * Get the current season status
 */
export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const status = await SeasonService.getSeasonStatus();
		return NextResponse.json(status);
	} catch (error) {
		console.error('[Season Admin API] Error getting season status:', error);
		return NextResponse.json(
			{ error: 'Failed to get season status' },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/admin/season
 * Manage season state (archive, deactivate, start new season)
 */
export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { action } = body;

		switch (action) {
			case 'deactivate': {
				// Deactivate the current season (stop accepting picks, stop sending notifications)
				await SeasonService.deactivateSeason();
				return NextResponse.json({
					success: true,
					message: 'Season has been deactivated'
				});
			}

			case 'archive': {
				// Archive the current season (save standings to history)
				const result = await SeasonService.archiveSeason();
				return NextResponse.json({
					success: result.success,
					leaguesArchived: result.leaguesArchived,
					errors: result.errors,
					message: result.success
						? `Successfully archived ${result.leaguesArchived} leagues`
						: 'Failed to archive season'
				});
			}

			case 'start_new': {
				// Start a new season
				const result = await SeasonService.startNewSeason();
				return NextResponse.json({
					success: result.success,
					message: result.message
				});
			}

			default:
				return NextResponse.json(
					{ error: 'Invalid action. Valid actions: deactivate, archive, start_new' },
					{ status: 400 }
				);
		}
	} catch (error) {
		console.error('[Season Admin API] Error managing season:', error);
		return NextResponse.json(
			{
				error: 'Failed to manage season',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
