// src/lib/notifications/push.ts
// Web Push delivery shared by every sender.
//
// web-push is used only to build the request (VAPID JWT + aes128gcm payload encryption, both
// verified to work in workerd with nodejs_compat); the request itself goes out with global
// fetch, which works the same on Node.js and Cloudflare Workers and gives us the status code.
import webPush from 'web-push';
import { isWorkersRuntime } from '@/lib/db';
import { PushSubscription } from '@/models/PushSubscription';
import { errorMessage, mapWithConcurrency } from './runtime';

export interface PushPayload {
	title: string;
	body: string;
	/** Same-origin path the notification opens, e.g. `/league/<id>`. */
	url: string;
	/** Notifications with the same tag replace each other on the device. */
	tag: string;
	/** Keep on screen until the user acts (only honoured with a tag). */
	requireInteraction?: boolean;
	leagueId?: string;
	leagueIds?: string[];
}

export interface PushResult {
	/** Users with at least one subscription that accepted the message. */
	usersDelivered: number;
	/** Subscriptions that accepted the message. */
	sent: number;
	/** Expired subscriptions (404/410) that were deleted. */
	removed: number;
	/** Other failures (logged, not fatal). */
	failed: number;
	/** User ids none of whose subscriptions accepted the message (only counting users that had some). */
	undeliveredUserIds: string[];
}

interface StoredSubscription {
	_id: unknown;
	userId: string;
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

// Workers allow 6 simultaneous outbound connections per invocation and the per-request MongoDB
// connection already holds several, so keep push fan-out narrow there.
const PUSH_CONCURRENCY = isWorkersRuntime ? 2 : 8;
const PUSH_TIMEOUT_MS = 10_000;
const PUSH_TTL_SECONDS = 60 * 60 * 12;

let vapid: { subject: string; publicKey: string; privateKey: string } | null | undefined;

/** VAPID details, read once from the environment (null when push isn't configured). */
function getVapidDetails() {
	if (vapid === undefined) {
		const publicKey = process.env.VAPID_PUBLIC_KEY;
		const privateKey = process.env.VAPID_PRIVATE_KEY;
		vapid =
			publicKey && privateKey
				? { subject: process.env.VAPID_SUBJECT || 'mailto:noreply@sportspick5.com', publicKey, privateKey }
				: null;
	}
	return vapid;
}

export function isPushConfigured(): boolean {
	return getVapidDetails() !== null;
}

/** User ids (from `candidates`) that have at least one push subscription. */
export async function usersWithSubscriptions(candidates: string[]): Promise<Set<string>> {
	if (candidates.length === 0) return new Set();
	const ids: string[] = await PushSubscription.distinct('userId', { userId: { $in: candidates } });
	return new Set(ids.map(String));
}

type SendOutcome = 'sent' | 'gone' | 'failed';

async function sendOne(subscription: StoredSubscription, body: string): Promise<SendOutcome> {
	const vapidDetails = getVapidDetails();
	if (!vapidDetails) return 'failed';

	const details = webPush.generateRequestDetails(
		{ endpoint: subscription.endpoint, keys: subscription.keys },
		body,
		{ vapidDetails, TTL: PUSH_TTL_SECONDS, urgency: 'normal' }
	);
	const headers = Object.fromEntries(Object.entries(details.headers).map(([k, v]) => [k, String(v)]));

	const response = await fetch(details.endpoint, {
		method: details.method,
		headers,
		body: details.body ? new Uint8Array(details.body) : undefined,
		signal: AbortSignal.timeout(PUSH_TIMEOUT_MS)
	});
	// Drain the body so the connection is released promptly.
	await response.arrayBuffer().catch(() => undefined);

	if (response.ok) return 'sent';
	if (response.status === 404 || response.status === 410) return 'gone';
	console.error(`[Push] ${new URL(subscription.endpoint).host} answered ${response.status} for user ${subscription.userId}`);
	return 'failed';
}

export interface PushMessage {
	userId: string;
	payload: PushPayload;
}

export type MessageOutcome =
	/** At least one of the user's subscriptions accepted it. */
	| 'delivered'
	/** The user has no (remaining) valid subscription. */
	| 'no-subscription'
	/** Every attempt failed for another reason (worth retrying later). */
	| 'failed';

/**
 * Deliver each message to every subscription its user has. Expired subscriptions (404/410) are
 * deleted; other errors are logged and counted, never thrown, so one bad endpoint can't abort
 * a batch. Returns per-message outcomes (same order as `messages`) plus totals.
 */
export async function sendPushMessages(messages: PushMessage[]): Promise<PushResult & { outcomes: MessageOutcome[] }> {
	const result: PushResult & { outcomes: MessageOutcome[] } = {
		usersDelivered: 0,
		sent: 0,
		removed: 0,
		failed: 0,
		undeliveredUserIds: [],
		outcomes: messages.map(() => 'no-subscription' as MessageOutcome)
	};
	if (messages.length === 0) return result;
	if (!isPushConfigured()) {
		console.error('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set; skipping push');
		result.outcomes = messages.map(() => 'failed');
		result.undeliveredUserIds = Array.from(new Set(messages.map(m => m.userId)));
		return result;
	}

	const userIds = Array.from(new Set(messages.map(m => m.userId)));
	const subscriptions = (await PushSubscription.find({ userId: { $in: userIds } }).lean()) as unknown as StoredSubscription[];
	const subsByUser = new Map<string, StoredSubscription[]>();
	for (const subscription of subscriptions) {
		const userId = String(subscription.userId);
		subsByUser.set(userId, [...(subsByUser.get(userId) ?? []), subscription]);
	}

	const sends: Array<{ messageIndex: number; subscription: StoredSubscription; body: string }> = [];
	messages.forEach((message, messageIndex) => {
		const body = JSON.stringify(message.payload);
		for (const subscription of subsByUser.get(message.userId) ?? []) sends.push({ messageIndex, subscription, body });
	});

	const outcomes = await mapWithConcurrency(sends, PUSH_CONCURRENCY, ({ subscription, body }) => sendOne(subscription, body));

	const goneIds = new Set<unknown>();
	const perMessage = messages.map(() => ({ sent: 0, failed: 0 }));
	outcomes.forEach((outcome, i) => {
		const { messageIndex, subscription } = sends[i];
		if (!outcome.ok) {
			result.failed++;
			perMessage[messageIndex].failed++;
			console.error(`[Push] Send to user ${subscription.userId} threw: ${errorMessage(outcome.error)}`);
		} else if (outcome.value === 'sent') {
			result.sent++;
			perMessage[messageIndex].sent++;
		} else if (outcome.value === 'gone') {
			goneIds.add(subscription._id);
		} else {
			result.failed++;
			perMessage[messageIndex].failed++;
		}
	});

	if (goneIds.size > 0) {
		try {
			await PushSubscription.deleteMany({ _id: { $in: Array.from(goneIds) } });
			result.removed = goneIds.size;
		} catch (error) {
			console.error('[Push] Failed to delete expired subscriptions:', error);
		}
	}

	const delivered = new Set<string>();
	const undelivered = new Set<string>();
	result.outcomes = perMessage.map(({ sent, failed }, i) => {
		const userId = messages[i].userId;
		if (sent > 0) {
			delivered.add(userId);
			return 'delivered';
		}
		undelivered.add(userId);
		return failed > 0 ? 'failed' : 'no-subscription';
	});
	result.usersDelivered = delivered.size;
	result.undeliveredUserIds = Array.from(undelivered).filter(id => !delivered.has(id));
	return result;
}
