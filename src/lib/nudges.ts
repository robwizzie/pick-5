// Nudges: a league member reminds another to get this week's picks in. One nudge per player per
// league per week. Delivered where it's most likely to get picks made: a push notification that
// opens the league (falling back to email when they have no push), a banner on the league page,
// and a post in the league feed so the whole league sees who's holding things up.
import { render } from '@react-email/render';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { LeagueMessage } from '@/models/LeagueMessage';
import { Nudge } from '@/models/Nudge';
import { Pick } from '@/models/Pick';
import { SurvivorPick } from '@/models/SurvivorPick';
import { User } from '@/models/User';
import { getCurrentSeasonYear, getSeasonWeeks, seasonPickFilter } from '@/lib/season';
import { isSurvivorMode } from '@/lib/leagueRules';
import { loadSurvivor } from '@/lib/survivorServer';
import { NFLService } from '@/services/nflService';
import { hasGameStarted } from '@/services/gameUtils';
import { sendPushMessages } from '@/lib/notifications/push';
import { isEmailConfigured, sendEmail } from '@/lib/notifications/email';
import { formatKickoffEt } from '@/lib/notifications/games';
import NudgeEmail from '@/emails/NudgeEmail';
import type { NudgeStatus } from '@/lib/nudgeTypes';
import type { Game } from '@/components/games/GameCard';

/** A pick 'em slate needs 5 unstarted games to still be makeable. */
const PICKS_PER_WEEK = 5;

interface NudgeContext {
	league: { name: string; mode?: string; members: string[] };
	season: number;
	week: number;
	games: Game[];
	open: boolean;
	pickedIn: Set<string>;
	/** Members who can still be nudged (no picks, and in survivor still alive) */
	nudgeable: Set<string>;
}

/** Everything a nudge decision needs for the week being played now. Null when there's no week to nudge for. */
async function nudgeContext(leagueId: string): Promise<NudgeContext | null> {
	await connectDB();
	const league = await League.findById(leagueId, 'name mode members').lean<{ name: string; mode?: string; members?: string[] }>();
	if (!league) return null;
	const members = (league.members ?? []).map(String);
	const season = getCurrentSeasonYear();
	const { startWeek, finalWeek } = await getSeasonWeeks(season);
	const live = await NFLService.getCurrentWeek(true);
	if (live < startWeek || live > finalWeek) return { league: { ...league, members }, season, week: live, games: [], open: false, pickedIn: new Set(), nudgeable: new Set() };
	const week = live;

	const games = await NFLService.getWeeklyGames(week, season);
	const unstarted = games.filter(g => !hasGameStarted(g)).length;
	const survivor = isSurvivorMode(league.mode);
	const open = survivor ? unstarted > 0 : unstarted >= PICKS_PER_WEEK;

	const pickedIn = new Set<string>();
	const nudgeable = new Set<string>();
	if (survivor) {
		const [picks, standings] = await Promise.all([
			SurvivorPick.find({ leagueId, season, week }, 'userId').lean<Array<{ userId: string }>>(),
			loadSurvivor(leagueId, season, '')
		]);
		picks.forEach(p => pickedIn.add(String(p.userId)));
		const alive = new Set(standings && !standings.data.complete ? standings.data.members.filter(m => m.alive).map(m => m.userId) : []);
		// Players who are out have nothing to pick: count them as done
		members.filter(id => !alive.has(id)).forEach(id => pickedIn.add(id));
	} else {
		const picks = await Pick.find({ leagueId, week, ...seasonPickFilter(season) }, 'userId').lean<Array<{ userId: string }>>();
		picks.forEach(p => pickedIn.add(String(p.userId)));
	}
	if (open) members.filter(id => !pickedIn.has(id)).forEach(id => nudgeable.add(id));

	return { league: { name: league.name, mode: league.mode, members }, season, week, games, open, pickedIn, nudgeable };
}

/** This week's picks-in and nudge state for a league, from the viewer's point of view. */
export async function getNudgeStatus(leagueId: string, viewerId: string): Promise<NudgeStatus | null> {
	const ctx = await nudgeContext(leagueId);
	if (!ctx || !ctx.league.members.includes(viewerId)) return null;
	const nudges = await Nudge.find({ leagueId, season: ctx.season, week: ctx.week }, 'toUserId fromUserId createdAt').lean<Array<{ toUserId: string; fromUserId: string; createdAt: Date }>>();
	const senders = await User.find({ _id: { $in: nudges.map(n => n.fromUserId) } }, 'name').lean<Array<{ _id: unknown; name?: string }>>();
	const nameOf = new Map(senders.map(u => [String(u._id), u.name || 'A league-mate']));

	const nudged: NudgeStatus['nudged'] = {};
	for (const n of nudges) nudged[n.toUserId] = { fromUserId: n.fromUserId, fromName: nameOf.get(n.fromUserId) ?? 'A league-mate', at: new Date(n.createdAt).toISOString() };

	const mine = ctx.nudgeable.has(viewerId) && nudged[viewerId] ? { fromName: nudged[viewerId].fromName, at: nudged[viewerId].at } : null;
	return {
		season: ctx.season,
		week: ctx.week,
		open: ctx.open,
		pickedIn: Array.from(ctx.pickedIn),
		nudged,
		canNudge: Array.from(ctx.nudgeable).filter(id => id !== viewerId && !nudged[id]),
		mine
	};
}

export type NudgeResult = { ok: true; delivered: 'push' | 'email' | 'in-app' } | { ok: false; status: number; error: string };

/** Nudge `toUserId` from `fromUserId` for this week. Validates everything; at most one per player per week. */
export async function sendNudge(leagueId: string, fromUserId: string, toUserId: string): Promise<NudgeResult> {
	if (fromUserId === toUserId) return { ok: false, status: 400, error: 'You can’t nudge yourself — just make your picks!' };
	const ctx = await nudgeContext(leagueId);
	if (!ctx) return { ok: false, status: 404, error: 'League not found' };
	if (!ctx.league.members.includes(fromUserId)) return { ok: false, status: 403, error: 'Not a member of this league' };
	if (!ctx.league.members.includes(toUserId)) return { ok: false, status: 400, error: 'That player isn’t in this league' };
	if (!ctx.open) return { ok: false, status: 400, error: 'Picks are closed for this week' };
	if (!ctx.nudgeable.has(toUserId)) return { ok: false, status: 400, error: 'Their picks are already in' };

	try {
		await Nudge.create({ leagueId, season: ctx.season, week: ctx.week, toUserId, fromUserId });
	} catch (error) {
		if ((error as { code?: number })?.code === 11000) return { ok: false, status: 409, error: 'Someone already nudged them this week' };
		throw error;
	}

	const [from, to] = await Promise.all([
		User.findById(fromUserId, 'name').lean<{ name?: string }>(),
		User.findById(toUserId, 'name email unsubscribeToken emailPreferences').lean<{ name?: string; email?: string; unsubscribeToken?: string; emailPreferences?: { pickReminders?: boolean } }>()
	]);
	const fromName = from?.name || 'A league-mate';
	const fromFirst = fromName.split(' ')[0];
	const toFirst = (to?.name || 'Someone').split(' ')[0];
	const next = ctx.games
		.filter(g => !hasGameStarted(g))
		.map(g => new Date(g.date))
		.sort((a, b) => a.getTime() - b.getTime())[0];
	const nextKickoff = next ? `${next.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })} ${formatKickoffEt(next)}` : null;
	const survivor = isSurvivorMode(ctx.league.mode);
	const what = survivor ? 'survivor pick' : 'picks';
	const missing = survivor ? `Your Week ${ctx.week} survivor pick isn’t in yet` : `Your Week ${ctx.week} picks aren’t in yet`;

	// Everyone sees it in the feed
	await LeagueMessage.updateOne(
		{ leagueId, momentKey: `nudge:${ctx.season}:${ctx.week}:${toUserId}` },
		{
			$setOnInsert: {
				leagueId,
				kind: 'moment',
				momentKey: `nudge:${ctx.season}:${ctx.week}:${toUserId}`,
				emoji: '👉',
				text: `${fromFirst} nudged ${toFirst} to get their Week ${ctx.week} ${what} in.`,
				userIds: [toUserId, fromUserId],
				season: ctx.season,
				week: ctx.week
			}
		},
		{ upsert: true }
	).catch(error => console.error('[nudge] Feed post failed:', error));

	// Push first: one tap opens the league's picks
	const push = await sendPushMessages([
		{
			userId: toUserId,
			payload: {
				title: `👉 ${fromFirst} nudged you`,
				body: `${missing} in ${ctx.league.name}.${nextKickoff ? ` Next kickoff ${nextKickoff}.` : ''} Tap to pick.`,
				url: `/league/${leagueId}`,
				tag: `nudge-${leagueId}-${ctx.week}`,
				requireInteraction: true,
				leagueId
			}
		}
	]).catch(error => {
		console.error('[nudge] Push failed:', error);
		return null;
	});
	if (push?.outcomes[0] === 'delivered') return { ok: true, delivered: 'push' };

	// No push: email them, unless they've turned pick reminders off
	if (to?.email && to.emailPreferences?.pickReminders !== false && isEmailConfigured()) {
		const html = await render(
			NudgeEmail({ userName: to.name || 'Player', fromName, leagueId, leagueName: ctx.league.name, week: ctx.week, nextKickoff, unsubscribeToken: to.unsubscribeToken || '' })
		);
		const sent = await sendEmail({
			to: to.email,
			subject: `👉 ${fromFirst} nudged you: Week ${ctx.week} ${what} for ${ctx.league.name}`,
			html,
			idempotencyKey: `nudge-${leagueId}-${ctx.season}-${ctx.week}-${toUserId}`,
			unsubscribeToken: to.unsubscribeToken
		}).catch(() => null);
		if (sent?.ok) return { ok: true, delivered: 'email' };
	}
	// They'll still see the banner next time they open the league
	return { ok: true, delivered: 'in-app' };
}
