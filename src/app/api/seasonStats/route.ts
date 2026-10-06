// src/app/api/seasonStats/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { parseSeasonParam, seasonPickFilter } from '@/lib/season';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const leagueId = searchParams.get('leagueId');
		// Optional ?season=YYYY; defaults to the current season
		const season = parseSeasonParam(searchParams.get('season'));
		const seasonFilter = seasonPickFilter(season);

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		// Fetch league to get mode
		const league = await League.findById(leagueId).lean();
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}
		const leagueMode = (league as any).mode || 'standard';

		// Find picks for the user in the specific league
		const userPicks = await Pick.find({ userId: session.user.id, leagueId, ...seasonFilter }).lean();

		// Get unique weeks from picks
		const weekSet = new Set<number>();
		userPicks.forEach(p => weekSet.add(p.week));
		const uniqueWeeks = Array.from(weekSet);

		// Fetch game results for every week, and every member's picks for those weeks, in parallel
		const [weekResultsList, leaguePicks] = await Promise.all([
			Promise.all(
				uniqueWeeks.map(async weekNum =>
					(await NFLService.getWeeklyGames(weekNum, season)).map(game => ({
						id: game.id,
						homeScore: game.home.score || 0,
						awayScore: game.away.score || 0,
						homeTeam: game.home.team,
						awayTeam: game.away.team,
						status: game.status
					}))
				)
			),
			Pick.find({ leagueId, week: { $in: uniqueWeeks }, ...seasonFilter }).lean()
		]);
		const gameResultsByWeek = new Map(uniqueWeeks.map((weekNum, i) => [weekNum, weekResultsList[i]]));

		// Initialize weekly stats and totals
		const weeklyStats: Record<string, { weeklyPoints: number; correctPicks: number; totalPicks: number; tfsPoints: number }> = {};
		let totalPoints = 0;
		let totalCorrectPicks = 0;
		let totalCompletedPicks = 0;
		let totalTFSPoints = 0;
		let weeksWon = 0;

		// Re-calculate stats for each week
		userPicks.forEach(pick => {
			const weekResults = gameResultsByWeek.get(pick.week) || [];

			// Re-score picks with current game results
			const { weeklyPoints, correctPicks, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
				pick.picks,
				weekResults,
				pick.tfsGame,
				pick.tfsScore,
				leagueMode,
				calculatePointsFromOdds,
			pick.lockGameId
			);

			// Store weekly stats
			weeklyStats[pick.week] = {
				weeklyPoints,
				correctPicks,
				totalPicks: completedGames, // Use completed games, not pick.picks.length
				tfsPoints
			};

			// Aggregate totals
			totalPoints += weeklyPoints;
			totalCorrectPicks += correctPicks;
			totalCompletedPicks += completedGames;
			totalTFSPoints += tfsPoints;
		});

		// Calculate weeks won (weeks where user got 1st or tied for 1st)
		for (const week of uniqueWeeks) {
			const allPicksForWeek = leaguePicks.filter(p => p.week === week);

			// Calculate scores for all users in this week
			const weekResults = gameResultsByWeek.get(week) || [];
			let maxPointsForWeek = 0;
			let userPointsForWeek = 0;

			for (const pick of allPicksForWeek) {
				const { weeklyPoints } = ScoringService.calculateWeekScore(
					pick.picks,
					weekResults,
					pick.tfsGame,
					pick.tfsScore,
					leagueMode,
					calculatePointsFromOdds,
				pick.lockGameId
				);

				if (pick.userId.toString() === session.user.id) {
					userPointsForWeek = weeklyPoints;
				}

				maxPointsForWeek = Math.max(maxPointsForWeek, weeklyPoints);
			}

			// If user's points equal max points and max points > 0, they won/tied for 1st
			if (userPointsForWeek > 0 && userPointsForWeek === maxPointsForWeek) {
				weeksWon++;
			}
		}

		return NextResponse.json({
			totalPoints,
			correctPicks: totalCorrectPicks,
			totalPicks: totalCompletedPicks,
			totalTFSPoints,
			weeksWon,
			weeklyStats
		});
	} catch (error) {
		console.error('Error fetching season stats:', error);
		return NextResponse.json({ error: 'Failed to fetch season stats' }, { status: 500 });
	}
}
