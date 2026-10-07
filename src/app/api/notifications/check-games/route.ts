import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retired. Browsers used to poll this every 5 minutes during games to trigger game-result
 * pushes because the cron only ran once a day. The cron now checks every 10 minutes during
 * game windows (see src/lib/notifications/schedule.ts), so this answers without doing any work,
 * for tabs still running the old client code until they reload.
 */
export function GET() {
	return NextResponse.json({ deprecated: true, notificationsSent: 0 });
}
