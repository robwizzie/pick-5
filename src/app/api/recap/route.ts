import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { NFLService } from '@/services/nflService';
import { GET as getOddsSnapshot } from '@/app/api/odds/snapshot/route';
import { parseSeasonParam, seasonPickFilter } from '@/lib/season';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '0', 10);
		const leagueId = searchParams.get('leagueId');
		// Optional ?season=YYYY; defaults to the current season
		const season = parseSeasonParam(searchParams.get('season'));

		if (!leagueId || !week) {
			return NextResponse.json({ error: 'League ID and week are required' }, { status: 400 });
		}

		await connectDB();

		// Fetch the league to get member list and mode
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}
		const leagueMode = (league as any).mode || 'standard';

		// Get all picks for this week and league
		const allPicksForWeek = await Pick.find({ week, leagueId, ...seasonPickFilter(season) }).lean();

		// If no picks exist for this week, return early
		if (allPicksForWeek.length === 0) {
			return NextResponse.json({
				hasPicks: false,
				weekCompleted: false
			});
		}

		// Get game results for the week
		let games = await NFLService.getWeeklyGames(week, season);

		// Fetch odds from snapshot for Standard mode leagues
		if (leagueMode === 'standard') {
			try {
				// Call the snapshot handler in-process instead of fetching our own public URL:
				// one fewer request against the hosting quota, and a Worker fetching its own
				// hostname is not guaranteed to route back to itself on Cloudflare.
				const oddsResponse = await getOddsSnapshot(new Request(`http://internal/api/odds/snapshot?week=${week}`));
				if (oddsResponse.ok) {
					const oddsData = await oddsResponse.json();
					const snapshotOdds = oddsData.odds || [];

					// Attach odds to games
					games = games.map(game => {
						const gameOdds = snapshotOdds.find((o: any) => o.id === game.id);
						if (gameOdds) {
							return {
								...game,
								away: { ...game.away, odds: gameOdds.away?.odds },
								home: { ...game.home, odds: gameOdds.home?.odds }
							};
						}
						return game;
					});
				}
			} catch (error) {
				console.error('Error fetching odds for recap:', error);
			}
		}

		// Check if all games are completed
		const allGamesCompleted = games.every(g => {
			const status = g.status?.toLowerCase();
			return status === 'post' || status === 'final' || status === 'status_final';
		});

		if (!allGamesCompleted) {
			return NextResponse.json({
				hasPicks: true,
				weekCompleted: false
			});
		}

		// Get all users in the league
		const allUsers = await User.find({ _id: { $in: league.members } }, 'name image');
		const userMap = new Map(allUsers.map(u => [u._id.toString(), { name: u.name, image: u.image }]));

		// Calculate pick statistics
		const gamePickStats = new Map<string, {
			game: any;
			awayPicks: Array<{ userId: string; name: string; image: string | null }>;
			homePicks: Array<{ userId: string; name: string; image: string | null }>;
			winner: 'away' | 'home' | null;
			awayOdds?: number;
			homeOdds?: number;
		}>();

		// Initialize game stats
		for (const game of games) {
			gamePickStats.set(game.id, {
				game,
				awayPicks: [],
				homePicks: [],
				winner: (game.away.score ?? 0) > (game.home.score ?? 0) ? 'away' :
				         (game.home.score ?? 0) > (game.away.score ?? 0) ? 'home' : null,
				awayOdds: game.away.odds,
				homeOdds: game.home.odds
			});
		}

		// Populate picks
		for (const pick of allPicksForWeek) {
			const userId = pick.userId.toString();
			const userInfo = userMap.get(userId);
			if (!userInfo) continue;

			for (const gamePick of pick.picks) {
				const stats = gamePickStats.get(gamePick.gameId);
				if (!stats) continue;

				const pickData = {
					userId,
					name: userInfo.name,
					image: userInfo.image
				};

				if (gamePick.isHome) {
					stats.homePicks.push(pickData);
				} else {
					stats.awayPicks.push(pickData);
				}
			}
		}

		// Calculate upsets and most picked games
		const upsets: Array<{
			gameId: string;
			game: any;
			team: string;
			opponent: string;
			odds: number;
			points: number;
			pickCount: number;
			correctPickers: Array<{ userId: string; name: string; image: string | null }>;
			leaguePicks: {
				away: Array<{ userId: string; name: string; image: string | null }>;
				home: Array<{ userId: string; name: string; image: string | null }>;
			};
		}> = [];

		const mostPickedCorrect: Array<{
			gameId: string;
			game: any;
			winningTeam: string;
			losingTeam: string;
			pickCount: number;
			totalPicks: number;
			pickers: Array<{ userId: string; name: string; image: string | null }>;
			leaguePicks: {
				away: Array<{ userId: string; name: string; image: string | null }>;
				home: Array<{ userId: string; name: string; image: string | null }>;
			};
		}> = [];

		const mostPickedIncorrect: Array<{
			gameId: string;
			game: any;
			losingTeam: string;
			winningTeam: string;
			pickCount: number;
			totalPicks: number;
			pickers: Array<{ userId: string; name: string; image: string | null }>;
			leaguePicks: {
				away: Array<{ userId: string; name: string; image: string | null }>;
				home: Array<{ userId: string; name: string; image: string | null }>;
			};
		}> = [];

		// Analyze each game
		for (const [gameId, stats] of Array.from(gamePickStats.entries())) {
			if (!stats.winner) continue; // Skip ties

			const totalPicks = stats.awayPicks.length + stats.homePicks.length;
			if (totalPicks === 0) continue;

			const winningTeam = stats.winner === 'away' ? stats.game.away.team : stats.game.home.team;
			const losingTeam = stats.winner === 'away' ? stats.game.home.team : stats.game.away.team;
			const winningOdds = stats.winner === 'away' ? stats.awayOdds : stats.homeOdds;
			const correctPickers = stats.winner === 'away' ? stats.awayPicks : stats.homePicks;
			const incorrectPickers = stats.winner === 'away' ? stats.homePicks : stats.awayPicks;

			// Check for upset (underdog with +250 or worse wins)
			if (winningOdds && winningOdds >= 250) {
				upsets.push({
					gameId,
					game: stats.game,
					team: winningTeam,
					opponent: losingTeam,
					odds: winningOdds,
					points: Math.ceil(winningOdds / 100) + 1,
					pickCount: correctPickers.length,
					correctPickers,
					leaguePicks: {
						away: stats.awayPicks,
						home: stats.homePicks
					}
				});
			}

			// Track most picked games
			if (correctPickers.length > 0) {
				mostPickedCorrect.push({
					gameId,
					game: stats.game,
					winningTeam,
					losingTeam,
					pickCount: correctPickers.length,
					totalPicks,
					pickers: correctPickers,
					leaguePicks: {
						away: stats.awayPicks,
						home: stats.homePicks
					}
				});
			}

			if (incorrectPickers.length > 0) {
				mostPickedIncorrect.push({
					gameId,
					game: stats.game,
					losingTeam,
					winningTeam,
					pickCount: incorrectPickers.length,
					totalPicks,
					pickers: incorrectPickers,
					leaguePicks: {
						away: stats.awayPicks,
						home: stats.homePicks
					}
				});
			}
		}

		// Sort upsets by odds (biggest upset first)
		upsets.sort((a, b) => b.odds - a.odds);

		// Sort most picked by pick count
		mostPickedCorrect.sort((a, b) => b.pickCount - a.pickCount);
		mostPickedIncorrect.sort((a, b) => b.pickCount - a.pickCount);

		return NextResponse.json({
			hasPicks: true,
			weekCompleted: true,
			leagueMode,
			upsets: upsets.slice(0, 5), // Top 5 upsets
			mostPickedCorrect: mostPickedCorrect.slice(0, 3), // Top 3
			mostPickedIncorrect: mostPickedIncorrect.slice(0, 3) // Top 3
		});
	} catch (error) {
		console.error('Error fetching recap data:', error);
		return NextResponse.json({ error: 'Failed to fetch recap data' }, { status: 500 });
	}
}
