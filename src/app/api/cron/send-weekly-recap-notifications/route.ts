import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { PushSubscription } from '@/models/PushSubscription';
import { GameNotification } from '@/models/GameNotification';
import webPush from 'web-push';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron job

// Configure web-push
webPush.setVapidDetails(
	process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com',
	process.env.VAPID_PUBLIC_KEY || '',
	process.env.VAPID_PRIVATE_KEY || ''
);

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
		console.log(`[Weekly Recap Notifications] Running at ${now.toISOString()}`);

		// Get the completed week (use auto-advance since we're scoring the previous week)
		const currentWeek = await NFLService.getCurrentWeek(true);
		const completedWeek = currentWeek - 1;

		if (completedWeek < 1) {
			console.log('[Weekly Recap Notifications] No previous week to recap yet');
			return NextResponse.json({ message: 'No previous week to recap' });
		}

		console.log(`[Weekly Recap Notifications] Sending recaps for Week ${completedWeek}`);

		// Get game results for the completed week
		const games = await NFLService.getWeeklyGames(completedWeek);
		const gameResults = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status || 'Unknown'
		}));

		// Get all users with push notifications enabled
		// We'll check weeklyRecap preference later (defaulting to true if not set)
		const users = await User.find({
			pushNotificationsEnabled: true
		});

		console.log(`[Weekly Recap Notifications] Found ${users.length} users with weekly recap enabled`);

		let notificationsSent = 0;
		const errors: string[] = [];

		// Process each user
		for (const user of users) {
			try {
				// Check if user has weekly recap enabled (default to true if not set)
				const weeklyRecapEnabled = user.pushNotificationPreferences?.weeklyRecap !== false;
				if (!weeklyRecapEnabled) {
					continue;
				}

				// Find all leagues user is a member of
				const userLeagues = await League.find({
					members: user._id.toString()
				});

				if (userLeagues.length === 0) continue;

				// Get user's push subscriptions
				const subscriptions = await PushSubscription.find({
					userId: user._id.toString()
				});

				if (subscriptions.length === 0) continue;

				// Cache for game results by week to avoid repeated API calls
				const gameResultsCache = new Map<number, Array<{
					id: string;
					homeScore: number;
					awayScore: number;
					homeTeam: string;
					awayTeam: string;
					status: string;
				}>>();

				// Process each league
				for (const league of userLeagues) {
					try {
						const leagueId = league._id.toString();

						// Check if we already sent weekly recap for this league
						const alreadySent = await GameNotification.findOne({
							userId: user._id.toString(),
							leagueId,
							week: completedWeek,
							notificationType: 'weekly_recap'
						});

						if (alreadySent) continue;

						// Get all picks for this week and league
						const allPicks = await Pick.find({
							week: completedWeek,
							leagueId
						}).lean();

						if (allPicks.length === 0) continue;

						// Find user's pick
						const userPick = allPicks.find(p => p.userId.toString() === user._id.toString());
						if (!userPick) continue;

						// Calculate user's score
						const { weeklyPoints } = ScoringService.calculateWeekScore(
							userPick.picks,
							gameResults,
							userPick.tfsGame,
							userPick.tfsScore,
							league.mode || 'standard',
							calculatePointsFromOdds
						);

						// Calculate leaderboard to get user's rank
						const leaderboard: Array<{ userId: string; points: number; seasonPoints: number }> = [];

						for (const pick of allPicks) {
							const { weeklyPoints: points } = ScoringService.calculateWeekScore(
								pick.picks,
								gameResults,
								pick.tfsGame,
								pick.tfsScore,
								league.mode || 'standard',
								calculatePointsFromOdds
							);

							// Get season total
							const allUserPicks = await Pick.find({
								userId: pick.userId,
								leagueId,
								week: { $lte: completedWeek }
							}).lean();

							let seasonPoints = 0;
							for (const weekPick of allUserPicks) {
								const weekNum = weekPick.week;

								// Check cache first, fetch if not cached
								let weekGameResults = gameResultsCache.get(weekNum);
								if (!weekGameResults) {
									const weekGames = await NFLService.getWeeklyGames(weekNum);
									weekGameResults = weekGames.map(g => ({
										id: g.id,
										homeScore: g.home.score || 0,
										awayScore: g.away.score || 0,
										homeTeam: g.home.team,
										awayTeam: g.away.team,
										status: g.status || 'Unknown'
									}));
									gameResultsCache.set(weekNum, weekGameResults);
								}

								const { weeklyPoints: pts } = ScoringService.calculateWeekScore(
									weekPick.picks,
									weekGameResults,
									weekPick.tfsGame,
									weekPick.tfsScore,
									league.mode || 'standard',
									calculatePointsFromOdds
								);

								seasonPoints += pts;
							}

							leaderboard.push({
								userId: pick.userId.toString(),
								points,
								seasonPoints
							});
						}

						// Sort by season points
						leaderboard.sort((a, b) => b.seasonPoints - a.seasonPoints);

						// Find user's rank
						const userRank = leaderboard.findIndex(entry => entry.userId === user._id.toString()) + 1;
						const totalPlayers = leaderboard.length;
						const userSeasonPoints = leaderboard.find(entry => entry.userId === user._id.toString())?.seasonPoints || 0;

						// Build notification
						const title = `🏆 Week ${completedWeek} Complete!`;
						const body = `${league.name}: ${weeklyPoints} ${weeklyPoints === 1 ? 'pt' : 'pts'} (#${userRank}/${totalPlayers}). Season: ${userSeasonPoints} pts`;

						const payload = {
							title,
							body,
							url: `/league/${leagueId}`,
							tag: `weekly-recap-${completedWeek}-${leagueId}`,
							leagueId
						};

						// Send to all subscriptions
						for (const subscription of subscriptions) {
							try {
								await webPush.sendNotification(
									{
										endpoint: subscription.endpoint,
										keys: {
											p256dh: subscription.keys.p256dh,
											auth: subscription.keys.auth
										}
									},
									JSON.stringify(payload)
								);

								notificationsSent++;
								console.log(`[Weekly Recap Notifications] Sent to ${user.email} for league ${league.name}`);
							} catch (pushError: any) {
								if (pushError.statusCode === 410) {
									await PushSubscription.deleteOne({ _id: subscription._id });
									console.log(`[Weekly Recap Notifications] Removed invalid subscription`);
								} else {
									console.error(`[Weekly Recap Notifications] Push error:`, pushError);
								}
							}
						}

						// Mark as sent
						try {
							await GameNotification.create({
								userId: user._id.toString(),
								gameId: `week-${completedWeek}-recap`,
								leagueId,
								week: completedWeek,
								notificationType: 'weekly_recap'
							});
						} catch (e) {
							// Ignore duplicate key errors
							if ((e as any).code !== 11000) {
								console.error('[Weekly Recap Notifications] Error marking notification:', e);
							}
						}
					} catch (leagueError) {
						console.error(`[Weekly Recap Notifications] Error processing league ${league.name}:`, leagueError);
						errors.push(`Failed for league ${league.name}`);
					}
				}
			} catch (userError) {
				console.error(`[Weekly Recap Notifications] Error processing user ${user.email}:`, userError);
				errors.push(`Failed for user ${user.email}`);
			}
		}

		const response = {
			success: true,
			week: completedWeek,
			notificationsSent,
			errors: errors.length > 0 ? errors : undefined
		};

		console.log('[Weekly Recap Notifications] Completed:', response);

		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('[Weekly Recap Notifications] Cron job failed:', error);
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
