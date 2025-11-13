import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

/**
 * Fix email preferences for all users
 * This adds default email preferences to users who don't have them
 *
 * Visit: /api/admin/fix-email-prefs
 */
export async function GET() {
	try {
		await connectDB();

		// Find all users
		const allUsers = await User.find().lean();

		const results = {
			totalUsers: allUsers.length,
			usersWithoutPrefs: 0,
			usersUpdated: 0,
			errors: [] as string[],
			details: [] as any[]
		};

		for (const user of allUsers) {
			// Check if user is missing emailPreferences or has incomplete preferences
			const needsUpdate = !user.emailPreferences ||
				user.emailPreferences.pickReminders === undefined ||
				user.emailPreferences.thursdayReminder === undefined ||
				user.emailPreferences.saturdayReminder === undefined ||
				user.emailPreferences.weeklyScoreEmail === undefined;

			if (needsUpdate) {
				results.usersWithoutPrefs++;

				try {
					await User.updateOne(
						{ _id: user._id },
						{
							$set: {
								'emailPreferences.pickReminders': true,
								'emailPreferences.thursdayReminder': true,
								'emailPreferences.saturdayReminder': true,
								'emailPreferences.weeklyScoreEmail': true,
								'emailPreferences.thursdayReminderTime': '13:00',
								'emailPreferences.saturdayReminderTime': '12:00'
							}
						}
					);

					results.usersUpdated++;
					results.details.push({
						email: user.email,
						status: 'updated'
					});
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					results.errors.push(`Failed to update ${user.email}: ${errorMsg}`);
					results.details.push({
						email: user.email,
						status: 'failed',
						error: errorMsg
					});
				}
			} else {
				results.details.push({
					email: user.email,
					status: 'already_has_prefs'
				});
			}
		}

		// Verify the fix
		const usersWithThursdayEnabled = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.thursdayReminder': true
		});

		results.details.push({
			verification: {
				usersEligibleForThursdayReminders: usersWithThursdayEnabled
			}
		});

		return NextResponse.json({
			success: true,
			message: `Updated ${results.usersUpdated} out of ${results.usersWithoutPrefs} users who needed email preferences`,
			...results
		});
	} catch (error) {
		console.error('[Fix Email Prefs] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to fix email preferences',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
