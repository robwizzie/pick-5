import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { SeasonHistory } from '@/models/SeasonHistory';
import { getCurrentSeasonYear, getSeasonFinalWeek, seasonsWithPicks } from '@/lib/season';

export const dynamic = 'force-dynamic';

/** GET /api/league/[id]/seasons — the seasons this league has picks or history for, newest first. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		await connectDB();
		const league = await League.findById(id, 'members').lean<{ members?: string[] }>();
		if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		if (!(league.members ?? []).map(String).includes(viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });

		const [withPicks, archived] = await Promise.all([seasonsWithPicks({ leagueId: id }), SeasonHistory.distinct('seasonYear', { leagueId: id }) as Promise<number[]>]);
		const current = getCurrentSeasonYear();
		const seasons = Array.from(new Set([...withPicks, ...archived]))
			.filter(s => s <= current)
			.sort((a, b) => b - a);

		return NextResponse.json({ current, seasons: seasons.map(year => ({ year, finalWeek: getSeasonFinalWeek(year) })) });
	} catch (error) {
		console.error('Error fetching league seasons:', error);
		return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
	}
}
