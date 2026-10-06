import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/runtime';
import { classifyTrigger, jobsForTrigger, parseJobList, type CronTrigger } from '@/lib/notifications/schedule';
import { runJobs } from '@/lib/notifications/runJobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Single cron entry point. Cloudflare's scheduled handler (cloudflare/worker.ts) calls it with
 * `x-cron-trigger` (the cron expression that fired) and `x-cron-scheduled-time`; the jobs to run
 * are chosen from those in Eastern time (see src/lib/notifications/schedule.ts).
 *
 * Manual runs: `?trigger=tick|hourly|all` picks jobs by the current time, `?jobs=a,b` runs the
 * named jobs regardless of time. All jobs are idempotent, so re-running is safe.
 * Without a trigger (e.g. the legacy Vercel cron) every job whose time window is open runs.
 */
export async function GET(req: Request) {
	if (!isAuthorizedCron(req)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const url = new URL(req.url);
	const scheduledMs = Number(req.headers.get('x-cron-scheduled-time'));
	const now = Number.isFinite(scheduledMs) && scheduledMs > 0 ? new Date(scheduledMs) : new Date();
	const triggerParam = url.searchParams.get('trigger');
	const trigger: CronTrigger =
		triggerParam === 'tick' || triggerParam === 'hourly' || triggerParam === 'all' ? triggerParam : classifyTrigger(req.headers.get('x-cron-trigger'));

	let jobs;
	try {
		jobs = parseJobList(url.searchParams.get('jobs')) ?? jobsForTrigger(trigger, now);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Bad request' }, { status: 400 });
	}

	if (jobs.length === 0) {
		return NextResponse.json({ success: true, trigger, at: now.toISOString(), jobs: [] });
	}

	const outcomes = await runJobs(jobs, trigger);
	const failed = outcomes.filter(o => !o.ok).map(o => o.job);
	console.log(
		`[Cron] ${trigger} @ ${now.toISOString()}: ${outcomes.map(o => `${o.job}=${o.ok ? 'ok' : 'FAILED'}(${o.ms}ms)`).join(', ')}`
	);

	return NextResponse.json(
		{ success: failed.length === 0, trigger, at: now.toISOString(), tasksExecuted: outcomes },
		// A failed job marks the invocation as failed in Cloudflare's Cron Events.
		{ status: failed.length === 0 ? 200 : 500 }
	);
}
