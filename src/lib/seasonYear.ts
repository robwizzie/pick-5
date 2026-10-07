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
