import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/runtime';
import { runJob } from '@/lib/notifications/runJobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly results emails for the last fully completed week.
 * Normally run by /api/cron/master; kept for manual runs. Idempotent: safe to call repeatedly.
 */
export async function GET(req: Request) {
	if (!isAuthorizedCron(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		return NextResponse.json(await runJob('score-emails', 240_000));
	} catch (error) {
		console.error('[Cron] send-score-emails failed:', error);
		return NextResponse.json({ error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
