import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '0', 10);
		const leagueId = searchParams.get('leagueId');

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		console.log(`[API Debug] Fetching leaderboard for week ${week} in league ${leagueId}`);

		// Fetch the league to get member list and mode
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}
		const leagueMode = (league as any).mode || 'standard';

		// Fetch only users who are members of this league
		const allUsers = await User.find({ _id: { $in: league.members } }, 'name image');
		console.log('[API Debug] League Members:', allUsers.map(u => ({ id: u._id.toString(), name: u.name, image: u.image })));

		// Get all picks for this week and league
		const allPicksForWeek = await Pick.find({ week, leagueId }).lean();
		console.log('[API Debug] Found picks for week:', allPicksForWeek.length);

		// Get current game results to re-score picks on the fly
		const games = await NFLService.getWeeklyGames(week);
		const gameResults = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status // Include game status for accurate scoring
		}));

		console.log('[API Debug] Game results for scoring:', gameResults.length);

		// Re-calculate scores for each pick (don't trust stored values)
		const weeklyResultsMap = new Map();
		const userIdsWithPicks = new Set();

		for (const pick of allPicksForWeek) {
			const userId = pick.userId.toString();
			userIdsWithPicks.add(userId);

			// Re-score this pick with current game results
			const { weeklyPoints, correctPicks, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
				pick.picks,
				gameResults,
				pick.tfsGame,
				pick.tfsScore,
				leagueMode,
				calculatePointsFromOdds
			);

			// Extract team names and logos from picks by matching with games
			const pickedTeamsWithLogos = pick.picks.map((p: any) => {
				const game = games.find(g => g.id === p.gameId);
				if (!game) return null;

				// Find which team was picked (home or away)
				const isHome = p.isHome;
				const teamData = isHome ? game.home : game.away;

				// Determine game status
				const status = game.status?.toLowerCase() || 'scheduled';
				let gameStatus: 'scheduled' | 'in_progress' | 'final' = 'scheduled';

				if (status === 'in' || status === 'in_progress') {
					gameStatus = 'in_progress';
				} else if (status === 'post' || status === 'final' || status === 'status_final') {
					gameStatus = 'final';
				}

				// Determine if pick was correct (only for finished games)
				let isCorrect: boolean | null = null;
				if (gameStatus === 'final') {
					const gameResult = gameResults.find(gr => gr.id === p.gameId);
					if (gameResult) {
						isCorrect = ScoringService.calculatePickResult(p, gameResult);
					}
				}

				return {
					team: teamData.team,
					abbreviation: teamData.abbreviation,
					logo: teamData.logo,
					gameStatus,
					isCorrect
				};
			}).filter(Boolean); // Remove any nulls

			weeklyResultsMap.set(userId, {
				points: weeklyPoints,
				correct: correctPicks,
				tfsPoints: tfsPoints,
				completedGames: completedGames,
				pickedTeams: pickedTeamsWithLogos // Add the picked teams with logos
			});
		}

		console.log('[API Debug] Re-calculated scores:', Array.from(weeklyResultsMap.entries()));

		// Populate usernames for weekly results
		const resultsWithUsernames = allUsers.map(user => {
			const result = weeklyResultsMap.get(user._id.toString());
			const hasPicks = userIdsWithPicks.has(user._id.toString());
			return {
				userId: user._id.toString(),
				player: user.name || 'Unknown Player',
				image: user.image || null,
				points: result?.points || 0,
				correct: result?.correct || 0,
				tfsPoints: result?.tfsPoints || 0,
				hasPicks,
				pickedTeams: result?.pickedTeams || [] // Include picked teams
			};
		});

		// Get ALL picks for this league for season stats
		const allPicksForSeason = await Pick.find({ leagueId }).lean();
		console.log('[API Debug] All Picks for Season (count):', allPicksForSeason.length);

		// Get unique weeks from all picks
		const weekSet = new Set<number>();
		allPicksForSeason.forEach(p => weekSet.add(p.week));
		const uniqueWeeks = Array.from(weekSet);
		console.log('[API Debug] Unique weeks with picks:', uniqueWeeks);

		// Fetch game results for all weeks (cache them)
		const gameResultsByWeek = new Map();
		for (const weekNum of uniqueWeeks) {
			const weekGames = await NFLService.getWeeklyGames(weekNum);
			const results = weekGames.map(game => ({
				id: game.id,
				homeScore: game.home.score || 0,
				awayScore: game.away.score || 0,
				homeTeam: game.home.team,
				awayTeam: game.away.team,
				status: game.status // Include game status for accurate scoring
			}));
			gameResultsByWeek.set(weekNum, results);
		}

		console.log('[API Debug] Fetched game results for weeks:', Array.from(gameResultsByWeek.keys()));

		// Re-calculate season stats for each user
		const seasonStatsMap = new Map();

		for (const pick of allPicksForSeason) {
			const userId = pick.userId.toString();
			const weekResults = gameResultsByWeek.get(pick.week) || [];

			// Re-score this week's picks
			const { weeklyPoints, correctPicks: correct, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
				pick.picks,
				weekResults,
				pick.tfsGame,
				pick.tfsScore,
				leagueMode,
				calculatePointsFromOdds
			);

			// Aggregate into user's season stats
			if (!seasonStatsMap.has(userId)) {
				seasonStatsMap.set(userId, {
					totalPoints: 0,
					totalTFSPoints: 0,
					correctPicks: 0,
					totalPicks: 0
				});
			}

			const userStats = seasonStatsMap.get(userId);
			userStats.totalPoints += weeklyPoints;
			userStats.totalTFSPoints += tfsPoints;
			userStats.correctPicks += correct;
			userStats.totalPicks += completedGames; // Use completed games, not pick.picks.length
		}

		console.log('[API Debug] Re-calculated season stats:', Array.from(seasonStatsMap.entries()));

		// Format season stats with usernames
		const seasonStatsFormatted = allUsers.map(user => {
			const stat = seasonStatsMap.get(user._id.toString());
			return {
				player: user.name || 'Unknown Player',
				image: user.image || null,
				totalPoints: stat?.totalPoints || 0,
				totalTFSPoints: stat?.totalTFSPoints || 0,
				totalPicks: stat?.totalPicks || 0,
				correctPicks: stat?.correctPicks || 0,
				winPercentage: stat?.totalPicks > 0 ? (stat.correctPicks / stat.totalPicks) * 100 : 0
			};
		});

		console.log('[API Debug] Final Weekly Results Being Returned:', JSON.stringify(resultsWithUsernames, null, 2));
		console.log('[API Debug] Final Season Stats Being Returned:', JSON.stringify(seasonStatsFormatted, null, 2));

		return NextResponse.json({
			weeklyResults: resultsWithUsernames,
			seasonStats: seasonStatsFormatted
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
	}
}
