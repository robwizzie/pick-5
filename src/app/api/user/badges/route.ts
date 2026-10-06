import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { loadLeagueSeason } from '@/lib/leagueSeason';
import { parseSeasonParam } from '@/lib/season';
import { computeLeagueBadges, loadKickoffs, mergeUserBadges, type UserBadgesResponse } from '@/lib/badges';

export const dynamic = 'force-dynamic';

/** GET /api/user/badges[?season=YYYY] — the viewer's badges across all their leagues. */
export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const season = parseSeasonParam(new URL(req.url).searchParams.get('season'));
		await connectDB();
		const leagues = await League.find({ members: viewerId }, '_id').lean<Array<{ _id: unknown }>>();

		const seasons = (await Promise.all(leagues.map(l => loadLeagueSeason(String(l._id), season)))).filter(s => s !== null);
		// One schedule fetch per week across all leagues
		const kickoffs = await loadKickoffs(seasons.flatMap(s => Array.from(s.weeks.keys())), season);

		const perLeague = seasons.map(s => ({
			leagueId: s.leagueId,
			leagueName: s.leagueName,
			badges: computeLeagueBadges(s, kickoffs).get(viewerId) ?? []
		}));
		const body: UserBadgesResponse = { season, badges: mergeUserBadges(perLeague) };
		return NextResponse.json(body);
	} catch (error) {
		console.error('Error fetching user badges:', error);
		return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
	}
}
