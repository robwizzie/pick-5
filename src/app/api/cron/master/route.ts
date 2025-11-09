import { NextResponse } from 'next/server';

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

		// Tuesday (2): Fetch odds
		if (dayOfWeek === 2) {
			console.log('[Master Cron] Tuesday - Fetching odds');
			const oddsResult = await fetchOdds(req);
			results.push({ task: 'fetch-odds', day: 'Tuesday', result: oddsResult });
		}

		// Thursday (4): Send reminders
		if (dayOfWeek === 4) {
			console.log('[Master Cron] Thursday - Sending pick reminders');
			const reminderResult = await sendReminders(req);
			results.push({ task: 'send-reminders', day: 'Thursday', result: reminderResult });
		}

		// Friday (5): Fetch odds
		if (dayOfWeek === 5) {
			console.log('[Master Cron] Friday - Fetching odds');
			const oddsResult = await fetchOdds(req);
			results.push({ task: 'fetch-odds', day: 'Friday', result: oddsResult });
		}

		// Saturday (6): Send reminders
		if (dayOfWeek === 6) {
			console.log('[Master Cron] Saturday - Sending pick reminders');
			const reminderResult = await sendReminders(req);
			results.push({ task: 'send-reminders', day: 'Saturday', result: reminderResult });
		}

		// Sunday (0): Fetch odds
		if (dayOfWeek === 0) {
			console.log('[Master Cron] Sunday - Fetching odds');
			const oddsResult = await fetchOdds(req);
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

/**
 * Fetch and store odds snapshots
 */
async function fetchOdds(req: Request): Promise<any> {
	try {
		const baseUrl = process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:3000';

		const response = await fetch(`${baseUrl}/api/cron/fetch-odds`, {
			method: 'GET',
			headers: {
				'authorization': req.headers.get('authorization') || ''
			}
		});

		if (!response.ok) {
			const error = await response.text();
			return { success: false, error };
		}

		return await response.json();
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Send pick reminder emails
 */
async function sendReminders(req: Request): Promise<any> {
	try {
		const baseUrl = process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:3000';

		const response = await fetch(`${baseUrl}/api/cron/send-pick-reminders`, {
			method: 'GET',
			headers: {
				'authorization': req.headers.get('authorization') || ''
			}
		});

		if (!response.ok) {
			const error = await response.text();
			return { success: false, error };
		}

		return await response.json();
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
