import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { isValidObjectId } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { getNudgeStatus, markNudgeOpened, sendNudge } from '@/lib/nudges';
import { NUDGE_OPEN_VIAS, type NudgeOpenVia } from '@/lib/nudgeTypes';

export const dynamic = 'force-dynamic';

/** GET /api/league/[id]/nudge — who has picks in this week, who's been nudged, and who the viewer can nudge. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		if (!isValidObjectId(id)) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		const status = await getNudgeStatus(id, viewerId);
		if (!status) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		return NextResponse.json(status);
	} catch (error) {
		console.error('Error fetching nudges:', error);
		return NextResponse.json({ error: 'Failed to load nudges' }, { status: 500 });
	}
}

/** POST /api/league/[id]/nudge { userId } — nudge a league-mate to get this week's picks in (one per player per week). */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		if (!isValidObjectId(id)) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		const body = await req.json().catch(() => ({}));
		if (typeof body.userId !== 'string' || !body.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

		const result = await sendNudge(id, viewerId, body.userId);
		if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
		return NextResponse.json(result);
	} catch (error) {
		console.error('Error sending nudge:', error);
		return NextResponse.json({ error: 'Failed to send nudge' }, { status: 500 });
	}
}

/** PATCH /api/league/[id]/nudge { opened: 'push' | 'email' | 'banner' } — the viewer opened the league from their nudge. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		if (!isValidObjectId(id)) return NextResponse.json({ error: 'League not found' }, { status: 404 });
		const body = await req.json().catch(() => ({}));
		if (!NUDGE_OPEN_VIAS.includes(body.opened)) return NextResponse.json({ error: 'opened must be push, email or banner' }, { status: 400 });

		const recorded = await markNudgeOpened(id, viewerId, body.opened as NudgeOpenVia);
		return NextResponse.json({ recorded });
	} catch (error) {
		console.error('Error recording nudge open:', error);
		return NextResponse.json({ error: 'Failed to record nudge open' }, { status: 500 });
	}
}
