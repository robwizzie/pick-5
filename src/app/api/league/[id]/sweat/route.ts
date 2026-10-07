import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { isValidObjectId } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { getCurrentSeasonYear } from '@/lib/seasonYear';
import { isMember, loadLeagueSeason, seasonTotals, type MemberWeek, type ScoredPick } from '@/lib/leagueSeason';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import type { Game } from '@/components/games/GameCard';
import { pickState, project, sweatPhase, type SweatGame, type SweatMyPick, type SweatResponse, type SweatRevealedPick, type SweatStanding, type SweatTeam } from '@/components/sweat/sweatModel';

export const dynamic = 'force-dynamic';

/** Max TFS bonus (exact guess), used for the "max possible" number in Steve leagues. */
const TFS_MAX = 5;

const toTeam = (t: Game['home']): SweatTeam => ({ team: t.team, abbreviation: t.abbreviation, logo: t.logo, score: typeof t.score === 'number' ? t.score : null });

/**
 * Live "sweat" snapshot for one week: the viewer's picks with live scores, and every member's
 * projected week/season "if the games ended now". Other members' picks are only revealed for
 * games that have kicked off; everything else is aggregate numbers.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id: leagueId } = await params;
		if (!isValidObjectId(leagueId)) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		const week = parseInt(new URL(req.url).searchParams.get('week') || '', 10);
		if (!Number.isInteger(week) || week < 1 || week > 18) return NextResponse.json({ error: 'A week between 1 and 18 is required' }, { status: 400 });

		const seasonYear = getCurrentSeasonYear();
		// The scoreboard fetch is shared with loadLeagueSeason's (same URL, cached by Next)
		const [season, scoreboard] = await Promise.all([loadLeagueSeason(leagueId, seasonYear, { extraWeeks: [week] }), NFLService.getWeeklyGames(week, seasonYear)]);
		if (!season) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		if (!isMember(season, viewerId)) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });

		// Clock/period (and fresher scores) for in-progress games
		const enriched = await NFLService.enrichGamesWithLiveData(scoreboard);
		const results = season.resultsByWeek.get(week) ?? [];
		const statusById = new Map(results.map(r => [r.id, r.status]));

		const games = new Map<string, SweatGame>(
			enriched.map(g => {
				// Phase follows the scoring source so "secured" and "final" never disagree
				const phase = sweatPhase(statusById.get(g.id) ?? g.status);
				return [
					g.id,
					{
						id: g.id,
						phase,
						date: new Date(g.date).toISOString(),
						clock: phase === 'in' ? (g.clock ?? null) : null,
						periodDisplay: phase === 'in' ? (g.periodDisplay ?? (g.period ? `Q${g.period}` : null)) : null,
						home: toTeam(g.home),
						away: toTeam(g.away)
					}
				];
			})
		);

		const gameList = Array.from(games.values());
		const counts = {
			live: gameList.filter(g => g.phase === 'in').length,
			final: gameList.filter(g => g.phase === 'post').length,
			upcoming: gameList.filter(g => g.phase === 'pre').length,
			total: gameList.length
		};
		const nextKickoff =
			gameList
				.filter(g => g.phase === 'pre')
				.map(g => g.date)
				.sort()[0] ?? null;

		const mode = season.mode;
		const valueOf = (p: ScoredPick) => ScoringService.pointsForPick({ odds: p.odds ?? undefined }, season.rules, calculatePointsFromOdds, p.isLock);

		/** Resolve a pick against its game: which side, scores and live state. */
		const resolve = (p: ScoredPick) => {
			const game = games.get(p.gameId);
			if (!game) return null;
			const side: 'home' | 'away' = game.home.team === p.team ? 'home' : game.away.team === p.team ? 'away' : p.isHome ? 'home' : 'away';
			const team = game[side];
			const opponent = game[side === 'home' ? 'away' : 'home'];
			return { game, team, opponent, state: pickState(game.phase, team.score, opponent.score, p.isCorrect) };
		};

		const weekPicks = season.weeks.get(week) ?? new Map<string, MemberWeek>();
		const before = seasonTotals(season, week);

		const perMember = season.members.map(m => {
			const mw = weekPicks.get(m.userId);
			const isViewer = m.userId === viewerId;
			let liveWinning = 0;
			let hiddenPicks = 0;
			const revealed: SweatRevealedPick[] = [];
			for (const p of mw?.picks ?? []) {
				const r = resolve(p);
				if (!r) continue;
				if (r.state === 'winning') liveWinning += valueOf(p);
				// Never reveal another member's pick before its game kicks off
				if (!isViewer && r.game.phase === 'pre') {
					hiddenPicks++;
					continue;
				}
				revealed.push({ gameId: p.gameId, abbreviation: r.team.abbreviation, logo: r.team.logo, isLock: p.isLock, state: r.state });
			}
			return { member: m, mw, liveWinning, revealed, hiddenPicks };
		});

		const projections = new Map(
			project(
				perMember.map(({ member, mw, liveWinning }) => ({
					userId: member.userId,
					seasonBefore: before.get(member.userId) ?? 0,
					secured: mw?.weeklyPoints ?? 0,
					liveWinning
				}))
			).map(p => [p.userId, p])
		);

		const standings: SweatStanding[] = perMember
			.map(({ member, mw, revealed, hiddenPicks }) => {
				const p = projections.get(member.userId)!;
				return {
					userId: member.userId,
					name: member.name,
					image: member.image,
					hasPicks: !!mw && mw.picks.length > 0,
					seasonBefore: p.seasonBefore,
					secured: p.secured,
					liveWinning: p.liveWinning,
					projectedWeek: p.projectedWeek,
					projectedSeason: p.projectedSeason,
					currentRank: p.currentRank,
					projectedRank: p.projectedRank,
					projectedWeekRank: p.projectedWeekRank,
					picks: revealed,
					hiddenPicks
				};
			})
			.sort((a, b) => a.projectedRank - b.projectedRank || a.name.localeCompare(b.name));

		// The viewer's own picks, in kickoff order
		const mine = weekPicks.get(viewerId);
		const myPicks: SweatMyPick[] = (mine?.picks ?? [])
			.map((p): SweatMyPick | null => {
				const r = resolve(p);
				if (!r) return null;
				return {
					gameId: p.gameId,
					isHome: r.game.home.team === r.team.team,
					isLock: p.isLock,
					odds: typeof p.odds === 'number' ? p.odds : null,
					state: r.state,
					value: valueOf(p),
					earned: p.points,
					team: r.team,
					opponent: r.opponent,
					game: r.game
				};
			})
			.filter((p): p is SweatMyPick => p !== null)
			.sort((a, b) => a.game.date.localeCompare(b.game.date));

		const myProjection = projections.get(viewerId);
		const secured = myProjection?.secured ?? 0;
		const pendingValue = myPicks.filter(p => p.game.phase !== 'post').reduce((sum, p) => sum + p.value, 0);
		const tfsPending = !!mine?.tfsGame && mine.tfsScore !== null && games.get(mine.tfsGame)?.phase !== 'post';

		const body: SweatResponse = {
			week,
			season: seasonYear,
			leagueName: season.leagueName,
			leagueMode: mode,
			games: counts,
			nextKickoff,
			me: {
				hasPicks: myPicks.length > 0,
				picks: myPicks,
				secured,
				live: myProjection?.liveWinning ?? 0,
				max: secured + pendingValue + (tfsPending ? TFS_MAX : 0)
			},
			standings,
			updatedAt: new Date().toISOString()
		};

		return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('Error building sweat view:', error);
		return NextResponse.json({ error: 'Failed to load live standings' }, { status: 500 });
	}
}
