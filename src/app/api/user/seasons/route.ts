import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentSeasonYear, getSeasonFinalWeek, seasonsWithPicks } from '@/lib/season';

export const dynamic = 'force-dynamic';

/** GET /api/user/seasons — the seasons the viewer has made picks in, newest first. */
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const seasons = await seasonsWithPicks({ userId: viewerId });
		return NextResponse.json({ current: getCurrentSeasonYear(), seasons: seasons.map(year => ({ year, finalWeek: getSeasonFinalWeek(year) })) });
	} catch (error) {
		console.error('Error fetching user seasons:', error);
		return NextResponse.json({ error: 'Failed to fetch seasons' }, { status: 500 });
	}
}
