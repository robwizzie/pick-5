// src/lib/notifications/schedule.ts
// Pure scheduling helpers (no I/O): which notification jobs a cron invocation should run.
//
// Cron expressions are in UTC, but NFL windows are in US Eastern time and move with DST, so
// the crons fire on a broad UTC schedule and the decision is made here, in Eastern time.

/** Every 10 minutes during the hours that can contain a game finishing (see isGameWindow). */
export const CRON_GAME_TICK = '*/10 0-8,15-23 * * *';
/** Once an hour at :05 for reminders, score emails, recaps and odds. */
export const CRON_HOURLY = '5 * * * *';

export type CronTrigger = 'tick' | 'hourly' | 'all';

export type JobName =
	| 'game-results'
	| 'pick-reminder-thursday'
	| 'pick-reminder-saturday'
	| 'score-emails'
	| 'weekly-recap'
	| 'fetch-odds';

export const ALL_JOBS: readonly JobName[] = [
	'game-results',
	'pick-reminder-thursday',
	'pick-reminder-saturday',
	'score-emails',
	'weekly-recap',
	'fetch-odds'
];

export type EtWeekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface EasternTime {
	weekday: EtWeekday;
	hour: number; // 0-23
	minute: number;
}

const etFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/New_York',
	weekday: 'short',
	hour: 'numeric',
	minute: 'numeric',
	hourCycle: 'h23'
});

/** Weekday/hour/minute of `date` in America/New_York (DST-aware). */
export function easternTime(date: Date): EasternTime {
	const parts = etFormatter.formatToParts(date);
	const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
	return {
		weekday: get('weekday') as EtWeekday,
		hour: Number(get('hour')) % 24,
		minute: Number(get('minute'))
	};
}

/**
 * True when an NFL game could be finishing: 11:00 to 04:00 Eastern, any day (London games end
 * around 12:45 ET, a late Monday doubleheader around 01:15 ET; Thanksgiving, Christmas and
 * late-season Saturday games make the weekday unreliable). The game-results job then checks
 * ESPN for a game that actually went final recently before it touches the database.
 */
export function isGameWindow(date: Date): boolean {
	const { hour } = easternTime(date);
	return hour >= 11 || hour < 4;
}

/** Map the cron string the Worker received to a trigger kind. Unknown/missing -> 'all'. */
export function classifyTrigger(cron: string | null | undefined): CronTrigger {
	const normalized = cron?.trim().replace(/\s+/g, ' ');
	if (normalized === CRON_GAME_TICK) return 'tick';
	if (normalized === CRON_HOURLY) return 'hourly';
	return 'all';
}

/**
 * Jobs to run for a trigger at `date`. Every job is idempotent (dedupe markers), so windows
 * span several runs on purpose: a run that was cut off or failed is picked up by the next one.
 *
 * Eastern time:
 * - game-results: every tick inside isGameWindow
 * - fetch-odds: Tue 10:xx, Fri 10:xx, Sun 05:xx (one hourly run each; not deduped)
 * - pick-reminder-thursday: Thu 10:00-18:59 (job also stops at the Thursday kickoff)
 * - pick-reminder-saturday: Sat 10:00-17:59
 * - score-emails, weekly-recap: Tue 10:00 -> Thu 08:59, once the week's games are all final
 */
export function jobsForTrigger(trigger: CronTrigger, date: Date): JobName[] {
	const jobs: JobName[] = [];
	const { weekday, hour } = easternTime(date);

	if (trigger === 'tick' || trigger === 'all') {
		if (isGameWindow(date)) jobs.push('game-results');
	}

	if (trigger === 'hourly' || trigger === 'all') {
		if (weekday === 'Thu' && hour >= 10 && hour < 19) jobs.push('pick-reminder-thursday');
		if (weekday === 'Sat' && hour >= 10 && hour < 18) jobs.push('pick-reminder-saturday');

		const inResultsWindow = (weekday === 'Tue' && hour >= 10) || weekday === 'Wed' || (weekday === 'Thu' && hour < 9);
		if (inResultsWindow) jobs.push('score-emails', 'weekly-recap');

		const oddsSlot = (weekday === 'Tue' && hour === 10) || (weekday === 'Fri' && hour === 10) || (weekday === 'Sun' && hour === 5);
		if (oddsSlot) jobs.push('fetch-odds');
	}

	return jobs;
}

/** Parse `?jobs=a,b` (manual runs). Returns null when absent; throws on unknown names. */
export function parseJobList(value: string | null): JobName[] | null {
	if (!value) return null;
	const names = value
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
	const unknown = names.filter(n => !ALL_JOBS.includes(n as JobName));
	if (unknown.length > 0) throw new Error(`Unknown job(s): ${unknown.join(', ')}`);
	return names as JobName[];
}
