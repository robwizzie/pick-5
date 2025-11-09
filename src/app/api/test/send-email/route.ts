import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import ThursdayReminderEmail from '@/emails/ThursdayReminderEmail';
import SaturdayReminderEmail from '@/emails/SaturdayReminderEmail';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id || !session?.user?.email) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const type = searchParams.get('type') || 'thursday'; // 'thursday' or 'saturday'

		// Mock data for testing
		const mockLeagues = [
			{
				id: 'test-league-1',
				name: 'NFL PICK 5',
				mode: 'steve'
			},
			{
				id: 'test-league-2',
				name: 'Sunday Showdown',
				mode: 'standard'
			}
		];

		const mockThursdayGame = {
			awayTeam: 'Dallas Cowboys',
			homeTeam: 'New York Giants',
			gameTime: '8:15 PM ET'
		};

		// Send test email
		if (type === 'thursday') {
			const emailHtml = render(
				ThursdayReminderEmail({
					userName: session.user.name || 'Player',
					thursdayGame: mockThursdayGame,
					leagues: mockLeagues,
					unsubscribeToken: 'test-token-12345'
				})
			);

			await resend.emails.send({
				from: 'Pick 5 <noreply@sportspick5.com>',
				to: session.user.email,
				subject: '🏈 [TEST] Thursday Night Football starts soon! Make your picks',
				html: emailHtml
			});
		} else {
			const emailHtml = render(
				SaturdayReminderEmail({
					userName: session.user.name || 'Player',
					leagues: mockLeagues,
					unsubscribeToken: 'test-token-12345'
				})
			);

			await resend.emails.send({
				from: 'Pick 5 <noreply@sportspick5.com>',
				to: session.user.email,
				subject: '⏰ [TEST] Last chance! Get your picks in before Sunday',
				html: emailHtml
			});
		}

		return NextResponse.json({
			success: true,
			message: `Test ${type} email sent to ${session.user.email}`,
			type,
			recipient: session.user.email
		});
	} catch (error: unknown) {
		console.error('Error sending test email:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to send test email',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
}
