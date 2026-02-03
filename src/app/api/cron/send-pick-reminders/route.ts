import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { PushSubscription } from '@/models/PushSubscription';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import webPush from 'web-push';
import ThursdayReminderEmail from '@/emails/ThursdayReminderEmail';
import SaturdayReminderEmail from '@/emails/SaturdayReminderEmail';
import { NFLService } from '@/services/nflService';
import { SeasonService } from '@/services/seasonService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron job

const resend = new Resend(process.env.RESEND_API_KEY);

// Configure web-push
webPush.setVapidDetails(
	process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com',
	process.env.VAPID_PUBLIC_KEY || '',
	process.env.VAPID_PRIVATE_KEY || ''
);


// Helper to get Thursday night game from actual NFL data
async function getThursdayNightGame(week: number) {
	try {
		const games = await NFLService.getWeeklyGames(week);
		console.log(`[Pick Reminders] Checking ${games.length} games for Thursday game`);

		// Find the Thursday night game - check in both UTC and ET
		const thursdayGame = games.find(game => {
			const gameDate = new Date(game.date);
			// Check day of week in ET timezone (Thursday = 4)
			const etDay = new Date(gameDate.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
			const utcDay = gameDate.getDay();

			console.log(`[Pick Reminders] Game: ${game.away.team} @ ${game.home.team}, Date: ${gameDate.toISOString()}, UTC Day: ${utcDay}, ET Day: ${etDay}`);

			// Thursday night games are typically on Thursday (4) in ET, might be Friday (5) in UTC
			return etDay === 4 || utcDay === 4;
		});

		if (thursdayGame) {
			const gameDate = new Date(thursdayGame.date);
			const timeString = gameDate.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				timeZone: 'America/New_York',
				timeZoneName: 'short'
			});

			console.log(`[Pick Reminders] Found Thursday game: ${thursdayGame.away.team} @ ${thursdayGame.home.team} at ${timeString}`);

			return {
				awayTeam: thursdayGame.away.team,
				homeTeam: thursdayGame.home.team,
				gameTime: timeString
			};
		}

		console.log('[Pick Reminders] No Thursday game found, using fallback');
	} catch (error) {
		console.error('[Pick Reminders] Error fetching Thursday night game:', error);
	}

	// Fallback if no Thursday game found
	return {
		awayTeam: 'Thursday Night Football',
		homeTeam: '',
		gameTime: '8:15 PM ET'
	};
}

export async function GET(req: Request) {
	try {
		// Verify the request is from Vercel Cron
		const authHeader = req.headers.get('authorization');
		if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		// Check if season is active
		const seasonStatus = await SeasonService.getSeasonStatus();
		if (!seasonStatus.isActive) {
			console.log('[Pick Reminders] Season is not active, skipping');
			return NextResponse.json({
				message: 'Season is not active',
				seasonActive: false
			});
		}

		// Determine which day it is
		const now = new Date();
		const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday, 6 = Saturday
		const currentHour = now.getHours();

		console.log(`[Pick Reminders] Running cron job - Day: ${dayOfWeek}, Hour: ${currentHour}`);

		// Get current NFL week from NFLService (without auto-advance)
		// We want the ACTUAL current week for pick reminders, not the next week
		const currentWeek = await NFLService.getCurrentWeek(false);
		console.log(`[Pick Reminders] Current NFL week (for picks): ${currentWeek}`);

		// Determine if this is Thursday or Saturday reminder
		const isThursday = dayOfWeek === 4;
		const isSaturday = dayOfWeek === 6;

		if (!isThursday && !isSaturday) {
			console.log('[Pick Reminders] Not Thursday or Saturday, skipping');
			return NextResponse.json({ message: 'Not a reminder day' });
		}

		// Get all users who have reminders enabled
		const users = await User.find({
			'emailPreferences.pickReminders': true,
			...(isThursday && {
				'emailPreferences.thursdayReminder': true
			}),
			...(isSaturday && {
				'emailPreferences.saturdayReminder': true
			})
		});

		console.log(`[Pick Reminders] Found ${users.length} users with reminders enabled`);

		let emailsSent = 0;
		let pushNotificationsSent = 0;
		const errors: string[] = [];

		// Get Thursday night game info for Thursday emails
		const thursdayGame = isThursday ? await getThursdayNightGame(currentWeek) : null;

		// Helper to delay between API calls to avoid rate limiting
		const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

				// Check which leagues user hasn't made picks for
				const leaguesWithoutPicks = [];
				for (const league of userLeagues) {
					const existingPick = await Pick.findOne({
						userId: user._id.toString(),
						leagueId: league._id.toString(),
						week: currentWeek
					});

					if (!existingPick) {
						leaguesWithoutPicks.push({
							id: league._id.toString(),
							name: league.name,
							mode: league.mode
						});
					}
				}

				if (leaguesWithoutPicks.length === 0) {
					// User has made picks for all leagues
					continue;
				}

				console.log(`[Pick Reminders] User ${user.email} needs reminders for ${leaguesWithoutPicks.length} leagues`);

				// Send email (one email per user listing all leagues)
				try {
					if (user.emailPreferences?.pickReminders) {
						const emailHtml = await render(
							isThursday
								? ThursdayReminderEmail({
										userName: user.name || 'Player',
										thursdayGame: thursdayGame!,
										leagues: leaguesWithoutPicks,
										unsubscribeToken: user.unsubscribeToken || ''
									})
								: SaturdayReminderEmail({
										userName: user.name || 'Player',
										leagues: leaguesWithoutPicks,
										unsubscribeToken: user.unsubscribeToken || ''
									})
						);

						const emailResult = await resend.emails.send({
							from: 'Pick 5 <noreply@sportspick5.com>',
							to: user.email,
							subject: isThursday
								? `🏈 Thursday Night Football starts soon! Make your picks`
								: `⏰ Last chance! Get your picks in before Sunday`,
							html: emailHtml
						});

						if (emailResult.error) {
							console.error(`[Pick Reminders] Resend API error for ${user.email}:`, emailResult.error);
							errors.push(`Email failed for ${user.email}: ${emailResult.error.message}`);
						} else {
							emailsSent++;
							console.log(`[Pick Reminders] Email sent to ${user.email} (ID: ${emailResult.data?.id})`);
						}

						// Rate limit: wait 600ms between emails (max ~1.6 req/sec, under 2 req/sec limit)
						await delay(600);
					}
				} catch (emailError) {
					console.error(`[Pick Reminders] Failed to send email to ${user.email}:`, emailError);
					errors.push(`Email failed for ${user.email}: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
				}

				// Send push notification
				try {
					if (user.pushNotificationsEnabled) {
						const subscriptions = await PushSubscription.find({
							userId: user._id.toString()
						});

						if (subscriptions.length === 0) {
							console.log(`[Pick Reminders] No push subscriptions found for ${user.email}`);
						}

						for (const subscription of subscriptions) {
							try {
								// Build push notification message
								let pushBody: string;
								if (isThursday && thursdayGame) {
									if (thursdayGame.homeTeam) {
										pushBody = `${thursdayGame.awayTeam} vs ${thursdayGame.homeTeam} starts at ${thursdayGame.gameTime}! Make your picks.`;
									} else {
										pushBody = `${thursdayGame.awayTeam} starts at ${thursdayGame.gameTime}! Make your picks.`;
									}
								} else {
									pushBody = `Don't miss out! Make your picks before Sunday's games.`;
								}

								const pushPayload = {
									title: isThursday ? '🏈 Thursday Night Football!' : '⏰ Last Chance for Picks!',
									body: pushBody,
									url: '/dashboard',
									leagueIds: leaguesWithoutPicks.map(l => l.id),
									tag: 'pick-reminder'
								};

								console.log(`[Pick Reminders] Sending push to ${user.email}: ${JSON.stringify(pushPayload)}`);

								await webPush.sendNotification(
									{
										endpoint: subscription.endpoint,
										keys: {
											p256dh: subscription.keys.p256dh,
											auth: subscription.keys.auth
										}
									},
									JSON.stringify(pushPayload)
								);

								pushNotificationsSent++;
								console.log(`[Pick Reminders] Push notification sent successfully to ${user.email}`);
							} catch (pushError: any) {
								// If subscription is no longer valid, delete it
								if (pushError.statusCode === 410) {
									await PushSubscription.deleteOne({ _id: subscription._id });
									console.log(`[Pick Reminders] Removed invalid subscription for ${user.email}`);
								} else {
									console.error(`[Pick Reminders] Failed to send push to ${user.email}:`, pushError);
								}
							}
						}
					}
				} catch (pushError) {
					console.error(`[Pick Reminders] Failed to send push notifications to ${user.email}:`, pushError);
					errors.push(`Push notification failed for ${user.email}`);
				}
			} catch (userError) {
				console.error(`[Pick Reminders] Error processing user ${user.email}:`, userError);
				errors.push(`Failed to process ${user.email}`);
			}
		}

		const response = {
			success: true,
			day: isThursday ? 'Thursday' : 'Saturday',
			week: currentWeek,
			emailsSent,
			pushNotificationsSent,
			errors: errors.length > 0 ? errors : undefined
		};

		console.log('[Pick Reminders] Cron job completed:', response);

		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('[Pick Reminders] Cron job failed:', error);
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
