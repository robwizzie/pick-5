import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
	try {
		const { token } = await params;

		if (!token) {
			return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
		}

		await connectDB();

		// Find user by unsubscribe token
		const user = await User.findOne({ unsubscribeToken: token });

		if (!user) {
			return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 });
		}

		// Disable all email reminders
		user.emailPreferences = {
			pickReminders: false,
			thursdayReminder: false,
			saturdayReminder: false,
			thursdayReminderTime: user.emailPreferences?.thursdayReminderTime || '13:00',
			saturdayReminderTime: user.emailPreferences?.saturdayReminderTime || '12:00'
		};

		await user.save();

		// Redirect to a confirmation page
		return NextResponse.redirect(new URL('/unsubscribed', req.url));
	} catch (error: unknown) {
		console.error('Error unsubscribing user:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to unsubscribe',
				details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
			},
			{ status: 500 }
		);
	}
}
