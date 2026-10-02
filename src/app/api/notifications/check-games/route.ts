import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

// Configure web-push (guarded so `next build` doesn't need the VAPID keys;
// at runtime this module loads on first request, after env vars are available)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
	webPush.setVapidDetails(
		process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com',
		process.env.VAPID_PUBLIC_KEY,
		process.env.VAPID_PRIVATE_KEY
	);
}

interface GameResult {
	gameId: string;
	homeTeam: string;
	awayTeam: string;
	homeScore: number;
	awayScore: number;
	winner: string | null;
}

interface UserGamePick {
	leagueId: string;
	leagueName: string;
	leagueMode: string;
	gameId: string;
	pickedTeam: string;
	opponent: string;
	isWin: boolean;
	points: number;
}

/**
 * Client-side polling endpoint for checking game completions
 * Only checks and sends notifications for the authenticated user
 */
export async function GET() {
	try {
		// Check user session
		const session = await getServerSession(authOptions);
		if (!session?.user?.email) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		// Get user
		const user = await User.findOne({ email: session.user.email });
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Check if user has notifications enabled
		if (!user.pushNotificationsEnabled) {
			return NextResponse.json({ message: 'Push notifications disabled', notificationsSent: 0 });
		}

		// Check if season is active for notifications
		const seasonStatus = await SeasonService.getSeasonStatus();
		if (!seasonStatus.canSendNotifications) {
			return NextResponse.json({ message: 'Season is not active', notificationsSent: 0 });
		}

		// Check if user has game results enabled
		const gameResultsEnabled = user.pushNotificationPreferences?.gameResults !== false;
		if (!gameResultsEnabled) {
			return NextResponse.json({ message: 'Game result notifications disabled', notificationsSent: 0 });
		}

		// Get current week
		const currentWeek = await NFLService.getCurrentWeek(false);

		// Get all games for current week
		const games = await NFLService.getWeeklyGames(currentWeek);

		// Find completed games
		const completedGames: GameResult[] = games
			.filter(game => {
				const status = game.status?.toLowerCase();
				return status === 'final' || status === 'post' || status === 'status_final';
			})
			.map(game => {
				const homeScore = game.home.score || 0;
				const awayScore = game.away.score || 0;
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
			return NextResponse.json({ message: 'No completed games', notificationsSent: 0 });
		}

		// Get user's picks for these games
		const gameIds = completedGames.map(g => g.gameId);
		const userPicks = await Pick.find({
			userId: user._id,
			week: currentWeek,
			'picks.gameId': { $in: gameIds }
		}).lean();

		if (userPicks.length === 0) {
			return NextResponse.json({ message: 'No picks for completed games', notificationsSent: 0 });
		}

		// Build list of notifications to send
		const notificationsToSend: UserGamePick[] = [];

		for (const pick of userPicks) {
			const league = await League.findById(pick.leagueId);
			if (!league) continue;

			for (const gamePick of pick.picks) {
				const completedGame = completedGames.find(g => g.gameId === gamePick.gameId);
				if (!completedGame) continue;

				// Check if already notified
				const alreadySent = await GameNotification.findOne({
					userId: user._id.toString(),
					gameId: gamePick.gameId,
					leagueId: pick.leagueId.toString(),
					week: currentWeek,
					notificationType: 'game_result'
				});

				if (alreadySent) continue;

				// Determine if user won
				const isWin = gamePick.team === completedGame.winner;

				// Calculate points
				let points = 0;
				if (isWin) {
					if (league.mode === 'steve') {
						points = 2;
					} else {
						points = gamePick.odds ? calculatePointsFromOdds(gamePick.odds) : 0;
					}
				}

				notificationsToSend.push({
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

		if (notificationsToSend.length === 0) {
			return NextResponse.json({ message: 'No new notifications to send', notificationsSent: 0 });
		}

		// Group by league
		const groupedByLeague = new Map<string, UserGamePick[]>();
		for (const notification of notificationsToSend) {
			if (!groupedByLeague.has(notification.leagueId)) {
				groupedByLeague.set(notification.leagueId, []);
			}
			groupedByLeague.get(notification.leagueId)!.push(notification);
		}

		let notificationsSent = 0;

		// Send notifications grouped by league
		for (const [leagueId, userGames] of Array.from(groupedByLeague.entries())) {
			const leagueName = userGames[0].leagueName;

			try {
				// Get user's push subscriptions
				const subscriptions = await PushSubscription.find({ userId: user._id.toString() });

				if (subscriptions.length === 0) {
					console.log(`[Check Games] No subscriptions for user ${user._id}`);
					continue;
				}

				// Build notification message
				let title: string;
				let body: string;

				if (userGames.length === 1) {
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
					url: `/league/${leagueId}`,
					tag: `game-result-${currentWeek}-${leagueId}`,
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
					} catch (pushError: any) {
						if (pushError.statusCode === 410) {
							await PushSubscription.deleteOne({ _id: subscription._id });
						}
					}
				}

				// Mark games as notified
				for (const game of userGames) {
					try {
						await GameNotification.create({
							userId: user._id.toString(),
							gameId: game.gameId,
							leagueId: game.leagueId,
							week: currentWeek,
							notificationType: 'game_result'
						});
					} catch (e) {
						if ((e as any).code !== 11000) {
							console.error('[Check Games] Error marking notification:', e);
						}
					}
				}
			} catch (error) {
				console.error(`[Check Games] Error processing league ${leagueId}:`, error);
			}
		}

		return NextResponse.json({
			success: true,
			week: currentWeek,
			completedGames: completedGames.length,
			notificationsSent
		});
	} catch (error: unknown) {
		console.error('[Check Games] Failed:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({ error: 'Failed to check games', details: errorMessage }, { status: 500 });
	}
}
