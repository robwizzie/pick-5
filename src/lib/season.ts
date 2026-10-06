// src/lib/season.ts
// Season scoping for Pick documents (server only: imports the Pick model).
import { connectDB, isWorkersRuntime } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { getCurrentSeasonYear } from '@/lib/seasonYear';
import { NFLService } from '@/services/nflService';

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

/** Season a date falls in: before Mar 1 (UTC) belongs to the previous year's season. */
function seasonFromDate(date: Date): number {
	return date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

/**
 * Tag legacy picks with their season. The creation date gives a first guess, which is then
 * confirmed against that season's ESPN schedule (game ids are unique per season), trying the
 * neighbouring seasons if it doesn't match. Falls back to the date when ESPN can't confirm.
 */
async function backfillSeasons(): Promise<number> {
	type LegacyDoc = { _id: { getTimestamp(): Date }; week?: number; createdAt?: Date; picks?: Array<{ gameId?: string }> };
	const legacy = (await Pick.collection
		.find({ season: { $exists: false } }, { projection: { week: 1, createdAt: 1, 'picks.gameId': 1 } })
		.toArray()) as unknown as LegacyDoc[];
	if (legacy.length === 0) return 0;

	const current = getCurrentSeasonYear();
	const schedules = new Map<string, Promise<Set<string>>>();
	const scheduleFor = (season: number, week: number) => {
		const key = `${season}:${week}`;
		if (!schedules.has(key)) {
			schedules.set(
				key,
				NFLService.getWeeklyGames(week, season).then(
					games => new Set(games.map(g => g.id)),
					() => new Set<string>()
				)
			);
		}
		return schedules.get(key)!;
	};

	const guessOf = (doc: LegacyDoc) => seasonFromDate(doc.createdAt ? new Date(doc.createdAt) : doc._id.getTimestamp());
	// Warm the likely schedules in parallel; neighbours are fetched only when needed
	await Promise.all(legacy.filter(d => d.week).map(d => scheduleFor(guessOf(d), d.week!)));

	const ops = [];
	for (const doc of legacy) {
		const guess = guessOf(doc);
		const ids = (doc.picks ?? []).map(p => p.gameId).filter((id): id is string => !!id);
		let season = guess;
		if (doc.week && ids.length) {
			for (const candidate of [guess, guess - 1, guess + 1]) {
				if (candidate > current) continue;
				const schedule = await scheduleFor(candidate, doc.week);
				if (ids.some(id => schedule.has(id))) {
					season = candidate;
					break;
				}
			}
		}
		ops.push({ updateOne: { filter: { _id: doc._id, season: { $exists: false } }, update: { $set: { season } } } });
	}

	const result = await Pick.collection.bulkWrite(ops as Parameters<typeof Pick.collection.bulkWrite>[0], { ordered: false });
	return result.modifiedCount;
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
	if (needsBackfill) backfilled = await backfillSeasons();

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
