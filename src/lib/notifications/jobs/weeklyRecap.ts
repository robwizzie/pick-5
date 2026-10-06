// src/lib/notifications/jobs/weeklyRecap.ts
// "Week N complete" push per (user, league) once the week's games are all final.
// Markers live in GameNotification (notificationType 'weekly_recap', gameId
// '<season>-week-<N>-recap'); legacy 'week-<N>-recap' markers count only if sent this season.
import { connectDB } from '@/lib/db';
import { seasonPickFilter, seasonWindow } from '@/lib/season';
import { GameNotification } from '@/models/GameNotification';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { SeasonService } from '@/services/seasonService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { getLastCompletedWeek, toGameResults, type GameResultRow } from '../games';
import { sendPushMessages, usersWithSubscriptions, type PushMessage } from '../push';
import { ensureMarkerIndexes, isJobDone, markJobDone } from '../markers';
import { RunBudget, isDuplicateKeyError } from '../runtime';

const JOB = 'weekly-recap';

export interface WeeklyRecapJobResult {
	skipped?: string;
	week?: number;
	leagues?: number;
	delivered?: number;
	released?: number;
	partial?: boolean;
	complete?: boolean;
}

interface LeanPickDoc {
	userId: string;
	leagueId: string;
	week: number;
	picks: Array<{ gameId: string; team: string; isHome: boolean; odds?: number }>;
	tfsGame?: string | null;
	tfsScore?: number | null;
}

export async function runWeeklyRecapJob({ budgetMs }: { budgetMs: number }): Promise<WeeklyRecapJobResult> {
	const budget = new RunBudget(budgetMs);

	await connectDB();
	const seasonStatus = await SeasonService.getSeasonStatus();
	if (!seasonStatus.canSendNotifications) return { skipped: 'season not active for notifications' };

	const season = seasonStatus.seasonYear;
	const completed = await getLastCompletedWeek(season);
	if (!completed) return { skipped: 'no completed week yet' };
	const { week } = completed;

	await ensureMarkerIndexes();
	if (await isJobDone(JOB, season, week)) return { skipped: 'already sent', week };

	const recapMarkerId = `${season}-week-${week}-recap`;
	const legacyRecapMarkerId = `week-${week}-recap`;

	// Recipients: push on, weekly recap not turned off, at least one subscription.
	const optedIn = (await User.find({ pushNotificationsEnabled: true, 'pushNotificationPreferences.weeklyRecap': { $ne: false } })
		.select('_id')
		.lean()) as unknown as Array<{ _id: unknown }>;
	const recipients = await usersWithSubscriptions(optedIn.map(u => String(u._id)));
	if (recipients.size === 0) {
		await markJobDone(JOB, season, week);
		return { week, delivered: 0, complete: true };
	}

	const leagues = (await League.find({ members: { $in: Array.from(recipients) } })
		.select('name mode members')
		.lean()) as unknown as Array<{ _id: unknown; name: string; mode?: string; members: string[] }>;
	const leagueIds = leagues.map(l => String(l._id));

	const already = (await GameNotification.find({
		userId: { $in: Array.from(recipients) },
		leagueId: { $in: leagueIds },
		week,
		notificationType: 'weekly_recap',
		$or: [{ gameId: recapMarkerId }, { gameId: legacyRecapMarkerId, sentAt: { $gte: seasonWindow(season).start } }]
	})
		.select('userId leagueId')
		.lean()) as unknown as Array<{ userId: string; leagueId: string }>;
	const alreadySent = new Set(already.map(n => `${n.userId}|${n.leagueId}`));

	// Season-to-date picks for these leagues, in one query; results per week fetched once.
	const seasonPicks = (await Pick.find({ leagueId: { $in: leagueIds }, week: { $lte: week }, ...seasonPickFilter(season) })
		.select('userId leagueId week picks tfsGame tfsScore')
		.lean()) as unknown as LeanPickDoc[];
	const resultsByWeek = new Map<number, GameResultRow[]>([[week, toGameResults(completed.games)]]);
	const weeksNeeded = Array.from(new Set(seasonPicks.map(p => p.week))).filter(w => !resultsByWeek.has(w));
	const fetched = await Promise.all(weeksNeeded.map(w => NFLService.getWeeklyGames(w, season)));
	weeksNeeded.forEach((w, i) => resultsByWeek.set(w, toGameResults(fetched[i])));

	const picksByLeague = new Map<string, LeanPickDoc[]>();
	for (const pick of seasonPicks) {
		const leagueId = String(pick.leagueId);
		picksByLeague.set(leagueId, [...(picksByLeague.get(leagueId) ?? []), pick]);
	}

	const result: WeeklyRecapJobResult = { week, leagues: 0, delivered: 0, released: 0 };

	for (const league of leagues) {
		if (budget.exhausted) {
			result.partial = true;
			break;
		}
		const leagueId = String(league._id);
		const mode = league.mode || 'standard';
		const leaguePicks = picksByLeague.get(leagueId) ?? [];

		// Weekly and season points for everyone who picked this week.
		const totals = new Map<string, { weekly: number; season: number; pickedThisWeek: boolean }>();
		for (const doc of leaguePicks) {
			const userId = String(doc.userId);
			const { weeklyPoints } = ScoringService.calculateWeekScore(doc.picks, resultsByWeek.get(doc.week) ?? [], doc.tfsGame ?? null, doc.tfsScore ?? null, mode, calculatePointsFromOdds);
			const row = totals.get(userId) ?? { weekly: 0, season: 0, pickedThisWeek: false };
			row.season += weeklyPoints;
			if (doc.week === week) {
				row.weekly = weeklyPoints;
				row.pickedThisWeek = true;
			}
			totals.set(userId, row);
		}
		const leaderboard = Array.from(totals.entries())
			.filter(([, row]) => row.pickedThisWeek)
			.map(([userId, row]) => ({ userId, ...row }))
			.sort((a, b) => b.season - a.season);

		const targets = leaderboard.filter(
			row => recipients.has(row.userId) && league.members.includes(row.userId) && !alreadySent.has(`${row.userId}|${leagueId}`)
		);
		if (targets.length === 0) continue;
		result.leagues!++;

		// Claim (unique index on userId+gameId+leagueId+week), then send only what we claimed.
		const claimed: typeof targets = [];
		for (const row of targets) {
			try {
				await GameNotification.create({ userId: row.userId, gameId: recapMarkerId, leagueId, week, notificationType: 'weekly_recap' });
				claimed.push(row);
			} catch (error) {
				if (!isDuplicateKeyError(error)) throw error;
			}
		}
		if (claimed.length === 0) continue;

		const messages: PushMessage[] = claimed.map(row => {
			const rank = leaderboard.findIndex(r => r.userId === row.userId) + 1;
			return {
				userId: row.userId,
				payload: {
					title: `🏆 Week ${week} Complete!`,
					body: `${league.name}: ${row.weekly} ${row.weekly === 1 ? 'pt' : 'pts'} (#${rank}/${leaderboard.length}). Season: ${row.season} pts`,
					url: `/league/${leagueId}`,
					tag: `weekly-recap-${week}-${leagueId}`,
					leagueId
				}
			};
		});
		const push = await sendPushMessages(messages);
		result.delivered! += push.outcomes.filter(o => o === 'delivered').length;

		// Every subscription failed transiently: release the claim so the next run retries.
		const retry = claimed.filter((_, i) => push.outcomes[i] === 'failed');
		if (retry.length > 0) {
			await GameNotification.deleteMany({ userId: { $in: retry.map(r => r.userId) }, leagueId, week, gameId: recapMarkerId });
			result.released! += retry.length;
		}
	}

	if (!result.partial && result.released === 0) {
		await markJobDone(JOB, season, week);
		result.complete = true;
	}
	return result;
}
