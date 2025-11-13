import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint to verify email setup and user preferences
 * Visit: /api/test-email-setup
 */
export async function GET() {
	try {
		const results: any = {
			resendConfigured: false,
			usersWithPickReminders: 0,
			usersWithThursdayReminders: 0,
			usersWithSaturdayReminders: 0,
			sampleUsers: [],
			errors: []
		};

		// Check if Resend API key is configured
		const resendKey = process.env.RESEND_API_KEY;
		if (resendKey) {
			results.resendConfigured = true;
			results.resendKeyPreview = `${resendKey.substring(0, 8)}...${resendKey.substring(resendKey.length - 4)}`;
		} else {
			results.errors.push('RESEND_API_KEY not found in environment variables');
		}

		// Connect to database
		try {
			await connectDB();
			results.databaseConnected = true;
		} catch (dbError) {
			results.databaseConnected = false;
			results.errors.push(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
			return NextResponse.json(results, { status: 500 });
		}

		// Count users with different email preferences
		const usersWithPickReminders = await User.countDocuments({
			'emailPreferences.pickReminders': true
		});

		const usersWithThursdayReminders = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.thursdayReminder': true
		});

		const usersWithSaturdayReminders = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.saturdayReminder': true
		});

		results.usersWithPickReminders = usersWithPickReminders;
		results.usersWithThursdayReminders = usersWithThursdayReminders;
		results.usersWithSaturdayReminders = usersWithSaturdayReminders;

		// Get sample users (first 5) with their preferences
		const sampleUsers = await User.find({
			'emailPreferences.pickReminders': true
		})
			.limit(5)
			.select('email name emailPreferences pushNotificationsEnabled')
			.lean();

		results.sampleUsers = sampleUsers.map(user => ({
			email: user.email,
			name: user.name,
			pickReminders: user.emailPreferences?.pickReminders || false,
			thursdayReminder: user.emailPreferences?.thursdayReminder || false,
			saturdayReminder: user.emailPreferences?.saturdayReminder || false,
			thursdayReminderTime: user.emailPreferences?.thursdayReminderTime || 'not set',
			saturdayReminderTime: user.emailPreferences?.saturdayReminderTime || 'not set',
			pushNotifications: user.pushNotificationsEnabled || false
		}));

		// Test Resend connection (don't actually send email)
		if (resendKey) {
			try {
				const resend = new Resend(resendKey);
				// Resend doesn't have a "test connection" endpoint, so we'll just verify we can instantiate it
				results.resendInstanceCreated = true;
			} catch (resendError) {
				results.errors.push(`Resend initialization failed: ${resendError instanceof Error ? resendError.message : 'Unknown error'}`);
			}
		}

		// Check current time for debugging time-window filtering
		const now = new Date();
		results.currentTime = {
			iso: now.toISOString(),
			dayOfWeek: now.getDay(),
			dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
			hour: now.getHours(),
			utcHour: now.getUTCHours()
		};

		return NextResponse.json(results);
	} catch (error) {
		return NextResponse.json(
			{
				error: 'Test failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
