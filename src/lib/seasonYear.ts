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

/** Weeks in the NFL regular season. */
export const REGULAR_SEASON_WEEKS = 18;

/**
 * Seasons where Pick 5 wrapped up before the end of the NFL regular season. Weeks after the
 * final week don't count toward standings, stats, badges or league history.
 */
const FINAL_WEEK_OVERRIDES: Record<number, number> = {
	2025: 17
};

/** The last week that counts in a Pick 5 season. */
export function getSeasonFinalWeek(season: number): number {
	return FINAL_WEEK_OVERRIDES[season] ?? REGULAR_SEASON_WEEKS;
}
