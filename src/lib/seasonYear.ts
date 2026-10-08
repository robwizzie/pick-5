// src/lib/seasonYear.ts
// Pure (no database) season helpers, safe to import from client and server code.

/**
 * The current NFL season year. The season starts in September, so any date
 * before September belongs to the previous year's season (e.g. Feb 2027 -> 2026).
 */
export function getCurrentSeasonYear(now: Date = new Date()): number {
	const year = now.getFullYear();
	return now.getMonth() < 8 ? year - 1 : year;
}

/** Weeks in the NFL regular season (the most a Pick 5 season can run). */
export const REGULAR_SEASON_WEEKS = 18;

/**
 * The last week that counts in a Pick 5 season unless an admin sets another one for that season
 * (SeasonConfig.finalWeek). Weeks after it don't count toward standings, stats, badges or history.
 */
export const DEFAULT_FINAL_WEEK = 17;

/**
 * The first week that counts in a season unless an admin sets another one (SeasonConfig.startWeek).
 * Seasons that started mid-way through the NFL season are listed here.
 */
const DEFAULT_START_WEEKS: Record<number, number> = {
	2026: 5
};

export interface SeasonWeeks {
	/** First week that counts */
	startWeek: number;
	/** Last week that counts */
	finalWeek: number;
}

const isWeek = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= REGULAR_SEASON_WEEKS;

/** A season's counted weeks from its stored settings (missing or invalid values fall back to the defaults). */
export function resolveSeasonWeeks(season: number, stored?: { startWeek?: unknown; finalWeek?: unknown } | null): SeasonWeeks {
	const startWeek = isWeek(stored?.startWeek) ? stored.startWeek : (DEFAULT_START_WEEKS[season] ?? 1);
	const finalWeek = isWeek(stored?.finalWeek) ? stored.finalWeek : DEFAULT_FINAL_WEEK;
	// A season needs at least one week
	return { startWeek, finalWeek: Math.max(startWeek, finalWeek) };
}
