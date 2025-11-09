import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// GET user settings
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const user = await User.findById(session.user.id);

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({
			emailPreferences: user.emailPreferences || {
				pickReminders: true,
				thursdayReminder: true,
				saturdayReminder: true,
				thursdayReminderTime: '13:00',
				saturdayReminderTime: '12:00'
			},
			pushNotificationsEnabled: user.pushNotificationsEnabled || false
		});
	} catch (error: unknown) {
		console.error('Error fetching user settings:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to fetch settings',
				details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
			},
			{ status: 500 }
		);
	}
}

// POST update user settings
export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { emailPreferences, pushNotificationsEnabled } = body;

		await connectDB();

		const user = await User.findById(session.user.id);

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Update email preferences if provided
		if (emailPreferences) {
			user.emailPreferences = {
				...user.emailPreferences,
				...emailPreferences
			};
		}

		// Update push notification preference if provided
		if (typeof pushNotificationsEnabled === 'boolean') {
			user.pushNotificationsEnabled = pushNotificationsEnabled;
		}

		await user.save();

		return NextResponse.json({
			success: true,
			message: 'Settings updated successfully',
			emailPreferences: user.emailPreferences,
			pushNotificationsEnabled: user.pushNotificationsEnabled
		});
	} catch (error: unknown) {
		console.error('Error updating user settings:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to update settings',
				details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
			},
			{ status: 500 }
		);
	}
}
