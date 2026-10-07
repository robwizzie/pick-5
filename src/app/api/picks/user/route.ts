// src/app/api/picks/user/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { League } from '@/models/League';
import { authOptions } from '@/lib/auth';
import { countedWeeks, parseSeasonParam, seasonPickFilter } from '@/lib/season';
import { loadGameResults, rescore, revealStartedOnly, type PickDocLike } from '@/lib/pickScoring';

type PickDoc = PickDocLike & { _id: unknown; leagueId: string; [key: string]: unknown };

export const dynamic = 'force-dynamic';

/**
 * A user's picks in the current season (or ?season=), re-scored against live results.
 * Viewing another member's picks requires a shared league and only reveals games
 * that have kicked off.
 */
export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const week = searchParams.get('week');
		const leagueId = searchParams.get('leagueId');
		const userId = searchParams.get('userId') || viewerId;
		const isSelf = userId === viewerId;
		const season = parseSeasonParam(searchParams.get('season'));

		if (week && !leagueId) {
			return NextResponse.json({ error: 'Missing leagueId' }, { status: 400 });
		}
		if (!isSelf && !leagueId) {
			return NextResponse.json({ error: 'leagueId is required to view another player’s picks' }, { status: 400 });
		}

		await connectDB();

		const query: Record<string, unknown> = { userId, ...seasonPickFilter(season) };
		if (leagueId) query.leagueId = leagueId;
		// A single week is returned as asked; the whole season only includes the weeks that count
		query.week = week ? parseInt(week, 10) : await countedWeeks(season);

		const [docs, leagues] = await Promise.all([
			Pick.find(query).sort({ week: 1 }).lean<PickDoc[]>(),
			leagueId ? League.find({ _id: leagueId }, 'mode members').lean() : League.find({ members: userId }, 'mode members').lean()
		]);

		if (!isSelf) {
			const members = (leagues[0]?.members ?? []).map(String);
			if (!members.includes(viewerId) || !members.includes(userId)) {
				return NextResponse.json({ error: 'Unauthorized to view these picks' }, { status: 403 });
			}
		}

		const modeByLeague = new Map(leagues.map(l => [String(l._id), (l as { mode?: string }).mode || 'standard']));
		const resultsByWeek = await loadGameResults(
			docs.map(d => d.week),
			season
		);

		const scored = docs.map(doc => {
			const results = resultsByWeek.get(doc.week) ?? [];
			const fresh = { ...doc, ...rescore(doc, results, modeByLeague.get(String(doc.leagueId)) || 'standard') };
			return isSelf ? fresh : revealStartedOnly(fresh, results);
		});

		if (week) {
			const pick = scored[0];
			if (!pick) return NextResponse.json(null);
			return NextResponse.json({
				picks: pick.picks,
				tfsGame: pick.tfsGame,
				tfsScore: pick.tfsScore,
				lockGameId: pick.lockGameId ?? null,
				weeklyPoints: pick.weeklyPoints,
				correctPicks: pick.correctPicks,
				tfsPoints: pick.tfsPoints,
				hiddenPicks: 'hiddenPicks' in pick ? pick.hiddenPicks : 0
			});
		}

		return NextResponse.json(scored);
	} catch (error) {
		console.error('Error fetching user picks:', error);
		return NextResponse.json({ error: 'Error fetching user picks' }, { status: 500 });
	}
}
