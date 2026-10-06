import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const week = searchParams.get('week');
	const season = searchParams.get('season');
	const year = searchParams.get('year');
	const seasonType = searchParams.get('seasontype') || '2';
	const requestedSeason = season || year;

	const base = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

	const buildUrl = (seasonParam?: 'dates' | 'season' | 'year') => {
		const url = new URL(base);
		if (week) url.searchParams.set('week', week);
		if (seasonType) url.searchParams.set('seasontype', seasonType);
		if (requestedSeason && seasonParam) url.searchParams.set(seasonParam, requestedSeason);
		return url;
	};

	// ESPN has used more than one season selector on this endpoint over time.
	// Prefer the long-standing dates=YYYY form, but retry alternates if ESPN
	// returns an empty slate. For the current season, the unscoped week query is
	// also a safe final fallback.
	const candidates = requestedSeason
		? [buildUrl('dates'), buildUrl('season'), buildUrl('year'), buildUrl()]
		: [buildUrl()];

	let lastStatus = 502;
	try {
		for (const espnUrl of candidates) {
			const res = await fetch(espnUrl.toString(), {
				cache: 'no-store',
				headers: {
					'User-Agent': 'pick-5/1.0',
					Accept: 'application/json'
				}
			});
			lastStatus = res.status;
			if (!res.ok) continue;

			const data = await res.json();
			if (Array.isArray(data?.events) && data.events.length > 0) {
				return NextResponse.json(data, {
					headers: { 'Cache-Control': 'no-store' }
				});
			}
		}

		// Do not cache empty ESPN responses; a transient upstream oddity should not
		// leave the Pick 5 UI stuck on "No games yet".
		return NextResponse.json({ events: [], upstreamStatus: lastStatus }, {
			status: 200,
			headers: { 'Cache-Control': 'no-store' }
		});
	} catch (error) {
		console.error('[NFL scoreboard proxy] ESPN fetch failed:', error);
		return NextResponse.json({ events: [] }, {
			status: 200,
			headers: { 'Cache-Control': 'no-store' }
		});
	}
}
