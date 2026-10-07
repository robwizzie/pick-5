import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/runtime';
import { runJob } from '@/lib/notifications/runJobs';
import { easternTime } from '@/lib/notifications/schedule';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Pick reminders. `?kind=thursday|saturday` (default: Thursday on Thursdays ET, else Saturday).
 * Normally run by /api/cron/master; kept for manual runs. Idempotent: safe to call repeatedly.
 */
export async function GET(req: Request) {
	if (!isAuthorizedCron(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const param = new URL(req.url).searchParams.get('kind');
		const kind = param === 'thursday' || param === 'saturday' ? param : easternTime(new Date()).weekday === 'Thu' ? 'thursday' : 'saturday';
		return NextResponse.json(await runJob(kind === 'thursday' ? 'pick-reminder-thursday' : 'pick-reminder-saturday', 240_000));
	} catch (error) {
		console.error('[Cron] send-pick-reminders failed:', error);
		return NextResponse.json({ error: 'Cron job failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
