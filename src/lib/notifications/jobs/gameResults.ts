// src/lib/notifications/jobs/gameResults.ts
// Push "your pick won/lost" when a game a user picked goes final. Runs every 10 minutes in
// game windows; costs one ESPN request (no database) unless a game finished recently.
import type { AnyBulkWriteOperation } from 'mongoose';
import { connectDB } from '@/lib/db';
import { seasonPickFilter } from '@/lib/season';
import { GameNotification } from '@/models/GameNotification';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { NFLService } from '@/services/nflService';
import { SeasonService } from '@/services/seasonService';
import { isFinal, pointsForCorrectPick } from '../games';
import { sendPushMessages, usersWithSubscriptions, type PushMessage } from '../push';
import { RunBudget } from '../runtime';

/** A finished game is considered for notifications until this long after kickoff. */
const RECENT_KICKOFF_MS = 8 * 60 * 60 * 1000;
/** (user, league) groups claimed and sent per round, so a cut-off run loses little. */
const ROUND_SIZE = 100;

interface FinishedGame {
	gameId: string;
	winner: string | null; // null = tie
}

interface PendingResult {
	userId: string;
	leagueId: string;
	leagueName: string;
	gameId: string;
	team: string;
	outcome: 'win' | 'loss' | 'tie';
	points: number;
}

export interface GameResultsJobResult {
	skipped?: string;
	week?: number;
	finishedGames?: number;
	pending?: number;
	claimed?: number;
	delivered?: number;
	released?: number;
	removedSubscriptions?: number;
	partial?: boolean;
}

export interface GameResultsJobOptions {
	budgetMs: number;
	/** Consider every final game of the week, not only ones that kicked off recently (manual runs). */
	includeAllFinal?: boolean;
}

type LeanPick = { userId: string; leagueId: string; lockGameId?: string | null; picks: Array<{ gameId: string; team: string; odds?: number | null }> };

export async function runGameResultsJob({ budgetMs, includeAllFinal = false }: GameResultsJobOptions): Promise<GameResultsJobResult> {
	const budget = new RunBudget(budgetMs);

	// Cheap pre-check (ESPN only): is there a game that went final recently?
	const week = await NFLService.getCurrentWeek(false);
	if (week > 18) return { skipped: 'beyond regular season', week };
	const games = await NFLService.getWeeklyGames(week);
	const cutoff = Date.now() - RECENT_KICKOFF_MS;
	const finished: FinishedGame[] = games
		.filter(game => isFinal(game) && (includeAllFinal || new Date(game.date).getTime() >= cutoff))
		.map(game => {
			const home = game.home.score || 0;
			const away = game.away.score || 0;
			return { gameId: game.id, winner: home > away ? game.home.team : away > home ? game.away.team : null };
		});
	if (finished.length === 0) return { skipped: 'no recently finished games', week };

	await connectDB();
	const seasonStatus = await SeasonService.getSeasonStatus();
	if (!seasonStatus.canSendNotifications) return { skipped: 'season not active for notifications', week };

	const finishedById = new Map(finished.map(g => [g.gameId, g]));
	const gameIds = Array.from(finishedById.keys());

	const pickDocs = (await Pick.find({
		week,
		'picks.gameId': { $in: gameIds },
		...seasonPickFilter(seasonStatus.seasonYear)
	})
		.select('userId leagueId lockGameId picks.gameId picks.team picks.odds')
		.lean()) as unknown as LeanPick[];
	if (pickDocs.length === 0) return { week, finishedGames: finished.length, pending: 0 };

	// Preferences: push enabled, game results not turned off, and at least one subscription.
	const pickUserIds = Array.from(new Set(pickDocs.map(p => String(p.userId))));
	const optedIn = (await User.find({
		_id: { $in: pickUserIds },
		pushNotificationsEnabled: true,
		'pushNotificationPreferences.gameResults': { $ne: false }
	})
		.select('_id')
		.lean()) as unknown as Array<{ _id: unknown }>;
	const eligible = await usersWithSubscriptions(optedIn.map(u => String(u._id)));
	if (eligible.size === 0) return { week, finishedGames: finished.length, pending: 0 };

	const relevant = pickDocs.filter(p => eligible.has(String(p.userId)));
	const leagueIds = Array.from(new Set(relevant.map(p => String(p.leagueId))));
	const leagues = (await League.find({ _id: { $in: leagueIds } })
		.select('name mode')
		.lean()) as unknown as Array<{ _id: unknown; name: string; mode?: string }>;
	const leagueById = new Map(leagues.map(l => [String(l._id), l]));

	const sent = (await GameNotification.find({
		userId: { $in: Array.from(eligible) },
		gameId: { $in: gameIds },
		notificationType: 'game_result'
	})
		.select('userId gameId leagueId')
		.lean()) as unknown as Array<{ userId: string; gameId: string; leagueId: string }>;
	const alreadySent = new Set(sent.map(n => `${n.userId}|${n.gameId}|${n.leagueId}`));

	// Group pending results per (user, league): one notification each.
	const groups = new Map<string, PendingResult[]>();
	for (const doc of relevant) {
		const userId = String(doc.userId);
		const leagueId = String(doc.leagueId);
		const league = leagueById.get(leagueId);
		if (!league) continue;
		for (const pick of doc.picks) {
			const game = finishedById.get(pick.gameId);
			if (!game || alreadySent.has(`${userId}|${pick.gameId}|${leagueId}`)) continue;
			const outcome = game.winner === null ? 'tie' : game.winner === pick.team ? 'win' : 'loss';
			const entry: PendingResult = {
				userId,
				leagueId,
				leagueName: league.name,
				gameId: pick.gameId,
				team: pick.team,
				outcome,
				points: outcome === 'win' ? pointsForCorrectPick(league.mode, pick.odds, doc.lockGameId === pick.gameId) : 0
			};
			const key = `${userId}|${leagueId}`;
			groups.set(key, [...(groups.get(key) ?? []), entry]);
		}
	}

	const allGroups = Array.from(groups.values());
	const result: GameResultsJobResult = {
		week,
		finishedGames: finished.length,
		pending: allGroups.length,
		claimed: 0,
		delivered: 0,
		released: 0,
		removedSubscriptions: 0
	};

	for (let start = 0; start < allGroups.length; start += ROUND_SIZE) {
		if (budget.exhausted) {
			result.partial = true;
			break;
		}
		const round = allGroups.slice(start, start + ROUND_SIZE);
		const claimedGroups = await claimGroups(round, week);
		result.claimed! += claimedGroups.length;
		if (claimedGroups.length === 0) continue;

		const messages: PushMessage[] = claimedGroups.map(group => ({ userId: group[0].userId, payload: buildPayload(group) }));
		const push = await sendPushMessages(messages);
		result.delivered! += push.outcomes.filter(o => o === 'delivered').length;
		result.removedSubscriptions! += push.removed;

		// Transient failure on every subscription: release the claim so the next tick retries.
		const retry = claimedGroups.filter((_, i) => push.outcomes[i] === 'failed');
		for (const group of retry) {
			await GameNotification.deleteMany({
				userId: group[0].userId,
				leagueId: group[0].leagueId,
				week,
				gameId: { $in: group.map(r => r.gameId) },
				notificationType: 'game_result'
			});
		}
		result.released! += retry.length;
	}

	return result;
}

/**
 * Claim markers through the unique (userId, gameId, leagueId, week) index. Only groups whose
 * markers this run inserted are returned (a group is trimmed to the games it claimed), so
 * concurrent runs can't both notify.
 */
async function claimGroups(groups: PendingResult[][], week: number): Promise<PendingResult[][]> {
	const entries = groups.flat();
	const ops: AnyBulkWriteOperation[] = entries.map(entry => ({
		updateOne: {
			filter: { userId: entry.userId, gameId: entry.gameId, leagueId: entry.leagueId, week },
			update: { $setOnInsert: { notificationType: 'game_result', sentAt: new Date() } },
			upsert: true
		}
	}));

	let upserted: Record<number, unknown> = {};
	try {
		const res = await GameNotification.bulkWrite(ops, { ordered: false });
		upserted = res.upsertedIds ?? {};
	} catch (error) {
		// Duplicate keys from a concurrent run: keep what this run did insert.
		const partial = (error as { result?: { upsertedIds?: Record<number, unknown> } }).result;
		if (!partial?.upsertedIds) throw error;
		upserted = partial.upsertedIds;
	}

	const claimed = new Set(Object.keys(upserted).map(Number));
	const out: PendingResult[][] = [];
	let index = 0;
	for (const group of groups) {
		const mine = group.filter(() => claimed.has(index++));
		if (mine.length > 0) out.push(mine);
	}
	return out;
}

function buildPayload(group: PendingResult[]) {
	const { leagueId, leagueName } = group[0];
	const pts = (n: number) => `${n} ${n === 1 ? 'pt' : 'pts'}`;
	let title: string;
	let body: string;

	if (group.length === 1) {
		const r = group[0];
		title = r.outcome === 'win' ? `✅ ${r.team} Won!` : r.outcome === 'tie' ? `➖ ${r.team} Tied` : `❌ ${r.team} Lost`;
		body = r.outcome === 'win' ? `+${pts(r.points)} in "${leagueName}"` : `0 pts in "${leagueName}"`;
	} else {
		const wins = group.filter(r => r.outcome === 'win').length;
		const total = group.reduce((sum, r) => sum + r.points, 0);
		title = `${group.length} Games Finished!`;
		body = `${'✅'.repeat(wins)}${'❌'.repeat(group.length - wins)} +${pts(total)} in "${leagueName}"`;
	}

	return {
		title,
		body,
		url: `/league/${leagueId}`,
		// Unique per (league, set of games): a retry of the same results replaces itself, while
		// results from a later game don't wipe the earlier notification off the device.
		tag: `game-result-${leagueId}-${group
			.map(r => r.gameId)
			.sort()
			.join('-')}`,
		leagueId
	};
}
