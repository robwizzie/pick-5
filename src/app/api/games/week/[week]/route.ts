import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { NFLService } from '@/services/nflService';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ week: string }> }) {
	try {
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		const resolvedParams = await context.params;
		const weekParam = resolvedParams?.week;
		const week = Number.parseInt(weekParam, 10);

		if (Number.isNaN(week) || week < 1 || week > 18) {
			return NextResponse.json({ error: 'Invalid week provided' }, { status: 400 });
		}

		const games = await NFLService.getWeeklyGames(week);

		return NextResponse.json({
			games: games.map(game => ({
				...game,
				date: game.date instanceof Date ? game.date.toISOString() : game.date
			}))
		});
	} catch (error) {
		console.error('Error fetching games for week:', error);
		return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
	}
}

