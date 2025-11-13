import { NextResponse } from 'next/server';
import { GET as sendPickReminders } from '../send-pick-reminders/route';
import { GET as sendScoreEmailsHandler } from '../send-score-emails/route';
import { GET as fetchOddsHandler } from '../fetch-odds/route';

export const dynamic = 'force-dynamic';

/**
 * Master cron job that handles multiple scheduled tasks
 * This consolidates odds fetching and email reminders into a single endpoint
 * to stay within Vercel's cron job limits
 */
export async function GET(req: Request) {
	try {
		// Verify this is being called by Vercel Cron
		const authHeader = req.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		// In development, allow without auth. In production, require cron secret
		if (process.env.NODE_ENV === 'production') {
			if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}
		}

		const now = new Date();
		const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
		const results: any[] = [];

		console.log(`[Master Cron] Running at ${now.toISOString()}, day of week: ${dayOfWeek}`);

		// Tuesday (2): Send score emails and fetch odds
		if (dayOfWeek === 2) {
			console.log('[Master Cron] Tuesday - Sending score emails');
			const scoreEmailResponse = await sendScoreEmailsHandler(req);
			const scoreEmailResult = await scoreEmailResponse.json();
			console.log('[Master Cron] Score email result:', JSON.stringify(scoreEmailResult, null, 2));
			results.push({ task: 'send-score-emails', day: 'Tuesday', result: scoreEmailResult });

			console.log('[Master Cron] Tuesday - Fetching odds');
			const oddsResponse = await fetchOddsHandler(req);
			const oddsResult = await oddsResponse.json();
			console.log('[Master Cron] Odds fetch result:', JSON.stringify(oddsResult, null, 2));
			results.push({ task: 'fetch-odds', day: 'Tuesday', result: oddsResult });
		}

		// Thursday (4): Send reminders
		if (dayOfWeek === 4) {
			console.log('[Master Cron] Thursday - Sending pick reminders');
			const reminderResponse = await sendPickReminders(req);
			const reminderResult = await reminderResponse.json();
			console.log('[Master Cron] Thursday reminder result:', JSON.stringify(reminderResult, null, 2));
			results.push({ task: 'send-reminders', day: 'Thursday', result: reminderResult });
		}

		// Friday (5): Fetch odds
		if (dayOfWeek === 5) {
			console.log('[Master Cron] Friday - Fetching odds');
			const oddsResponse = await fetchOddsHandler(req);
			const oddsResult = await oddsResponse.json();
			results.push({ task: 'fetch-odds', day: 'Friday', result: oddsResult });
		}

		// Saturday (6): Send reminders
		if (dayOfWeek === 6) {
			console.log('[Master Cron] Saturday - Sending pick reminders');
			const reminderResponse = await sendPickReminders(req);
			const reminderResult = await reminderResponse.json();
			console.log('[Master Cron] Saturday reminder result:', JSON.stringify(reminderResult, null, 2));
			results.push({ task: 'send-reminders', day: 'Saturday', result: reminderResult });
		}

		// Sunday (0): Fetch odds
		if (dayOfWeek === 0) {
			console.log('[Master Cron] Sunday - Fetching odds');
			const oddsResponse = await fetchOddsHandler(req);
			const oddsResult = await oddsResponse.json();
			results.push({ task: 'fetch-odds', day: 'Sunday', result: oddsResult });
		}

		return NextResponse.json({
			success: true,
			timestamp: now.toISOString(),
			dayOfWeek,
			tasksExecuted: results
		});
	} catch (error) {
		console.error('[Master Cron] Error:', error);
		return NextResponse.json(
			{
				error: 'Master cron job failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
