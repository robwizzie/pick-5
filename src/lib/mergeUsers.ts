// src/lib/mergeUsers.ts
//
// Folds one user account (the duplicate, `fromId`) into another (`keepId`): every pick, league
// membership, archived season standing, feed message, nudge and notification record that names the
// duplicate is moved onto the kept account, then the duplicate User document is deleted. The kept
// account's name, email, image and settings are left as they are.
//
// Safety:
// - planMerge() is read-only and reports what would move plus any conflicts (both accounts holding a
//   pick for the same league/season/week, or both appearing in the same archived standings).
// - mergeUsers() refuses to run while conflicts exist, so nothing is ever overwritten.
// - Each step is idempotent and the duplicate User is deleted last, so a run that dies part way
//   can simply be run again.
import { Types } from 'mongoose';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { SurvivorPick } from '@/models/SurvivorPick';
import { SeasonHistory } from '@/models/SeasonHistory';
import { LeagueMessage } from '@/models/LeagueMessage';
import { Nudge } from '@/models/Nudge';
import { PushSubscription } from '@/models/PushSubscription';
import { GameNotification } from '@/models/GameNotification';
import { NotificationMarker } from '@/lib/notifications/markers';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UserSummary {
	id: string;
	name: string | null;
	email: string;
}

export interface MergePlan {
	from: UserSummary;
	keep: UserSummary;
	counts: {
		picks: number;
		survivorPicks: number;
		leaguesJoined: number;
		leaguesAlreadyShared: number;
		leaguesCreated: number;
		seasonHistories: number;
		messages: number;
		nudges: number;
		pushSubscriptions: number;
		gameNotifications: number;
		notificationMarkers: number;
	};
	/** Picks by season, so the admin can see e.g. "2025: 17 weeks" before running */
	picksBySeason: Record<string, number>;
	conflicts: string[];
}

export interface MergeResult extends MergePlan {
	merged: true;
}

export class MergeError extends Error {
	constructor(message: string, readonly status = 400) {
		super(message);
	}
}

async function loadUsers(fromId: string, keepId: string) {
	if (!Types.ObjectId.isValid(fromId) || !Types.ObjectId.isValid(keepId)) {
		throw new MergeError('Both user IDs must be valid ObjectIds');
	}
	if (fromId === keepId) throw new MergeError('The two user IDs are the same');

	const [from, keep] = await Promise.all([User.findById(fromId).lean<any>(), User.findById(keepId).lean<any>()]);
	if (!from) throw new MergeError(`User ${fromId} (to merge away) not found`, 404);
	if (!keep) throw new MergeError(`User ${keepId} (to keep) not found`, 404);
	return { from, keep };
}

const summary = (u: any): UserSummary => ({ id: u._id.toString(), name: u.name ?? null, email: u.email });

const weekKey = (p: { leagueId: string; season?: number | null; week: number }) => `${p.leagueId}:${p.season ?? 'legacy'}:${p.week}`;

export async function planMerge(fromId: string, keepId: string): Promise<MergePlan> {
	const { from, keep } = await loadUsers(fromId, keepId);

	const [fromPicks, keepPicks, fromSurvivor, keepSurvivor, leagues, histories, messages, nudges, pushSubs, gameNotes, markers] = await Promise.all([
		Pick.find({ userId: fromId }, 'leagueId season week').lean<any[]>(),
		Pick.find({ userId: keepId }, 'leagueId season week').lean<any[]>(),
		SurvivorPick.find({ userId: fromId }, 'leagueId season week').lean<any[]>(),
		SurvivorPick.find({ userId: keepId }, 'leagueId season week').lean<any[]>(),
		League.find({ $or: [{ members: fromId }, { creatorId: fromId }] }, 'name members creatorId').lean<any[]>(),
		SeasonHistory.find(
			{ $or: [{ 'standings.userId': fromId }, { 'champions.userId': fromId }, { 'seasonStats.highestWeeklyScore.userId': fromId }] },
			'leagueName seasonYear standings.userId'
		).lean<any[]>(),
		LeagueMessage.countDocuments({ $or: [{ userId: fromId }, { userIds: fromId }, ...(await reactionClauses(fromId))] }),
		Nudge.countDocuments({ $or: [{ toUserId: fromId }, { fromUserId: fromId }] }),
		PushSubscription.countDocuments({ userId: fromId }),
		GameNotification.countDocuments({ userId: fromId }),
		NotificationMarker.countDocuments({ userId: fromId })
	]);

	const conflicts: string[] = [];

	const keepWeeks = new Set(keepPicks.map(weekKey));
	for (const p of fromPicks) {
		if (keepWeeks.has(weekKey(p))) conflicts.push(`Both accounts have picks for league ${p.leagueId}, season ${p.season ?? 'legacy'}, week ${p.week}`);
	}
	const keepSurvivorWeeks = new Set(keepSurvivor.map(weekKey));
	for (const p of fromSurvivor) {
		if (keepSurvivorWeeks.has(weekKey(p))) conflicts.push(`Both accounts have survivor picks for league ${p.leagueId}, season ${p.season}, week ${p.week}`);
	}
	for (const h of histories) {
		const ids = new Set((h.standings ?? []).map((s: any) => s.userId));
		if (ids.has(fromId) && ids.has(keepId)) conflicts.push(`Both accounts are in the archived ${h.seasonYear} standings of "${h.leagueName}"`);
	}

	const picksBySeason: Record<string, number> = {};
	for (const p of fromPicks) {
		const k = String(p.season ?? 'legacy');
		picksBySeason[k] = (picksBySeason[k] ?? 0) + 1;
	}

	const memberOf = leagues.filter(l => (l.members ?? []).includes(fromId));
	return {
		from: summary(from),
		keep: summary(keep),
		counts: {
			picks: fromPicks.length,
			survivorPicks: fromSurvivor.length,
			leaguesJoined: memberOf.filter(l => !l.members.includes(keepId)).length,
			leaguesAlreadyShared: memberOf.filter(l => l.members.includes(keepId)).length,
			leaguesCreated: leagues.filter(l => l.creatorId === fromId).length,
			seasonHistories: histories.length,
			messages,
			nudges,
			pushSubscriptions: pushSubs,
			gameNotifications: gameNotes,
			notificationMarkers: markers
		},
		picksBySeason,
		conflicts
	};
}

/** `reactions` is a Map of emoji -> userIds; match any emoji whose list holds the user */
async function reactionClauses(userId: string) {
	const docs = await LeagueMessage.find({}, 'reactions').lean<any[]>();
	const emojis = new Set<string>();
	for (const d of docs) {
		for (const [emoji, ids] of Object.entries(d.reactions ?? {})) {
			if (Array.isArray(ids) && ids.includes(userId)) emojis.add(emoji);
		}
	}
	return Array.from(emojis).map(e => ({ [`reactions.${e}`]: userId }));
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

export async function mergeUsers(fromId: string, keepId: string): Promise<MergeResult> {
	const plan = await planMerge(fromId, keepId);
	if (plan.conflicts.length > 0) {
		throw new MergeError(`Refusing to merge: ${plan.conflicts.length} conflict(s). Run the preview to see them.`, 409);
	}
	const { keep } = await loadUsers(fromId, keepId);

	// Picks (unique per user/league/season/week; conflicts were ruled out above)
	await Pick.updateMany({ userId: fromId }, { $set: { userId: keepId } });
	await SurvivorPick.updateMany({ userId: fromId }, { $set: { userId: keepId } });

	// League membership: add the kept account where missing, then drop the duplicate
	await League.updateMany({ members: fromId }, { $addToSet: { members: keepId } });
	await League.updateMany({ members: fromId }, { $pull: { members: fromId } });
	await League.updateMany({ creatorId: fromId }, { $set: { creatorId: keepId } });

	// Archived seasons: the standings row (and any champion / high-score credit) becomes the kept
	// account's, shown under its current name and picture
	const keepName = keep.name ?? keep.email;
	const keepImage = keep.image ?? null;
	await SeasonHistory.updateMany(
		{ 'standings.userId': fromId },
		{ $set: { 'standings.$[s].userId': keepId, 'standings.$[s].userName': keepName, 'standings.$[s].userImage': keepImage } },
		{ arrayFilters: [{ 's.userId': fromId }] }
	);
	await SeasonHistory.updateMany(
		{ 'champions.userId': fromId },
		{ $set: { 'champions.$[c].userId': keepId, 'champions.$[c].userName': keepName } },
		{ arrayFilters: [{ 'c.userId': fromId }] }
	);
	await SeasonHistory.updateMany(
		{ 'seasonStats.highestWeeklyScore.userId': fromId },
		{ $set: { 'seasonStats.highestWeeklyScore.userId': keepId, 'seasonStats.highestWeeklyScore.userName': keepName } }
	);

	// League feed: authored messages, moments naming them, and reactions
	await LeagueMessage.updateMany({ userId: fromId }, { $set: { userId: keepId } });
	await LeagueMessage.updateMany({ userIds: fromId }, { $addToSet: { userIds: keepId } });
	await LeagueMessage.updateMany({ userIds: fromId }, { $pull: { userIds: fromId } });
	for (const clause of await reactionClauses(fromId)) {
		const path = Object.keys(clause)[0];
		await LeagueMessage.updateMany(clause, { $addToSet: { [path]: keepId } });
		await LeagueMessage.updateMany(clause, { $pull: { [path]: fromId } });
	}

	// Nudges: one per player per league/week, so a nudge the kept account already has wins
	await Nudge.updateMany({ fromUserId: fromId }, { $set: { fromUserId: keepId } });
	for (const n of await Nudge.find({ toUserId: fromId }, '_id').lean<any[]>()) {
		try {
			await Nudge.updateOne({ _id: n._id }, { $set: { toUserId: keepId } });
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			await Nudge.deleteOne({ _id: n._id });
		}
	}

	// Push devices: keep them, now delivering to the kept account
	await PushSubscription.updateMany({ userId: fromId }, { $set: { userId: keepId } });

	// "Already sent" records: move them so nothing is re-sent; one the kept account already has wins
	for (const g of await GameNotification.find({ userId: fromId }, '_id').lean<any[]>()) {
		try {
			await GameNotification.updateOne({ _id: g._id }, { $set: { userId: keepId } });
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			await GameNotification.deleteOne({ _id: g._id });
		}
	}
	for (const m of await NotificationMarker.find({ userId: fromId }, '_id key').lean<any[]>()) {
		try {
			await NotificationMarker.updateOne({ _id: m._id }, { $set: { userId: keepId, key: String(m.key).split(fromId).join(keepId) } });
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
			await NotificationMarker.deleteOne({ _id: m._id });
		}
	}

	// Last: drop the duplicate account (only its profile is left by now)
	await User.deleteOne({ _id: fromId });

	return { ...plan, merged: true };
}
