import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { SurvivorPick } from '@/models/SurvivorPick';
import { markNudgePicked } from '@/lib/nudges';
import { getCurrentSeasonYear, parseSeasonParam } from '@/lib/season';
import { isSurvivorMode } from '@/lib/leagueRules';
import { loadSurvivor } from '@/lib/survivorServer';
import { NFLService } from '@/services/nflService';
import { hasGameStarted } from '@/services/gameUtils';

export const dynamic = 'force-dynamic';

/** GET /api/league/[id]/survivor[?season=YYYY] — standings, every pick (hidden until kickoff) and the viewer's used teams. */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const season = parseSeasonParam(new URL(req.url).searchParams.get('season'));
		const result = await loadSurvivor(id, season, viewerId);
		if (!result) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		if (!result.league.memberIds.includes(viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
		if (!isSurvivorMode(result.league.mode)) return NextResponse.json({ error: 'Not a survivor league' }, { status: 400 });

		return NextResponse.json(result.data);
	} catch (error) {
		console.error('Error fetching survivor standings:', error);
		return NextResponse.json({ error: 'Failed to fetch survivor standings' }, { status: 500 });
	}
}

/** POST /api/league/[id]/survivor { week, gameId, team } — make or change this week's pick. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const body = await req.json().catch(() => ({}));
		const week = Number(body.week);
		const gameId = typeof body.gameId === 'string' ? body.gameId : '';
		const team = typeof body.team === 'string' ? body.team : '';
		if (!Number.isInteger(week) || !gameId || !team) return NextResponse.json({ error: 'week, gameId and team are required' }, { status: 400 });

		const season = getCurrentSeasonYear();
		const result = await loadSurvivor(id, season, viewerId);
		if (!result) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		const { league, data } = result;
		if (!league.memberIds.includes(viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
		if (!isSurvivorMode(league.mode)) return NextResponse.json({ error: 'Not a survivor league' }, { status: 400 });

		if (data.complete) return NextResponse.json({ error: 'This survivor pool is over' }, { status: 400 });
		const me = data.members.find(m => m.userId === viewerId);
		if (!me?.alive) return NextResponse.json({ error: 'You’ve been eliminated from this pool' }, { status: 400 });
		if (week < data.currentWeek || week > data.finalWeek) {
			return NextResponse.json({ error: `Picks are open for weeks ${data.currentWeek}–${data.finalWeek}` }, { status: 400 });
		}

		const games = week === data.currentWeek && result.games.has(week) ? result.games.get(week)! : await NFLService.getWeeklyGames(week, season);
		const game = games.find(g => g.id === gameId);
		if (!game) return NextResponse.json({ error: 'That game isn’t on this week’s slate' }, { status: 400 });
		const side = game.home.team === team ? game.home : game.away.team === team ? game.away : null;
		if (!side) return NextResponse.json({ error: 'That team isn’t in this game' }, { status: 400 });
		if (hasGameStarted(game)) return NextResponse.json({ error: 'That game has already kicked off' }, { status: 400 });

		// You can't use a team twice (changing this week's pick frees its old team)
		const usedWeek = data.usedTeams[team];
		if (usedWeek !== undefined && usedWeek !== week) return NextResponse.json({ error: `You already used the ${team} in week ${usedWeek}` }, { status: 400 });

		await connectDB();
		const existing = await SurvivorPick.findOne({ leagueId: id, userId: viewerId, season, week }).lean<{ gameId: string }>();
		if (existing && existing.gameId !== gameId) {
			const oldGame = games.find(g => g.id === existing.gameId);
			if (oldGame && hasGameStarted(oldGame)) return NextResponse.json({ error: 'Your pick’s game already kicked off, so it’s locked in' }, { status: 400 });
		}

		const pick = await SurvivorPick.findOneAndUpdate(
			{ leagueId: id, userId: viewerId, season, week },
			{ $set: { gameId, team, abbreviation: side.abbreviation, logo: side.logo, isHome: side === game.home } },
			{ upsert: true, new: true }
		).lean();
		if (!existing) await markNudgePicked(id, season, week, viewerId);
		return NextResponse.json({ success: true, pick });
	} catch (error) {
		console.error('Error saving survivor pick:', error);
		return NextResponse.json({ error: 'Failed to save your pick' }, { status: 500 });
	}
}
