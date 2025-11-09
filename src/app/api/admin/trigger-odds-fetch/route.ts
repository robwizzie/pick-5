import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to manually trigger odds fetch
 * This bypasses the cron secret requirement for emergency manual fetches
 */
export async function POST(req: Request) {
	try {
		// Verify user is authenticated (basic protection)
		const session = await getServerSession(authOptions);

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - must be logged in' }, { status: 401 });
		}

		console.log(`[Admin Trigger] ${session.user?.email} manually triggering odds fetch`);

		// Get the base URL
		const baseUrl = process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}`
			: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

		// Call the fetch-odds endpoint with the cron secret
		const cronSecret = process.env.CRON_SECRET;
		const headers: HeadersInit = {};

		if (cronSecret) {
			headers['authorization'] = `Bearer ${cronSecret}`;
		}

		const response = await fetch(`${baseUrl}/api/cron/fetch-odds`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Admin Trigger] Failed to fetch odds:', errorText);
			return NextResponse.json(
				{
					error: 'Failed to fetch odds',
					details: errorText,
					status: response.status
				},
				{ status: response.status }
			);
		}

		const result = await response.json();
		console.log('[Admin Trigger] Odds fetch completed:', result);

		return NextResponse.json({
			success: true,
			message: 'Odds fetched successfully',
			result
		});
	} catch (error) {
		console.error('[Admin Trigger] Error:', error);
		return NextResponse.json(
			{
				error: 'Failed to trigger odds fetch',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
