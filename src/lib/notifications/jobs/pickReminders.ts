// src/lib/notifications/jobs/pickReminders.ts
// Thursday (before TNF) and Saturday (before the Sunday slate) "make your picks" reminders,
// by email and push, to league members who haven't picked yet. Each (user, week, kind,
// channel) is sent at most once (NotificationMarker); a run that runs out of budget is resumed
// by the next hourly run.
import { render } from '@react-email/render';
import { connectDB } from '@/lib/db';
import { seasonPickFilter } from '@/lib/season';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { SurvivorPick } from '@/models/SurvivorPick';
import { isSurvivorMode } from '@/lib/leagueRules';
import { loadSurvivor } from '@/lib/survivorServer';
import { User } from '@/models/User';
import { NFLService } from '@/services/nflService';
import { SeasonService } from '@/services/seasonService';
import ThursdayReminderEmail from '@/emails/ThursdayReminderEmail';
import SaturdayReminderEmail from '@/emails/SaturdayReminderEmail';
import { findThursdayGame, formatKickoffEt } from '../games';
import { sendEmail, isEmailConfigured } from '../email';
import { sendPushMessages } from '../push';
import { claimMarker, ensureMarkerIndexes, hasRetryableMarkers, isJobDone, markerKeys, markFailed, markJobDone, markSent } from '../markers';
import { reminderRecipientsFilter } from '../preferences';
import { RunBudget, errorMessage } from '../runtime';

export type ReminderKind = 'thursday' | 'saturday';

export interface PickRemindersJobResult {
	kind: ReminderKind;
	skipped?: string;
	week?: number;
	usersNeedingPicks?: number;
	emailsSent?: number;
	emailsFailed?: number;
	pushDelivered?: number;
	partial?: boolean;
	complete?: boolean;
}

interface LeanUser {
	_id: unknown;
	name?: string;
	email: string;
	unsubscribeToken?: string;
	emailPreferences?: { pickReminders?: boolean; thursdayReminder?: boolean; saturdayReminder?: boolean };
	pushNotificationsEnabled?: boolean;
	pushNotificationPreferences?: { pickReminders?: boolean };
}

/** Users per round: claim, send, mark. Small so a cut-off run loses little. */
const ROUND_SIZE = 25;

export async function runPickRemindersJob(kind: ReminderKind, { budgetMs }: { budgetMs: number }): Promise<PickRemindersJobResult> {
	const budget = new RunBudget(budgetMs);
	const jobName = `pick-reminder-${kind}`;

	await connectDB();
	const seasonStatus = await SeasonService.getSeasonStatus();
	// Reminders only make sense while picks can be made.
	if (!seasonStatus.isActive) return { kind, skipped: 'season not active' };

	const season = seasonStatus.seasonYear;
	// The actual current week (no auto-advance): the week users should be picking for.
	const week = await NFLService.getCurrentWeek(false);
	if (week < seasonStatus.startWeek || week > seasonStatus.finalWeek) return { kind, skipped: 'outside the season’s weeks', week };

	await ensureMarkerIndexes();
	if (await isJobDone(jobName, season, week)) return { kind, skipped: 'already sent', week };

	const games = await NFLService.getWeeklyGames(week, season);
	let thursdayGame: { awayTeam: string; homeTeam: string; gameTime: string } | null = null;
	if (kind === 'thursday') {
		const game = findThursdayGame(games);
		// No Thursday game this week (e.g. week 18): a "TNF starts soon" reminder would be wrong.
		if (!game) return { kind, skipped: 'no Thursday game this week', week };
		if (new Date(game.date).getTime() <= Date.now()) return { kind, skipped: 'Thursday game already started', week };
		thursdayGame = { awayTeam: game.away.team, homeTeam: game.home.team, gameTime: formatKickoffEt(game.date) };
	}

	// Email: pickReminders AND the day's flag. Push: the same opt-ins (as before), push enabled,
	// and not opted out via pushNotificationPreferences.pickReminders.
	const users = (await User.find(reminderRecipientsFilter(kind))
		.select('name email unsubscribeToken emailPreferences pushNotificationsEnabled pushNotificationPreferences')
		.lean()) as unknown as LeanUser[];
	if (users.length === 0) {
		await markJobDone(jobName, season, week);
		return { kind, week, usersNeedingPicks: 0, complete: true };
	}

	// Leagues each user still needs to pick in, computed with two queries.
	const userIds = users.map(u => String(u._id));
	const leagues = (await League.find({ members: { $in: userIds } })
		.select('name mode members')
		.lean()) as unknown as Array<{ _id: unknown; name: string; mode: string; members: string[] }>;
	const picked = (await Pick.find({ week, userId: { $in: userIds }, ...seasonPickFilter(season) })
		.select('userId leagueId')
		.lean()) as unknown as Array<{ userId: string; leagueId: string }>;
	const pickedSet = new Set(picked.map(p => `${p.userId}|${p.leagueId}`));
	// Survivor leagues: a survivor pick counts, and players who are out (or a finished pool) need nothing
	const survivorLeagues = leagues.filter(l => isSurvivorMode(l.mode));
	const survivorPicked = survivorLeagues.length
		? ((await SurvivorPick.find({ season, week, leagueId: { $in: survivorLeagues.map(l => String(l._id)) } })
				.select('userId leagueId')
				.lean()) as unknown as Array<{ userId: string; leagueId: string }>)
		: [];
	survivorPicked.forEach(p => pickedSet.add(`${p.userId}|${p.leagueId}`));
	const survivorAlive = new Map<string, Set<string>>();
	for (const league of survivorLeagues) {
		const leagueId = String(league._id);
		const standings = await loadSurvivor(leagueId, season, '').catch(() => null);
		survivorAlive.set(leagueId, new Set(standings && !standings.data.complete ? standings.data.members.filter(m => m.alive).map(m => m.userId) : []));
	}
	const userSet = new Set(userIds);
	const needs = new Map<string, Array<{ id: string; name: string; mode: string }>>();
	for (const league of leagues) {
		const leagueId = String(league._id);
		for (const member of league.members) {
			if (!userSet.has(member) || pickedSet.has(`${member}|${leagueId}`)) continue;
			if (survivorAlive.has(leagueId) && !survivorAlive.get(leagueId)!.has(member)) continue;
			needs.set(member, [...(needs.get(member) ?? []), { id: leagueId, name: league.name, mode: league.mode }]);
		}
	}

	const targets = users.filter(u => needs.has(String(u._id)));
	const result: PickRemindersJobResult = { kind, week, usersNeedingPicks: targets.length, emailsSent: 0, emailsFailed: 0, pushDelivered: 0 };
	const touchedKeys: string[] = [];
	const emailEnabled = isEmailConfigured();
	if (!emailEnabled) console.error('[Pick Reminders] RESEND_API_KEY not set; sending push only');

	for (let start = 0; start < targets.length; start += ROUND_SIZE) {
		if (budget.exhausted) {
			result.partial = true;
			break;
		}
		const round = targets.slice(start, start + ROUND_SIZE);

		// Push: claim per user, send the round together.
		const pushClaims: Array<{ user: LeanUser; key: string }> = [];
		for (const user of round) {
			if (!user.pushNotificationsEnabled || user.pushNotificationPreferences?.pickReminders === false) continue;
			const userId = String(user._id);
			const key = markerKeys.reminderPush(kind, season, week, userId);
			touchedKeys.push(key);
			if (await claimMarker(key, { kind: 'pick_reminder_push', userId, season, week })) pushClaims.push({ user, key });
		}
		if (pushClaims.length > 0) {
			const push = await sendPushMessages(
				pushClaims.map(({ user }) => ({ userId: String(user._id), payload: reminderPushPayload(kind, week, thursdayGame, needs.get(String(user._id))!) }))
			);
			for (let i = 0; i < pushClaims.length; i++) {
				const outcome = push.outcomes[i];
				if (outcome === 'failed') await markFailed(pushClaims[i].key, 'push failed');
				else await markSent(pushClaims[i].key); // delivered, or nothing to deliver to
			}
			result.pushDelivered! += push.outcomes.filter(o => o === 'delivered').length;
		}

		// Email: one per user listing every league still missing picks.
		if (!emailEnabled) continue;
		for (const user of round) {
			if (budget.exhausted) {
				result.partial = true;
				break;
			}
			const userId = String(user._id);
			const key = markerKeys.reminderEmail(kind, season, week, userId);
			touchedKeys.push(key);
			if (!(await claimMarker(key, { kind: 'pick_reminder_email', userId, season, week }))) continue;
			try {
				const leaguesNeeding = needs.get(userId)!;
				const common = { userName: user.name || 'Player', leagues: leaguesNeeding, unsubscribeToken: user.unsubscribeToken || '', weekNumber: week };
				const html = await render(
					kind === 'thursday' ? ThursdayReminderEmail({ ...common, thursdayGame: thursdayGame! }) : SaturdayReminderEmail(common)
				);
				const sent = await sendEmail({
					to: user.email,
					subject: kind === 'thursday' ? '🏈 Thursday Night Football starts soon! Make your picks' : '⏰ Last chance! Get your picks in before Sunday',
					html,
					idempotencyKey: key,
					unsubscribeToken: user.unsubscribeToken
				});
				if (sent.ok) {
					await markSent(key);
					result.emailsSent!++;
				} else {
					await markFailed(key, sent.error);
					result.emailsFailed!++;
					console.error(`[Pick Reminders] Email to user ${userId} failed: ${sent.error}`);
				}
			} catch (error) {
				await markFailed(key, errorMessage(error));
				result.emailsFailed!++;
				console.error(`[Pick Reminders] Email to user ${userId} failed: ${errorMessage(error)}`);
			}
		}
	}

	if (!result.partial && !(await hasRetryableMarkers(touchedKeys))) {
		await markJobDone(jobName, season, week);
		result.complete = true;
	}
	return result;
}

function reminderPushPayload(
	kind: ReminderKind,
	week: number,
	thursdayGame: { awayTeam: string; homeTeam: string; gameTime: string } | null,
	leagues: Array<{ id: string }>
) {
	const body =
		kind === 'thursday' && thursdayGame
			? `${thursdayGame.awayTeam} vs ${thursdayGame.homeTeam} starts at ${thursdayGame.gameTime}! Make your picks.`
			: "Don't miss out! Make your picks before Sunday's games.";
	return {
		title: kind === 'thursday' ? '🏈 Thursday Night Football!' : '⏰ Last Chance for Picks!',
		body,
		url: '/dashboard',
		// One reminder per week on the device: Saturday's replaces Thursday's.
		tag: `pick-reminder-${week}`,
		requireInteraction: true,
		leagueIds: leagues.map(l => l.id)
	};
}
