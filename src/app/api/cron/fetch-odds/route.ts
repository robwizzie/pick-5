import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/runtime';
import { runJob } from '@/lib/notifications/runJobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Fetch and store an odds snapshot (master runs it Tue 10am, Fri 10am and Sun 5am ET).
 * Normally run by /api/cron/master; kept for manual runs. Idempotent: safe to call repeatedly.
 */
export async function GET(req: Request) {
	if (!isAuthorizedCron(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		return NextResponse.json(await runJob('fetch-odds', 60_000));
	} catch (error) {
		console.error('[Cron] fetch-odds failed:', error);
		return NextResponse.json({ error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
