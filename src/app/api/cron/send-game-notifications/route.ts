import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/runtime';
import { runJob } from '@/lib/notifications/runJobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Push game results for picks whose games went final (`?all=1`: every final game this week, not just recent ones).
 * Normally run by /api/cron/master; kept for manual runs. Idempotent: safe to call repeatedly.
 */
export async function GET(req: Request) {
	if (!isAuthorizedCron(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const includeAllFinal = new URL(req.url).searchParams.get('all') === '1';
		return NextResponse.json(await runJob('game-results', 90_000, { includeAllFinal }));
	} catch (error) {
		console.error('[Cron] send-game-notifications failed:', error);
		return NextResponse.json({ error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
