import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import SteveScoreEmail from '@/emails/SteveScoreEmail';
import StandardScoreEmail from '@/emails/StandardScoreEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron job

const resend = new Resend(process.env.RESEND_API_KEY);

interface GameResult {
	id: string;
	homeScore: number;
	awayScore: number;
	homeTeam: string;
	awayTeam: string;
	status: string;
}

interface LeaderboardEntry {
	userId: string;
	player: string;
	points: number;
	correct: number;
}

interface UpsetInfo {
	team: string;
	opponent: string;
	userCount: number;
	points?: number;
	players?: string[]; // Names of players who picked this upset
}

export async function GET(req: Request) {
	try {
		// Verify the request is from Vercel Cron
		const authHeader = req.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In development, allow without auth. In production, require cron secret
		if (process.env.NODE_ENV === 'production') {
			if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		await connectDB();

		const now = new Date();
		console.log(`[Score Emails] Running cron job at ${now.toISOString()}`);

		// Get the current week from NFLService (which auto-advances after all games complete)
		const currentWeek = await NFLService.getCurrentWeek();
		// Score the previous week (Monday Night Football just finished)
		const weekToScore = currentWeek - 1;

		if (weekToScore < 1) {
			console.log('[Score Emails] No previous week to score yet');
			return NextResponse.json({ message: 'No previous week to score' });
		}

		console.log(`[Score Emails] Sending score emails for week ${weekToScore}`);

		// Get game results for the week
		const games = await NFLService.getWeeklyGames(weekToScore);
		const gameResults: GameResult[] = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status || 'Unknown'
		}));

		// Get all users who have weekly score emails enabled
		const users = await User.find({
			'emailPreferences.weeklyScoreEmail': true
		});

		console.log(`[Score Emails] Found ${users.length} users with reminders enabled`);

		let emailsSent = 0;
		const errors: string[] = [];

		// Process each user
		for (const user of users) {
			try {
				// Find all leagues user is a member of
				const userLeagues = await League.find({
					members: user._id.toString()
				});

				if (userLeagues.length === 0) {
					continue;
				}

				// Process each league separately (send separate emails)
				for (const league of userLeagues) {
					try {
						const leagueId = league._id.toString();
						const leagueMode = league.mode || 'standard';

						// Get all picks for this week and league
						const allPicks = await Pick.find({
							week: weekToScore,
							leagueId
						}).lean();

						if (allPicks.length === 0) {
							console.log(`[Score Emails] No picks found for league ${league.name} week ${weekToScore}`);
							continue;
						}

						// Find user's pick
						const userPick = allPicks.find(p => p.userId.toString() === user._id.toString());

						if (!userPick) {
							console.log(`[Score Emails] User ${user.email} didn't make picks for league ${league.name}`);
							continue;
						}

						// Calculate scores for all users
						const leaderboard: LeaderboardEntry[] = [];
						let userScore = { points: 0, correct: 0 };

						for (const pick of allPicks) {
							const { weeklyPoints, correctPicks } = ScoringService.calculateWeekScore(
								pick.picks,
								gameResults,
								pick.tfsGame,
								pick.tfsScore,
								leagueMode,
								calculatePointsFromOdds
							);

							// Get user name
							const pickUser = await User.findById(pick.userId);
							const userName = pickUser?.name || 'Unknown Player';

							leaderboard.push({
								userId: pick.userId.toString(),
								player: userName,
								points: weeklyPoints,
								correct: correctPicks
							});

							if (pick.userId.toString() === user._id.toString()) {
								userScore = { points: weeklyPoints, correct: correctPicks };
							}
						}

						// Sort leaderboard by points descending
						leaderboard.sort((a, b) => b.points - a.points);

						// Find user's rank (1-indexed)
						const userRank = leaderboard.findIndex(entry => entry.userId === user._id.toString()) + 1;

						// Calculate total possible points
						const completedGames = gameResults.filter(g => g.status === 'post' || g.status === 'final');
						let maxPossiblePoints = 0;

						if (leagueMode === 'steve') {
							// Steve mode: 2 points per correct pick
							maxPossiblePoints = completedGames.length * 2;
						} else {
							// Standard mode: sum the max points for each game based on odds
							// For each completed game, find the maximum points possible (higher odds team)
							for (const game of completedGames) {
								// Find picks for this game to get the odds
								let maxGamePoints = 5; // Default max if no odds found
								for (const pick of allPicks) {
									const gamePick = pick.picks.find((p: { gameId: string }) => p.gameId === game.id);
									if (gamePick && gamePick.odds) {
										const points = calculatePointsFromOdds(gamePick.odds);
										maxGamePoints = Math.max(maxGamePoints, points);
									}
								}
								maxPossiblePoints += maxGamePoints;
							}
						}

						// Find the biggest upset
						let upsetInfo: UpsetInfo | null = null;

						if (leagueMode === 'steve') {
							// Steve mode: Find the game where most users picked the LOSING team
							const gameUpsetCounts = new Map<string, { winningTeam: string; losingTeam: string; count: number; players: string[] }>();

							for (const pick of allPicks) {
								const pickUser = leaderboard.find(entry => entry.userId === pick.userId.toString());
								const playerName = pickUser?.player || 'Unknown Player';

								for (const gamePick of pick.picks) {
									const gameResult = gameResults.find(g => g.id === gamePick.gameId);
									if (!gameResult) continue;

									// Determine if this pick was wrong
									const isWrong = gamePick.isCorrect === false;

									if (isWrong) {
										// gamePick.team = the team that was picked (and lost)
										// gamePick.opponent = the team that won (the upset winner)
										const key = `${gamePick.gameId}-${gamePick.team}`;
										if (!gameUpsetCounts.has(key)) {
											gameUpsetCounts.set(key, {
												winningTeam: gamePick.opponent, // The team that won
												losingTeam: gamePick.team,      // The team that was picked and lost
												count: 0,
												players: []
											});
										}
										const entry = gameUpsetCounts.get(key)!;
										entry.count++;
										entry.players.push(playerName);
									}
								}
							}

							// Find the game with the most wrong picks
							let maxWrongPicks = 0;
							for (const [, value] of Array.from(gameUpsetCounts.entries())) {
								if (value.count > maxWrongPicks) {
									maxWrongPicks = value.count;
									upsetInfo = {
										team: value.winningTeam,    // The upset winner
										opponent: value.losingTeam, // The team people picked (and lost)
										userCount: value.count,
										players: value.players
									};
								}
							}
						} else {
							// Standard mode: Find the biggest upset that was CORRECT (highest points awarded)
							const teamPointCounts = new Map<string, { count: number; points: number; opponent: string; players: string[] }>();

							// Build map of correct upset picks
							for (const pick of allPicks) {
								const pickUser = leaderboard.find(entry => entry.userId === pick.userId.toString());
								const playerName = pickUser?.player || 'Unknown Player';

								for (const gamePick of pick.picks) {
									if (gamePick.isCorrect === true && gamePick.odds) {
										const points = calculatePointsFromOdds(gamePick.odds);

										const key = gamePick.team;
										if (!teamPointCounts.has(key)) {
											teamPointCounts.set(key, {
												count: 0,
												points: points,
												opponent: gamePick.opponent,
												players: []
											});
										}
										const entry = teamPointCounts.get(key)!;
										entry.count++;
										entry.players.push(playerName);
									}
								}
							}

							// Find the highest-point upset
							let maxPoints = 0;
							for (const [team, value] of Array.from(teamPointCounts.entries())) {
								if (value.points > maxPoints) {
									maxPoints = value.points;
									upsetInfo = {
										team: team,
										opponent: value.opponent,
										userCount: value.count,
										points: value.points,
										players: value.players
									};
								}
							}
						}

						// Send email
						try {
							const emailHtml = await render(
								leagueMode === 'steve'
									? SteveScoreEmail({
											userName: user.name || 'Player',
											leagueName: league.name,
											weekNumber: weekToScore,
											userPoints: userScore.points,
											maxPoints: maxPossiblePoints,
											userRank: userRank,
											totalPlayers: leaderboard.length,
											leaderboard: leaderboard.slice(0, 5), // Top 5
											upsetInfo: upsetInfo,
											unsubscribeToken: user.unsubscribeToken || ''
										})
									: StandardScoreEmail({
											userName: user.name || 'Player',
											leagueName: league.name,
											weekNumber: weekToScore,
											userPoints: userScore.points,
											maxPoints: maxPossiblePoints,
											userRank: userRank,
											totalPlayers: leaderboard.length,
											leaderboard: leaderboard.slice(0, 5), // Top 5
											upsetInfo: upsetInfo,
											unsubscribeToken: user.unsubscribeToken || ''
										})
							);

							await resend.emails.send({
								from: 'Pick 5 <noreply@sportspick5.com>',
								to: user.email,
								subject: `📊 Week ${weekToScore} Results - ${league.name}`,
								html: emailHtml
							});

							emailsSent++;
							console.log(`[Score Emails] Sent email to ${user.email} for league ${league.name}`);
						} catch (emailError) {
							console.error(`[Score Emails] Failed to send email to ${user.email} for league ${league.name}:`, emailError);
							errors.push(`Email failed for ${user.email} - ${league.name}`);
						}
					} catch (leagueError) {
						console.error(`[Score Emails] Error processing league ${league.name}:`, leagueError);
						errors.push(`Failed to process league ${league.name}`);
					}
				}
			} catch (userError) {
				console.error(`[Score Emails] Error processing user ${user.email}:`, userError);
				errors.push(`Failed to process ${user.email}`);
			}
		}

		const response = {
			success: true,
			week: weekToScore,
			emailsSent,
			errors: errors.length > 0 ? errors : undefined
		};

		console.log('[Score Emails] Cron job completed:', response);

		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('[Score Emails] Cron job failed:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Cron job failed',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
}
