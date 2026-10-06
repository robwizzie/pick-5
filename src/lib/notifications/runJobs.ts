// src/lib/notifications/runJobs.ts
// Runs scheduled jobs one after another; one job failing never stops the others.
import { OddsService } from '@/services/oddsService';
import type { CronTrigger, JobName } from './schedule';
import { runGameResultsJob } from './jobs/gameResults';
import { runPickRemindersJob } from './jobs/pickReminders';
import { runScoreEmailsJob } from './jobs/scoreEmails';
import { runWeeklyRecapJob } from './jobs/weeklyRecap';
import { errorMessage } from './runtime';

export interface JobOutcome {
	job: JobName;
	ok: boolean;
	ms: number;
	result?: unknown;
	error?: string;
}

/**
 * Wall-clock budget per job. The 10-minute tick only runs the (quick) game-results job; hourly
 * runs may spend longer, and anything left over is resumed by the next run via the markers.
 */
function budgetFor(trigger: CronTrigger): number {
	if (trigger === 'tick') return 60_000;
	if (trigger === 'hourly') return 4 * 60_000;
	return 90_000; // manual / legacy Vercel runs (300 s function limit)
}

// Fast jobs first so a slow email batch can't starve them.
const ORDER: JobName[] = ['game-results', 'fetch-odds', 'weekly-recap', 'pick-reminder-thursday', 'pick-reminder-saturday', 'score-emails'];

export async function runJob(job: JobName, budgetMs: number, opts: { includeAllFinal?: boolean } = {}): Promise<unknown> {
	switch (job) {
		case 'game-results':
			return runGameResultsJob({ budgetMs, includeAllFinal: opts.includeAllFinal });
		case 'pick-reminder-thursday':
			return runPickRemindersJob('thursday', { budgetMs });
		case 'pick-reminder-saturday':
			return runPickRemindersJob('saturday', { budgetMs });
		case 'score-emails':
			return runScoreEmailsJob({ budgetMs });
		case 'weekly-recap':
			return runWeeklyRecapJob({ budgetMs });
		case 'fetch-odds': {
			const result = await OddsService.fetchAndStoreOdds();
			if (!result.success) throw new Error(result.error || 'Failed to fetch and store odds');
			return result;
		}
	}
}

export async function runJobs(jobs: JobName[], trigger: CronTrigger): Promise<JobOutcome[]> {
	const outcomes: JobOutcome[] = [];
	const budget = budgetFor(trigger);
	for (const job of ORDER.filter(j => jobs.includes(j))) {
		const started = Date.now();
		try {
			const result = await runJob(job, budget);
			outcomes.push({ job, ok: true, ms: Date.now() - started, result });
		} catch (error) {
			console.error(`[Cron] ${job} failed:`, error);
			outcomes.push({ job, ok: false, ms: Date.now() - started, error: errorMessage(error) });
		}
	}
	return outcomes;
}
