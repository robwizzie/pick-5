import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isMember, loadLeagueSeason } from '@/lib/leagueSeason';
import { parseSeasonParam } from '@/lib/season';
import { championsBySeason, computeLeagueBadges, computeStreaks, loadKickoffs, type LeagueBadgesResponse } from '@/lib/badges';
import { SeasonHistory } from '@/models/SeasonHistory';

export const dynamic = 'force-dynamic';

/** GET /api/league/[id]/badges[?season=YYYY] — every member's season badges (final games only). */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const season = parseSeasonParam(new URL(req.url).searchParams.get('season'));

		const data = await loadLeagueSeason(id, season);
		if (!data) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		if (!isMember(data, viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });

		const [kickoffs, history] = await Promise.all([
			loadKickoffs(Array.from(data.weeks.keys()), season),
			SeasonHistory.find({ leagueId: id }, 'seasonYear champions.userId').lean<Array<{ seasonYear: number; champions?: Array<{ userId?: string }> }>>()
		]);
		const badges = computeLeagueBadges(data, kickoffs, championsBySeason(history));
		const body: LeagueBadgesResponse = {
			leagueId: id,
			season,
			members: data.members.map(m => ({ userId: m.userId, badges: badges.get(m.userId) ?? [] })),
			streaks: computeStreaks(data, kickoffs)
		};
		return NextResponse.json(body);
	} catch (error) {
		console.error('Error fetching league badges:', error);
		return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
	}
}
