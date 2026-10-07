import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { rulesFor } from '@/lib/leagueRules';
import { countedWeeks, parseSeasonParam, seasonPickFilter } from '@/lib/season';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '0', 10);
		const leagueId = searchParams.get('leagueId');
		// Optional ?season=YYYY; defaults to the current season
		const season = parseSeasonParam(searchParams.get('season'));
		const seasonFilter = seasonPickFilter(season);

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		// Fetch the league to get member list and mode
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}
		if (!league.members.map(String).includes(viewerId)) {
			return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 });
		}
		// The league's scoring rules (mode, lock multiplier, TFS on/off)
		const leagueMode = rulesFor(league);

		// Fetch only users who are members of this league
		const allUsers = await User.find({ _id: { $in: league.members } }, 'name image');

		// Get all picks for this week and league
		const allPicksForWeek = await Pick.find({ week, leagueId, ...seasonFilter }).lean();

		// Get current game results to re-score picks on the fly
		const games = await NFLService.getWeeklyGames(week, season);
		const gameResults = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status // Include game status for accurate scoring
		}));

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
				calculatePointsFromOdds,
			pick.lockGameId
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

		// Populate usernames for weekly results
		const resultsWithUsernames = allUsers.map(user => {
			const result = weeklyResultsMap.get(user._id.toString());
			const hasPicks = userIdsWithPicks.has(user._id.toString());
			// Don't reveal other members' picks for games that haven't kicked off
			const isViewer = user._id.toString() === viewerId;
			const pickedTeams = (result?.pickedTeams || []).filter((t: { gameStatus: string }) => isViewer || t.gameStatus !== 'scheduled');
			return {
				userId: user._id.toString(),
				player: user.name || 'Unknown Player',
				image: user.image || null,
				points: result?.points || 0,
				correct: result?.correct || 0,
				tfsPoints: result?.tfsPoints || 0,
				hasPicks,
				pickedTeams
			};
		});

		// Get ALL picks for this league for season stats
		const allPicksForSeason = await Pick.find({ leagueId, week: await countedWeeks(season), ...seasonFilter }).lean();

		// Get unique weeks from all picks
		const weekSet = new Set<number>();
		allPicksForSeason.forEach(p => weekSet.add(p.week));
		const uniqueWeeks = Array.from(weekSet);

		// Fetch game results for every week in parallel (reusing the requested week's)
		const weekResultsList = await Promise.all(
			uniqueWeeks.map(async weekNum => {
				if (weekNum === week) return gameResults;
				const weekGames = await NFLService.getWeeklyGames(weekNum, season);
				return weekGames.map(game => ({
					id: game.id,
					homeScore: game.home.score || 0,
					awayScore: game.away.score || 0,
					homeTeam: game.home.team,
					awayTeam: game.away.team,
					status: game.status
				}));
			})
		);
		const gameResultsByWeek = new Map(uniqueWeeks.map((weekNum, i) => [weekNum, weekResultsList[i]]));

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
				calculatePointsFromOdds,
			pick.lockGameId
			);

			// Aggregate into user's season stats
			if (!seasonStatsMap.has(userId)) {
				seasonStatsMap.set(userId, {
					totalPoints: 0,
					totalTFSPoints: 0,
					correctPicks: 0,
					totalPicks: 0,
					weeksWon: 0
				});
			}

			const userStats = seasonStatsMap.get(userId);
			userStats.totalPoints += weeklyPoints;
			userStats.totalTFSPoints += tfsPoints;
			userStats.correctPicks += correct;
			userStats.totalPicks += completedGames; // Use completed games, not pick.picks.length
		}

		// Calculate weeks won for each user (weeks where they got 1st or tied for 1st)
		for (const weekNum of uniqueWeeks) {
			// Get all picks for this week
			const weekPicksForLeaderboard = allPicksForSeason.filter(p => p.week === weekNum);
			const weekResults = gameResultsByWeek.get(weekNum) || [];

			// Calculate each user's points for this week
			const weekScores = new Map<string, number>();
			let maxPointsForWeek = 0;

			for (const pick of weekPicksForLeaderboard) {
				const { weeklyPoints } = ScoringService.calculateWeekScore(
					pick.picks,
					weekResults,
					pick.tfsGame,
					pick.tfsScore,
					leagueMode,
					calculatePointsFromOdds,
				pick.lockGameId
				);

				const userId = pick.userId.toString();
				weekScores.set(userId, weeklyPoints);
				maxPointsForWeek = Math.max(maxPointsForWeek, weeklyPoints);
			}

			// Award "weeks won" to users who got max points (and max > 0)
			if (maxPointsForWeek > 0) {
				weekScores.forEach((points, userId) => {
					if (points === maxPointsForWeek && seasonStatsMap.has(userId)) {
						seasonStatsMap.get(userId).weeksWon++;
					}
				});
			}
		}

		// Format season stats with usernames
		const seasonStatsFormatted = allUsers.map(user => {
			const stat = seasonStatsMap.get(user._id.toString());
			return {
				userId: user._id.toString(),
				player: user.name || 'Unknown Player',
				image: user.image || null,
				totalPoints: stat?.totalPoints || 0,
				totalTFSPoints: stat?.totalTFSPoints || 0,
				totalPicks: stat?.totalPicks || 0,
				correctPicks: stat?.correctPicks || 0,
				weeksWon: stat?.weeksWon || 0,
				winPercentage: stat?.totalPicks > 0 ? (stat.correctPicks / stat.totalPicks) * 100 : 0
			};
		});

		return NextResponse.json({
			weeklyResults: resultsWithUsernames,
			seasonStats: seasonStatsFormatted
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
	}
}
