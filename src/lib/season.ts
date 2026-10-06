// src/lib/season.ts
// Season scoping for Pick documents (server only: imports the Pick model).
import { connectDB, isWorkersRuntime } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { getCurrentSeasonYear } from '@/lib/seasonYear';

export { getCurrentSeasonYear };

/**
 * Legacy picks (created before the `season` field existed) are attributed to a
 * season by `createdAt`: season N covers [Mar 1 N, Mar 1 N+1) UTC. The regular
 * season ends in early January, so nothing for season N is created after Feb.
 */
export function seasonWindow(season: number): { start: Date; end: Date } {
	return {
		start: new Date(Date.UTC(season, 2, 1)),
		end: new Date(Date.UTC(season + 1, 2, 1))
	};
}

export type SeasonPickFilter = {
	$or: [{ season: number }, { season: { $exists: false }; createdAt: { $gte: Date; $lt: Date } }];
};

/**
 * Mongo filter fragment matching picks for `season`, including legacy docs without
 * a `season` field (attributed by createdAt). Spread it into a query:
 *   Pick.find({ userId, leagueId, ...seasonPickFilter(season) })
 * If the query already has its own `$or`, combine with `$and` instead of spreading.
 */
export function seasonPickFilter(season: number): SeasonPickFilter {
	const { start, end } = seasonWindow(season);
	return {
		$or: [{ season }, { season: { $exists: false }, createdAt: { $gte: start, $lt: end } }]
	};
}

export interface PickSeasonMigrationResult {
	/** Picks that got a `season` value in this run. */
	backfilled: number;
	/** Whether the legacy {userId, week, leagueId} unique index was dropped in this run. */
	droppedLegacyIndex: boolean;
	/** True when nothing needed doing. */
	alreadyMigrated: boolean;
}

const LEGACY_INDEX_KEY = ['userId', 'week', 'leagueId'];

function isLegacyIndex(key: Record<string, unknown>): boolean {
	const fields = Object.keys(key);
	return fields.length === LEGACY_INDEX_KEY.length && LEGACY_INDEX_KEY.every(f => key[f] === 1);
}

async function findLegacyIndexName(): Promise<string | null> {
	try {
		const indexes = await Pick.collection.indexes();
		const legacy = indexes.find(ix => isLegacyIndex(ix.key as Record<string, unknown>));
		return legacy?.name ?? null;
	} catch (error) {
		// Collection does not exist yet: nothing to drop.
		if ((error as { codeName?: string })?.codeName === 'NamespaceNotFound') return null;
		throw error;
	}
}

/**
 * Backfill `season` on legacy picks, drop the legacy unique index and ensure the
 * season-aware one. Idempotent and safe to run concurrently (every step is). Not memoized.
 */
export async function runPickSeasonMigration(): Promise<PickSeasonMigrationResult> {
	await connectDB();

	const [needsBackfill, legacyIndexName] = await Promise.all([
		Pick.exists({ season: { $exists: false } }),
		findLegacyIndexName()
	]);

	if (!needsBackfill && !legacyIndexName) {
		// Still make sure the schema indexes exist (no-op when they do).
		await Pick.createIndexes();
		return { backfilled: 0, droppedLegacyIndex: false, alreadyMigrated: true };
	}

	let backfilled = 0;
	if (needsBackfill) {
		// Season from createdAt (fallback: ObjectId timestamp); before Mar 1 (UTC) -> previous year.
		const date = { $ifNull: [{ $toDate: '$createdAt' }, { $toDate: '$_id' }] };
		const result = await Pick.collection.updateMany({ season: { $exists: false } }, [
			{
				$set: {
					season: {
						$let: {
							vars: { d: date },
							in: {
								$cond: [{ $lt: [{ $month: '$$d' }, 3] }, { $subtract: [{ $year: '$$d' }, 1] }, { $year: '$$d' }]
							}
						}
					}
				}
			}
		]);
		backfilled = result.modifiedCount;
	}

	let droppedLegacyIndex = false;
	if (legacyIndexName) {
		try {
			await Pick.collection.dropIndex(legacyIndexName);
			droppedLegacyIndex = true;
		} catch (error) {
			// Another request may have dropped it concurrently.
			if ((error as { codeName?: string })?.codeName !== 'IndexNotFound') throw error;
		}
	}

	// Builds { userId, leagueId, season, week } unique (and the season index) from the schema.
	await Pick.createIndexes();

	return { backfilled, droppedLegacyIndex, alreadyMigrated: false };
}

// Memoization. On Node.js one in-flight promise is shared per process. On Cloudflare
// Workers I/O cannot be shared across requests, so only completion is remembered per
// isolate and each request that still sees work to do runs its own (idempotent) pass.
let migrated = false;
let migrationPromise: Promise<PickSeasonMigrationResult> | null = null;

/**
 * Ensure picks are season-scoped in the database. Cheap after the first successful
 * run in this process. Call before writing picks (the legacy unique index would
 * otherwise reject a new season's pick for a week already picked last season).
 */
export async function ensurePickSeasonMigration(): Promise<void> {
	if (migrated) return;

	if (isWorkersRuntime) {
		await runPickSeasonMigration();
		migrated = true;
		return;
	}

	if (!migrationPromise) {
		migrationPromise = runPickSeasonMigration().then(
			result => {
				migrated = true;
				return result;
			},
			error => {
				migrationPromise = null;
				throw error;
			}
		);
	}
	await migrationPromise;
}

/** Parse an optional `season` query param; falls back to the current season. */
export function parseSeasonParam(value: string | null | undefined): number {
	const parsed = value ? parseInt(value, 10) : NaN;
	return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : getCurrentSeasonYear();
}
