import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { isValidObjectId } from 'mongoose';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { LeagueMessage } from '@/models/LeagueMessage';
import { User } from '@/models/User';
import { getCurrentSeasonYear } from '@/lib/season';
import { postLeagueMoments } from '@/lib/leagueMoments';
import { FEED_MESSAGE_MAX, FEED_PAGE_SIZE, FEED_REACTIONS, type FeedMessage, type FeedResponse } from '@/lib/feed';

export const dynamic = 'force-dynamic';

/** Minimum gap between one member's chat messages. */
const CHAT_COOLDOWN_MS = 2_000;
/** Moments are a bonus: never hold the feed up longer than this waiting on scores. */
const MOMENTS_BUDGET_MS = 2_500;

type LeanMessage = {
	_id: unknown;
	kind: 'chat' | 'moment';
	userId?: string | null;
	userIds?: string[];
	text: string;
	emoji?: string | null;
	week?: number | null;
	createdAt: Date;
	reactions?: Record<string, unknown>;
};

/** The viewer's league (members + commissioner), or an error response. */
async function memberLeague(leagueId: string, viewerId: string) {
	if (!isValidObjectId(leagueId)) return { error: NextResponse.json({ error: 'League not found' }, { status: 404 }) };
	await connectDB();
	const league = await League.findById(leagueId, 'members creatorId').lean<{ members?: string[]; creatorId?: string }>();
	if (!league) return { error: NextResponse.json({ error: 'League not found' }, { status: 404 }) };
	const members = (league.members ?? []).map(String);
	if (!members.includes(viewerId)) return { error: NextResponse.json({ error: 'Not a member of this league' }, { status: 403 }) };
	return { league: { members, creatorId: league.creatorId } };
}

/** Only real reaction lists: emoji -> userIds. Anything else (e.g. a stray internal key) is ignored. */
function reactionLists(reactions: unknown): Array<[string, string[]]> {
	if (!reactions || typeof reactions !== 'object') return [];
	return Object.entries(reactions as Record<string, unknown>).filter((entry): entry is [string, string[]] => (FEED_REACTIONS as readonly string[]).includes(entry[0]) && Array.isArray(entry[1]));
}

/** Rewrite `reactions` keeping only real reaction lists (drops junk such as a '$*' key mongoose once wrote). */
async function repairReactions(ids: unknown[]) {
	if (ids.length === 0) return;
	const allowed = [...FEED_REACTIONS];
	await LeagueMessage.collection.updateMany({ _id: { $in: ids as never[] } }, [
		{
			$set: {
				reactions: {
					$arrayToObject: { $filter: { input: { $objectToArray: { $ifNull: ['$reactions', {}] } }, cond: { $and: [{ $isArray: '$$this.v' }, { $in: ['$$this.k', allowed] }] } } }
				}
			}
		}
	]);
}

const hasJunkReactions = (reactions: unknown) =>
	!!reactions && typeof reactions === 'object' && Object.keys(reactions).length !== reactionLists(reactions).length;

async function toFeedMessages(docs: LeanMessage[], viewerId: string): Promise<FeedMessage[]> {
	// A malformed id would make the whole lookup (and so the feed) fail; those authors just show as former members
	const authorIds = Array.from(new Set(docs.map(d => d.userId).filter((id): id is string => !!id && isValidObjectId(id))));
	const users = authorIds.length ? await User.find({ _id: { $in: authorIds } }, 'name image').lean<Array<{ _id: unknown; name?: string; image?: string | null }>>() : [];
	const userById = new Map(users.map(u => [String(u._id), u]));
	return docs.map(d => {
		const reactions = reactionLists(d.reactions);
		const author = d.userId ? userById.get(d.userId) : undefined;
		return {
			id: String(d._id),
			kind: d.kind,
			userId: d.userId ?? null,
			name: author?.name ?? (d.kind === 'chat' ? 'Former member' : null),
			image: author?.image ?? null,
			text: d.text,
			emoji: d.emoji ?? null,
			week: d.week ?? null,
			createdAt: new Date(d.createdAt).toISOString(),
			reactions: Object.fromEntries(reactions.filter(([, ids]) => ids.length > 0).map(([emoji, ids]) => [emoji, ids.length])),
			mine: reactions.filter(([, ids]) => ids.includes(viewerId)).map(([emoji]) => emoji)
		};
	});
}

/**
 * GET /api/league/[id]/feed[?before=ISO][&week=N]
 * Newest messages first. Without `before` (the live view) it also posts any new game-day
 * moments for `week` and the week before it.
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const access = await memberLeague(id, viewerId);
		if ('error' in access) return access.error;

		const { searchParams } = new URL(req.url);
		const before = searchParams.get('before');
		const week = parseInt(searchParams.get('week') || '', 10);
		if (!before && Number.isInteger(week) && week >= 1 && week <= 18) {
			await Promise.race([postLeagueMoments(id, getCurrentSeasonYear(), [week - 1, week]), new Promise(resolve => setTimeout(resolve, MOMENTS_BUDGET_MS))]);
		}

		const filter: Record<string, unknown> = { leagueId: id };
		const beforeDate = before ? new Date(before) : null;
		if (beforeDate && !Number.isNaN(beforeDate.getTime())) filter.createdAt = { $lt: beforeDate };
		const docs = await LeagueMessage.find(filter)
			.sort({ createdAt: -1 })
			.limit(FEED_PAGE_SIZE + 1)
			.lean<LeanMessage[]>();

		// Self-heal messages whose reactions picked up junk keys; reading already ignores them
		const broken = docs.filter(d => hasJunkReactions(d.reactions)).map(d => d._id);
		if (broken.length) await repairReactions(broken).catch(error => console.error('[feed] Failed to repair reactions:', error));

		const body: FeedResponse = { messages: await toFeedMessages(docs.slice(0, FEED_PAGE_SIZE), viewerId), hasMore: docs.length > FEED_PAGE_SIZE };
		return NextResponse.json(body);
	} catch (error) {
		console.error('Error fetching league feed:', error);
		return NextResponse.json({ error: 'Failed to load the feed' }, { status: 500 });
	}
}

/** POST /api/league/[id]/feed { text } — post a chat message. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const access = await memberLeague(id, viewerId);
		if ('error' in access) return access.error;

		const body = await req.json().catch(() => ({}));
		const text = typeof body.text === 'string' ? body.text.trim() : '';
		if (!text) return NextResponse.json({ error: 'Say something first' }, { status: 400 });
		if (text.length > FEED_MESSAGE_MAX) return NextResponse.json({ error: `Keep it under ${FEED_MESSAGE_MAX} characters` }, { status: 400 });

		const last = await LeagueMessage.findOne({ leagueId: id, userId: viewerId, kind: 'chat' }, 'createdAt').sort({ createdAt: -1 }).lean<{ createdAt: Date }>();
		if (last && Date.now() - new Date(last.createdAt).getTime() < CHAT_COOLDOWN_MS) {
			return NextResponse.json({ error: 'Easy there — one message at a time' }, { status: 429 });
		}

		const doc = await LeagueMessage.create({ leagueId: id, kind: 'chat', userId: viewerId, text, season: getCurrentSeasonYear() });
		const [message] = await toFeedMessages([doc.toObject() as LeanMessage], viewerId);
		return NextResponse.json(message, { status: 201 });
	} catch (error) {
		console.error('Error posting to league feed:', error);
		return NextResponse.json({ error: 'Failed to post' }, { status: 500 });
	}
}

/** PATCH /api/league/[id]/feed { messageId, emoji } — toggle the viewer's reaction. */
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const access = await memberLeague(id, viewerId);
		if ('error' in access) return access.error;

		const body = await req.json().catch(() => ({}));
		const emoji = body.emoji as string;
		if (!FEED_REACTIONS.includes(emoji as (typeof FEED_REACTIONS)[number]) || typeof body.messageId !== 'string' || !isValidObjectId(body.messageId)) {
			return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
		}

		const message = await LeagueMessage.findOne({ _id: body.messageId, leagueId: id }, 'reactions').lean<LeanMessage>();
		if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

		// Atomic toggle on the raw collection. Saving the mongoose Map of arrays instead could
		// write mongoose's internal '$*' path into the document, which broke the whole feed.
		const reacted = reactionLists(message.reactions).some(([e, ids]) => e === emoji && ids.includes(viewerId));
		const path = `reactions.${emoji}`;
		if (hasJunkReactions(message.reactions)) await repairReactions([message._id]);
		await LeagueMessage.collection.updateOne(
			{ _id: message._id as never },
			reacted ? { $pull: { [path]: viewerId } as never, $currentDate: { updatedAt: true } } : { $addToSet: { [path]: viewerId } as never, $currentDate: { updatedAt: true } }
		);

		const fresh = await LeagueMessage.findById(message._id).lean<LeanMessage>();
		if (!fresh) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
		const [updated] = await toFeedMessages([fresh], viewerId);
		return NextResponse.json(updated);
	} catch (error) {
		console.error('Error reacting in league feed:', error);
		return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
	}
}

/** DELETE /api/league/[id]/feed?messageId= — delete your own message (the commissioner can delete any chat). */
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		const viewerId = session?.user?.id;
		if (!viewerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await context.params;
		const access = await memberLeague(id, viewerId);
		if ('error' in access) return access.error;

		const messageId = new URL(req.url).searchParams.get('messageId');
		if (!messageId || !isValidObjectId(messageId)) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
		const message = await LeagueMessage.findOne({ _id: messageId, leagueId: id, kind: 'chat' }, 'userId').lean<{ userId?: string }>();
		if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
		if (message.userId !== viewerId && access.league.creatorId !== viewerId) return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });

		await LeagueMessage.deleteOne({ _id: messageId });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error deleting from league feed:', error);
		return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
	}
}
