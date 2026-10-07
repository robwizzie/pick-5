// ESPN NFL scoreboard lookups for a specific week and season, shared by NFLService (server) and
// the /api/nfl/scoreboard proxy (browser). ESPN's site API selects the season with `dates=YYYY`;
// other parameters (season=, year=) are ignored on some deployments and silently return the
// CURRENT season's games — which made past seasons' picks match nothing and their stats empty.
// So every response is checked against the requested season before it's used.
import { getCurrentSeasonYear } from '@/lib/seasonYear';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

export interface EspnScoreboard {
	events?: unknown[];
	season?: { year?: number; type?: number };
	week?: { number?: number };
	[key: string]: unknown;
}

function buildUrl(week: number | null, season: number | null, seasonType: string, seasonParam?: 'dates' | 'season') {
	const url = new URL(BASE);
	if (week) url.searchParams.set('week', String(week));
	url.searchParams.set('seasontype', seasonType);
	if (season && seasonParam) url.searchParams.set(seasonParam, String(season));
	return url.toString();
}

/** A response is usable when it has games and (if ESPN says which) the requested season and week. */
function matches(data: EspnScoreboard | null, week: number | null, season: number | null): boolean {
	if (!data || !Array.isArray(data.events) || data.events.length === 0) return false;
	if (season && typeof data.season?.year === 'number' && data.season.year !== season) return false;
	if (week && typeof data.week?.number === 'number' && data.week.number !== week) return false;
	return true;
}

/**
 * The scoreboard for `week` of `season` (regular season by default). Returns `{ events: [] }`
 * when ESPN has nothing that matches. `init` is passed to fetch (e.g. Next's revalidate).
 */
export async function fetchEspnScoreboard(
	week: number | null,
	season: number | null,
	{ seasonType = '2', init = {} }: { seasonType?: string; init?: RequestInit & { next?: { revalidate?: number } } } = {}
): Promise<EspnScoreboard & { upstreamStatus?: number }> {
	const candidates = season ? [buildUrl(week, season, seasonType, 'dates'), buildUrl(week, season, seasonType, 'season')] : [];
	// The unscoped query always answers with the current season, so it's only safe for that season
	if (!season || season === getCurrentSeasonYear()) candidates.push(buildUrl(week, null, seasonType));

	let upstreamStatus = 502;
	for (const url of candidates) {
		try {
			const res = await fetch(url, { ...init, headers: { 'User-Agent': 'pick-5/1.0', Accept: 'application/json', ...(init.headers ?? {}) } });
			upstreamStatus = res.status;
			if (!res.ok) continue;
			const data = (await res.json()) as EspnScoreboard;
			if (matches(data, week, season)) return data;
		} catch (error) {
			console.error(`[ESPN] ${url} failed:`, error);
		}
	}
	return { events: [], upstreamStatus };
}
