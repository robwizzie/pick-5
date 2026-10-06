// src/lib/notifications/runtime.ts
// Small shared helpers for the notification jobs: cron auth, run budgets, bounded concurrency.

/**
 * Cron routes are protected by `Authorization: Bearer $CRON_SECRET`. Outside production the
 * check is skipped when no secret is configured, so `next dev` can call them directly.
 */
export function isAuthorizedCron(req: Request): boolean {
	const cronSecret = process.env.CRON_SECRET;
	if (process.env.NODE_ENV !== 'production' && !cronSecret) return true;
	return !!cronSecret && req.headers.get('authorization') === `Bearer ${cronSecret}`;
}

/**
 * Wall-clock budget for one job run. Jobs stop starting new work once it is spent and report
 * `partial: true`; their dedupe markers make the next cron run resume where this one stopped.
 */
export class RunBudget {
	private readonly deadline: number;

	constructor(ms: number) {
		this.deadline = Date.now() + ms;
	}

	get exhausted(): boolean {
		return Date.now() >= this.deadline;
	}
}

/** Run `fn` over `items` with at most `limit` in flight. Never rejects; errors are returned per item. */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
	const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			try {
				results[index] = { ok: true, value: await fn(items[index], index) };
			} catch (error) {
				results[index] = { ok: false, error };
			}
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
	return results;
}

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Mongo duplicate-key error (unique index hit). */
export function isDuplicateKeyError(error: unknown): boolean {
	return (error as { code?: number } | null)?.code === 11000;
}
