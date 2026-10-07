import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 60; // seconds

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const week = searchParams.get('week');
    const season = searchParams.get('season');
    const year = searchParams.get('year');
    const seasonType = searchParams.get('seasontype') || '2'; // 2 = regular season

	const espnUrl = new URL('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    if (week) espnUrl.searchParams.set('week', week);
    // Use ESPN's explicit season parameter for week-oriented NFL scoreboard requests.
    // This is more reliable than dates=YYYY for future/current-season weekly schedules.
    if (season) espnUrl.searchParams.set('season', season);
    if (year && !season) espnUrl.searchParams.set('season', year);
    if (seasonType) espnUrl.searchParams.set('seasontype', seasonType);

	try {
		const res = await fetch(espnUrl.toString(), {
			next: { revalidate },
			headers: {
				'User-Agent': 'pick-5/1.0 (+https://localhost:3000)',
				'Accept': 'application/json'
			}
		});
		if (!res.ok) {
			// Gracefully return empty data so UI can continue
			return NextResponse.json({ events: [] }, {
				status: 200,
				headers: {
					'Cache-Control': 'public, max-age=30'
				}
			});
		}
		const data = await res.json();
		return NextResponse.json(data, {
			headers: {
				'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
			}
		});
	} catch {
		// Fallback empty payload on network errors
		return NextResponse.json({ events: [] }, { status: 200 });
	}
}


