import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isMember, loadLeagueSeason } from '@/lib/leagueSeason';
import { parseSeasonParam } from '@/lib/season';
import { seasonRecords, weekMatchups, type MatchupsResponse } from '@/lib/matchups';
import { allTimePairRecords } from '@/lib/rivalries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/league/[id]/matchups?week=N[&season=YYYY]
 * This week's head-to-head pairings with live points (counts only — never picks) and season records.
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '', 10);
		if (!Number.isInteger(week) || week < 1 || week > 22) {
			return NextResponse.json({ error: 'A valid week is required' }, { status: 400 });
		}
		const season = parseSeasonParam(searchParams.get('season'));

		const data = await loadLeagueSeason(id, season, { extraWeeks: [week] });
		if (!data) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		if (!isMember(data, viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });

		const matchups = weekMatchups(data, week);
		const body: MatchupsResponse = {
			leagueId: id,
			season,
			week,
			matchups,
			records: seasonRecords(data, week),
			myMatchupId: matchups.find(m => m.sides.some(s => s.userId === viewerId))?.id ?? null,
			// The dashboard only needs this week's matchup; the board asks for rivalries
			rivalries: searchParams.get('rivalries') === '1' ? await allTimePairRecords(id, data, week).catch(() => undefined) : undefined
		};
		return NextResponse.json(body);
	} catch (error) {
		console.error('Error fetching matchups:', error);
		return NextResponse.json({ error: 'Failed to fetch matchups' }, { status: 500 });
	}
}
