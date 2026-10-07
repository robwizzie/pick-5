import { NextRequest, NextResponse } from 'next/server';
import { fetchEspnScoreboard } from '@/lib/espnScoreboard';

export const dynamic = 'force-dynamic';

/** GET /api/nfl/scoreboard?week=N&season=YYYY[&seasontype=2] — ESPN's scoreboard for that week and season. */
export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const week = parseInt(searchParams.get('week') || '', 10);
	const season = parseInt(searchParams.get('season') || searchParams.get('year') || '', 10);
	const seasonType = searchParams.get('seasontype') || '2';

	// Empty slates aren't cached: a transient upstream oddity shouldn't leave the UI on "No games yet".
	const data = await fetchEspnScoreboard(Number.isInteger(week) ? week : null, Number.isInteger(season) ? season : null, { seasonType, init: { cache: 'no-store' } });
	return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
