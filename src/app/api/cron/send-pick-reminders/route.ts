import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { PushSubscription } from '@/models/PushSubscription';
import { Resend } from 'resend';
import webPush from 'web-push';
import { ThursdayReminderEmail } from '@/emails/ThursdayReminderEmail';
import { SaturdayReminderEmail } from '@/emails/SaturdayReminderEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for cron job

const resend = new Resend(process.env.RESEND_API_KEY);

// Configure web-push
webPush.setVapidDetails(
	process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com',
	process.env.VAPID_PUBLIC_KEY || '',
	process.env.VAPID_PRIVATE_KEY || ''
);

// Helper to get current NFL week (simplified - you may want to use your existing logic)
function getCurrentNFLWeek(): number {
	// For now, return a static week. Replace with your actual week calculation logic
	// You could fetch this from your games API or calculate based on the season start date
	const seasonStart = new Date('2024-09-05'); // Example: Week 1 starts Sept 5, 2024
	const now = new Date();
	const diffTime = Math.abs(now.getTime() - seasonStart.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	const week = Math.min(Math.ceil(diffDays / 7), 18);
	return week;
}

// Helper to get Thursday night game (you'll need to fetch from your games data)
async function getThursdayNightGame(week: number) {
	// This is a placeholder. You should fetch from your actual games data source
	// For now, returning mock data
	return {
		awayTeam: 'Away Team',
		homeTeam: 'Home Team',
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

		// Determine which day it is
		const now = new Date();
		const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday, 6 = Saturday
		const currentHour = now.getHours();

		console.log(`[Pick Reminders] Running cron job - Day: ${dayOfWeek}, Hour: ${currentHour}`);

		// Get current NFL week
		const currentWeek = getCurrentNFLWeek();
		console.log(`[Pick Reminders] Current NFL week: ${currentWeek}`);

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

		// Process each user
		for (const user of users) {
			try {
				// Check if user's preferred reminder time matches current hour
				if (isThursday) {
					const [thursdayHour] = (user.emailPreferences?.thursdayReminderTime || '13:00').split(':');
					if (parseInt(thursdayHour) !== currentHour) {
						continue;
					}
				} else if (isSaturday) {
					const [saturdayHour] = (user.emailPreferences?.saturdayReminderTime || '12:00').split(':');
					if (parseInt(saturdayHour) !== currentHour) {
						continue;
					}
				}

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

				// Send email
				try {
					if (user.emailPreferences?.pickReminders) {
						const emailData = isThursday
							? {
									userName: user.name || 'Player',
									thursdayGame: thursdayGame!,
									leagues: leaguesWithoutPicks,
									unsubscribeToken: user.unsubscribeToken || ''
								}
							: {
									userName: user.name || 'Player',
									leagues: leaguesWithoutPicks,
									unsubscribeToken: user.unsubscribeToken || ''
								};

						await resend.emails.send({
							from: 'Pick 5 <noreply@sportspick5.com>',
							to: user.email,
							subject: isThursday
								? `🏈 Thursday Night Football starts soon! Make your picks`
								: `⏰ Last chance! Get your picks in before Sunday`,
							react: isThursday ? ThursdayReminderEmail(emailData as any) : SaturdayReminderEmail(emailData as any)
						});

						emailsSent++;
						console.log(`[Pick Reminders] Email sent to ${user.email}`);
					}
				} catch (emailError) {
					console.error(`[Pick Reminders] Failed to send email to ${user.email}:`, emailError);
					errors.push(`Email failed for ${user.email}`);
				}

				// Send push notification
				try {
					if (user.pushNotificationsEnabled) {
						const subscriptions = await PushSubscription.find({
							userId: user._id.toString()
						});

						for (const subscription of subscriptions) {
							try {
								const pushPayload = {
									title: isThursday ? '🏈 Thursday Night Football!' : '⏰ Last Chance for Picks!',
									body: isThursday
										? `${thursdayGame!.awayTeam} vs ${thursdayGame!.homeTeam} starts soon! Make your picks.`
										: `Don't miss out! Make your picks before Sunday's games.`,
									url: '/dashboard',
									leagueIds: leaguesWithoutPicks.map(l => l.id),
									tag: 'pick-reminder'
								};

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
								console.log(`[Pick Reminders] Push notification sent to ${user.email}`);
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
