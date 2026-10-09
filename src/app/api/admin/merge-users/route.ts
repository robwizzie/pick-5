// src/app/api/admin/merge-users/route.ts
import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { connectDB } from '@/lib/db';
import { MergeError, mergeUsers, planMerge } from '@/lib/mergeUsers';

export const dynamic = 'force-dynamic';

/**
 * Merge a duplicate account into the one being kept.
 * Body: { fromUserId, keepUserId, dryRun? } — dryRun (the default) only reports what would move.
 */
export async function POST(req: Request) {
	const session = await checkAdminAuth();
	if (!session) {
		return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
	}

	try {
		const body = await req.json();
		const fromUserId = String(body.fromUserId ?? '').trim();
		const keepUserId = String(body.keepUserId ?? '').trim();
		const dryRun = body.dryRun !== false;

		await connectDB();
		const result = dryRun ? await planMerge(fromUserId, keepUserId) : await mergeUsers(fromUserId, keepUserId);
		return NextResponse.json({ dryRun, ...result });
	} catch (error) {
		if (error instanceof MergeError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		console.error('Error merging users:', error);
		return NextResponse.json({ error: 'Failed to merge users', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
	}
}
