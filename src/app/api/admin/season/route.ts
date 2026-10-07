// src/app/api/admin/season/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ADMIN_USER_ID } from '@/lib/constants';
import { SeasonService } from '@/services/seasonService';
import { getCurrentSeasonYear, runPickSeasonMigration } from '@/lib/season';

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
				// Archive a season's standings to history (default: current season;
				// pass `seasonYear` to archive an earlier one, e.g. last season after a restart)
				const currentSeason = getCurrentSeasonYear();
				const seasonYear = body.seasonYear === undefined || body.seasonYear === null || body.seasonYear === ''
					? currentSeason
					: Number(body.seasonYear);
				if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > currentSeason) {
					return NextResponse.json(
						{ error: `Invalid seasonYear: must be a year between 2000 and ${currentSeason}` },
						{ status: 400 }
					);
				}
				const dryRun = body.dryRun === true;
				const replace = body.replace === true;
				const result = await SeasonService.archiveSeason(seasonYear, { dryRun, replace });
				return NextResponse.json({
					success: result.success,
					seasonYear,
					dryRun,
					leaguesArchived: result.leaguesArchived,
					skipped: result.skipped,
					previews: result.previews,
					errors: result.errors,
					message: dryRun
						? `Preview: ${result.previews.length} league${result.previews.length === 1 ? '' : 's'} with picks in ${seasonYear}`
						: result.success
							? `Archived ${result.leaguesArchived} league${result.leaguesArchived === 1 ? '' : 's'} for ${seasonYear}${result.skipped ? ` (${result.skipped} skipped: no picks that season or already archived)` : ''}`
							: result.errors[0] || `Failed to archive season ${seasonYear}`
				});
			}

			case 'migrate_picks': {
				// Backfill `season` on legacy picks and swap the unique index (idempotent)
				const result = await runPickSeasonMigration();
				return NextResponse.json({
					success: true,
					...result,
					message: result.alreadyMigrated
						? 'Picks are already season-scoped'
						: `Backfilled season on ${result.backfilled} pick documents${result.droppedLegacyIndex ? '; dropped legacy unique index' : ''}`
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
					{ error: 'Invalid action. Valid actions: deactivate, archive, start_new, migrate_picks' },
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
