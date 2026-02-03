import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { PushSubscription } from '@/models/PushSubscription';
import { GameNotification } from '@/models/GameNotification';
import webPush from 'web-push';
import { NFLService } from '@/services/nflService';
import { SeasonService } from '@/services/seasonService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron job

// Configure web-push
webPush.setVapidDetails(
	process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com',
	process.env.VAPID_PUBLIC_KEY || '',
	process.env.VAPID_PRIVATE_KEY || ''
);

interface GameResult {
	gameId: string;
	homeTeam: string;
	awayTeam: string;
	homeScore: number;
	awayScore: number;
	winner: string | null; // null for ties
}

interface UserGamePick {
	userId: string;
	userName: string;
	leagueId: string;
	leagueName: string;
	leagueMode: string;
	gameId: string;
	pickedTeam: string;
	opponent: string;
	isWin: boolean;
	points: number;
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
		console.log(`[Game Notifications] Running at ${now.toISOString()}`);

		// Check if season is active
		const seasonStatus = await SeasonService.getSeasonStatus();
		if (!seasonStatus.isActive) {
			console.log('[Game Notifications] Season is not active, skipping');
			return NextResponse.json({
				message: 'Season is not active',
				seasonActive: false
			});
		}

		// Get current week (without auto-advance to check actual current week)
		const currentWeek = await NFLService.getCurrentWeek(false);
		console.log(`[Game Notifications] Checking Week ${currentWeek}`);

		// Get all games for current week
		const games = await NFLService.getWeeklyGames(currentWeek);

		// Find newly completed games (status = final or post)
		const completedGames: GameResult[] = games
			.filter(game => {
				const status = game.status?.toLowerCase();
				return status === 'final' || status === 'post' || status === 'status_final';
			})
			.map(game => {
				const homeScore = game.home.score || 0;
				const awayScore = game.away.score || 0;
				// Handle ties - no winner if scores are equal
				const winner = homeScore > awayScore ? game.home.team : homeScore < awayScore ? game.away.team : null;

				return {
					gameId: game.id,
					homeTeam: game.home.team,
					awayTeam: game.away.team,
					homeScore,
					awayScore,
					winner
				};
			});

		if (completedGames.length === 0) {
			console.log('[Game Notifications] No completed games found');
			return NextResponse.json({ message: 'No completed games', notificationsSent: 0 });
		}

		console.log(`[Game Notifications] Found ${completedGames.length} completed games`);

		// Get all picks for these games
		const gameIds = completedGames.map(g => g.gameId);
		const allPicks = await Pick.find({
			week: currentWeek,
			'picks.gameId': { $in: gameIds }
		}).lean();

		console.log(`[Game Notifications] Found ${allPicks.length} picks for completed games`);

		// Build list of user-game-league combinations that need notifications
		const notificationsToSend: UserGamePick[] = [];

		for (const pick of allPicks) {
			const user = await User.findById(pick.userId);
			if (!user || !user.pushNotificationsEnabled) {
				continue;
			}

			// Check if user has game results enabled (default to true if not set)
			const gameResultsEnabled = user.pushNotificationPreferences?.gameResults !== false;
			if (!gameResultsEnabled) {
				continue;
			}

			const league = await League.findById(pick.leagueId);
			if (!league) continue;

			// Check each game pick
			for (const gamePick of pick.picks) {
				const completedGame = completedGames.find(g => g.gameId === gamePick.gameId);
				if (!completedGame) continue;

				// Check if we already sent a notification for this
				const alreadySent = await GameNotification.findOne({
					userId: pick.userId.toString(),
					gameId: gamePick.gameId,
					leagueId: pick.leagueId.toString(),
					week: currentWeek,
					notificationType: 'game_result'
				});

				if (alreadySent) continue;

				// Determine if user won
				const isWin = gamePick.team === completedGame.winner;

				// Calculate points based on league mode
				let points = 0;
				if (isWin) {
					if (league.mode === 'steve') {
						points = 2; // Steve mode: 2 points per correct pick
					} else {
						// Standard mode: calculate from odds
						points = gamePick.odds ? calculatePointsFromOdds(gamePick.odds) : 0;
					}
				}

				notificationsToSend.push({
					userId: pick.userId.toString(),
					userName: user.name || 'Player',
					leagueId: pick.leagueId.toString(),
					leagueName: league.name,
					leagueMode: league.mode || 'standard',
					gameId: gamePick.gameId,
					pickedTeam: gamePick.team,
					opponent: gamePick.opponent,
					isWin,
					points
				});
			}
		}

		console.log(`[Game Notifications] ${notificationsToSend.length} notifications to send`);

		// Group notifications by user and league (send one notification per user per league)
		const groupedNotifications = new Map<string, UserGamePick[]>();
		for (const notification of notificationsToSend) {
			const key = `${notification.userId}-${notification.leagueId}`;
			if (!groupedNotifications.has(key)) {
				groupedNotifications.set(key, []);
			}
			groupedNotifications.get(key)!.push(notification);
		}

		let notificationsSent = 0;
		const errors: string[] = [];

		// Send grouped notifications
		for (const [_key, userGames] of Array.from(groupedNotifications.entries())) {
			const firstGame = userGames[0];
			const userId = firstGame.userId;
			const leagueName = firstGame.leagueName;

			try {
				// Get user's push subscriptions
				const subscriptions = await PushSubscription.find({ userId });

				if (subscriptions.length === 0) {
					console.log(`[Game Notifications] No subscriptions for user ${userId}`);
					continue;
				}

				// Build notification message
				let title: string;
				let body: string;

				if (userGames.length === 1) {
					// Single game notification
					const game = userGames[0];
					const totalPoints = game.points;

					if (game.isWin) {
						title = `✅ ${game.pickedTeam} Won!`;
						body = `+${totalPoints} ${totalPoints === 1 ? 'pt' : 'pts'} in "${leagueName}"`;
					} else {
						title = `❌ ${game.pickedTeam} Lost`;
						body = `0 pts in "${leagueName}"`;
					}
				} else {
					// Multiple games - group them
					const wins = userGames.filter(g => g.isWin).length;
					const losses = userGames.length - wins;
					const totalPoints = userGames.reduce((sum, g) => sum + g.points, 0);

					title = `${userGames.length} Games Finished!`;
					const winEmoji = '✅'.repeat(wins);
					const lossEmoji = '❌'.repeat(losses);
					body = `${winEmoji}${lossEmoji} +${totalPoints} ${totalPoints === 1 ? 'pt' : 'pts'} in "${leagueName}"`;
				}

				const payload = {
					title,
					body,
					url: `/league/${firstGame.leagueId}`,
					tag: `game-result-${currentWeek}-${firstGame.leagueId}`,
					leagueId: firstGame.leagueId
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
						console.log(`[Game Notifications] Sent to user ${userId} for league ${leagueName}`);
					} catch (pushError: any) {
						if (pushError.statusCode === 410) {
							await PushSubscription.deleteOne({ _id: subscription._id });
							console.log(`[Game Notifications] Removed invalid subscription`);
						} else {
							console.error(`[Game Notifications] Push error:`, pushError);
						}
					}
				}

				// Mark all games as notified
				for (const game of userGames) {
					try {
						await GameNotification.create({
							userId: game.userId,
							gameId: game.gameId,
							leagueId: game.leagueId,
							week: currentWeek,
							notificationType: 'game_result'
						});
					} catch (e) {
						// Ignore duplicate key errors (already marked)
						if ((e as any).code !== 11000) {
							console.error('[Game Notifications] Error marking notification:', e);
						}
					}
				}
			} catch (error) {
				console.error(`[Game Notifications] Error processing user ${userId}:`, error);
				errors.push(`Failed for user ${userId}`);
			}
		}

		const response = {
			success: true,
			week: currentWeek,
			completedGames: completedGames.length,
			notificationsToSend: notificationsToSend.length,
			notificationsSent,
			errors: errors.length > 0 ? errors : undefined
		};

		console.log('[Game Notifications] Completed:', response);

		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('[Game Notifications] Cron job failed:', error);
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
