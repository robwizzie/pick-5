import { NextResponse } from 'next/server';
import { getSeasonWeeks, parseSeasonParam } from '@/lib/season';

export const dynamic = 'force-dynamic';

/** GET /api/season/weeks[?season=YYYY] — the first and last weeks that count in a season. */
export async function GET(req: Request) {
	try {
		const season = parseSeasonParam(new URL(req.url).searchParams.get('season'));
		return NextResponse.json({ season, ...(await getSeasonWeeks(season)) });
	} catch (error) {
		console.error('[Season Weeks API] Error:', error);
		return NextResponse.json({ error: 'Failed to get season weeks' }, { status: 500 });
	}
}
