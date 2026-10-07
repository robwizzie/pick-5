import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

/** Turn off every email (reminders and weekly results) for the user owning `token`. */
async function unsubscribe(token: string | undefined): Promise<'ok' | 'invalid'> {
	if (!token || !/^[a-f0-9]{16,128}$/i.test(token)) return 'invalid';
	await connectDB();
	const res = await User.updateOne(
		{ unsubscribeToken: token },
		{
			$set: {
				'emailPreferences.pickReminders': false,
				'emailPreferences.thursdayReminder': false,
				'emailPreferences.saturdayReminder': false,
				'emailPreferences.weeklyScoreEmail': false,
				updatedAt: new Date()
			}
		}
	);
	return res.matchedCount > 0 ? 'ok' : 'invalid';
}

/** Link in the email footer: unsubscribe, then show the confirmation page. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
	try {
		const { token } = await params;
		if ((await unsubscribe(token)) === 'invalid') {
			return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 });
		}
		return NextResponse.redirect(new URL('/unsubscribed', req.url));
	} catch (error: unknown) {
		console.error('Error unsubscribing user:', error);
		return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
	}
}

/** RFC 8058 one-click unsubscribe (the List-Unsubscribe-Post header mail clients use). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
	try {
		const { token } = await params;
		if ((await unsubscribe(token)) === 'invalid') {
			return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 });
		}
		return NextResponse.json({ success: true });
	} catch (error: unknown) {
		console.error('Error unsubscribing user:', error);
		return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
	}
}
