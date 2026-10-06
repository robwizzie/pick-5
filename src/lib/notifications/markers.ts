// src/lib/notifications/markers.ts
// "Sent" markers for notifications that aren't per-game pushes (those use GameNotification):
// pick reminders, score emails and per-week job completion.
//
// A marker is claimed BEFORE sending, through a unique index on `key`, so two concurrent runs
// can never both send the same notification. Lifecycle:
//   claim -> 'pending' -> send -> 'sent'        (never sent again)
//                             \-> 'failed'      (retried by a later run, up to MAX_ATTEMPTS)
// A 'pending' marker older than STALE_PENDING_MS (the run died mid-send) is reclaimable. Email
// sends also pass the marker key to Resend as an idempotency key, so a reclaimed send that had
// actually gone out is not delivered twice.
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';
import { isDuplicateKeyError } from './runtime';

const MAX_ATTEMPTS = 3;
const STALE_PENDING_MS = 15 * 60 * 1000;

export type MarkerKind = 'pick_reminder_email' | 'pick_reminder_push' | 'score_email' | 'job';

const NotificationMarkerSchema = new mongoose.Schema({
	key: { type: String, required: true, unique: true },
	kind: { type: String, required: true },
	userId: String,
	leagueId: String,
	season: Number,
	week: Number,
	status: { type: String, enum: ['pending', 'sent', 'failed'], required: true },
	attempts: { type: Number, default: 0 },
	claimedAt: Date,
	sentAt: Date,
	error: String,
	// Markers only matter for the current season; let Mongo drop them after ~13 months.
	createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 }
});

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const NotificationMarker = requestScoped(
	mongoose.models?.NotificationMarker || mongoose.model('NotificationMarker', NotificationMarkerSchema)
);

export interface MarkerMeta {
	kind: MarkerKind;
	userId?: string;
	leagueId?: string;
	season: number;
	week: number;
}

export const markerKeys = {
	reminderEmail: (kind: 'thursday' | 'saturday', season: number, week: number, userId: string) =>
		`reminder:${kind}:email:${season}:${week}:${userId}`,
	reminderPush: (kind: 'thursday' | 'saturday', season: number, week: number, userId: string) =>
		`reminder:${kind}:push:${season}:${week}:${userId}`,
	scoreEmail: (season: number, week: number, userId: string, leagueId: string) =>
		`score-email:${season}:${week}:${userId}:${leagueId}`,
	job: (job: string, season: number, week: number) => `job:${job}:${season}:${week}`
};

let indexesReady = false;

/** Make sure the unique index on `key` exists before relying on it (no-op once built). */
export async function ensureMarkerIndexes(): Promise<void> {
	if (indexesReady) return;
	await NotificationMarker.init();
	indexesReady = true;
}

/**
 * Atomically claim `key`. Returns true if this caller now owns the send; false if the
 * notification was already sent, is being sent by another run, or has used up its retries.
 */
export async function claimMarker(key: string, meta: MarkerMeta): Promise<boolean> {
	const now = new Date();
	try {
		await NotificationMarker.updateOne(
			{
				key,
				$or: [
					{ status: 'failed', attempts: { $lt: MAX_ATTEMPTS } },
					{ status: 'pending', claimedAt: { $lt: new Date(now.getTime() - STALE_PENDING_MS) } }
				]
			},
			{
				$set: { status: 'pending', claimedAt: now },
				$inc: { attempts: 1 },
				$setOnInsert: { ...meta, createdAt: now }
			},
			{ upsert: true }
		);
		return true;
	} catch (error) {
		// The marker exists and isn't claimable: the upsert tried to insert a duplicate key.
		if (isDuplicateKeyError(error)) return false;
		throw error;
	}
}

export async function markSent(key: string): Promise<void> {
	await NotificationMarker.updateOne({ key }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { error: 1 } });
}

export async function markFailed(key: string, error: string): Promise<void> {
	await NotificationMarker.updateOne({ key }, { $set: { status: 'failed', error: error.slice(0, 500) } });
}

/** Release a claim without counting it as an attempt (e.g. nothing was sent after all). */
export async function releaseMarker(key: string): Promise<void> {
	await NotificationMarker.deleteOne({ key, status: 'pending' });
}

/** Whether a whole job (e.g. "score emails for week 5") has already completed. */
export async function isJobDone(job: string, season: number, week: number): Promise<boolean> {
	return !!(await NotificationMarker.exists({ key: markerKeys.job(job, season, week), status: 'sent' }));
}

export async function markJobDone(job: string, season: number, week: number): Promise<void> {
	const now = new Date();
	await NotificationMarker.updateOne(
		{ key: markerKeys.job(job, season, week) },
		{
			$set: { status: 'sent', sentAt: now },
			$setOnInsert: { kind: 'job', season, week, attempts: 1, claimedAt: now, createdAt: now }
		},
		{ upsert: true }
	);
}

/**
 * Whether markers for these keys still have work left (failed with retries remaining, or a
 * stale pending claim). Used to decide if a job is complete.
 */
export async function hasRetryableMarkers(keys: string[]): Promise<boolean> {
	if (keys.length === 0) return false;
	return !!(await NotificationMarker.exists({
		key: { $in: keys },
		$or: [{ status: 'failed', attempts: { $lt: MAX_ATTEMPTS } }, { status: 'pending' }]
	}));
}
