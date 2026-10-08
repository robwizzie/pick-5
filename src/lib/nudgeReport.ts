// Nudge report: do nudges get picks made? For a season, how often nudged players went on to pick,
// how fast, broken down by where the nudge reached them, against players who were also missing
// picks at the time but weren't nudged.
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { Nudge } from '@/models/Nudge';
import { Pick } from '@/models/Pick';
import { SurvivorPick } from '@/models/SurvivorPick';
import { seasonPickFilter } from '@/lib/season';
import { isSurvivorMode } from '@/lib/leagueRules';
import type { NudgeReport, NudgeReportRow } from '@/lib/nudgeReportTypes';

interface NudgeDoc {
	leagueId: string;
	season: number;
	week: number;
	toUserId: string;
	createdAt: Date;
	channel?: 'push' | 'email' | 'in-app' | null;
	openedAt?: Date | null;
	pickedAt?: Date | null;
}

const HOUR_MS = 60 * 60 * 1000;
const key = (leagueId: string, week: number, userId: string) => `${leagueId}:${week}:${userId}`;

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function row(label: string, outcomes: Array<{ picked: Date | null; from: Date; opened?: boolean }>): NudgeReportRow {
	const converted = outcomes.filter(o => o.picked);
	return {
		label,
		count: outcomes.length,
		opened: outcomes.filter(o => o.opened).length,
		picked: converted.length,
		pickRate: outcomes.length ? converted.length / outcomes.length : null,
		medianHoursToPick: median(converted.map(o => Math.max(0, (o.picked!.getTime() - o.from.getTime()) / HOUR_MS)))
	};
}

export async function getNudgeReport(season: number): Promise<NudgeReport> {
	await connectDB();
	const nudges = await Nudge.find({ season }, 'leagueId season week toUserId createdAt channel openedAt pickedAt').lean<NudgeDoc[]>();
	const leagueIds = Array.from(new Set(nudges.map(n => n.leagueId)));
	const weeks = Array.from(new Set(nudges.map(n => n.week)));

	const [leagues, picks, survivorPicks] = await Promise.all([
		League.find({ _id: { $in: leagueIds } }, 'mode members').lean<Array<{ _id: unknown; mode?: string; members?: unknown[] }>>(),
		Pick.find({ leagueId: { $in: leagueIds }, week: { $in: weeks }, ...seasonPickFilter(season) }, 'userId leagueId week createdAt firstSubmittedAt').lean<
			Array<{ userId: string; leagueId: string; week: number; createdAt: Date; firstSubmittedAt?: Date }>
		>(),
		SurvivorPick.find({ leagueId: { $in: leagueIds }, season, week: { $in: weeks } }, 'userId leagueId week createdAt').lean<
			Array<{ userId: string; leagueId: string; week: number; createdAt: Date }>
		>()
	]);
	const leagueById = new Map(leagues.map(l => [String(l._id), { survivor: isSurvivorMode(l.mode), members: (l.members ?? []).map(String) }]));

	// When each player's picks first went in. Pick 'em picks from before firstSubmittedAt existed only
	// have createdAt, which is their last edit: a late estimate.
	const firstPick = new Map<string, { at: Date; exact: boolean }>();
	for (const p of picks) firstPick.set(key(String(p.leagueId), p.week, String(p.userId)), { at: new Date(p.firstSubmittedAt ?? p.createdAt), exact: Boolean(p.firstSubmittedAt) });
	for (const p of survivorPicks) firstPick.set(key(String(p.leagueId), p.week, String(p.userId)), { at: new Date(p.createdAt), exact: true });

	// Each nudge's outcome: its own pickedAt when tracked, else the pick it can be joined to
	let estimated = 0;
	const outcomes = nudges.map(n => {
		const from = new Date(n.createdAt);
		let picked: Date | null = n.pickedAt ? new Date(n.pickedAt) : null;
		if (!picked) {
			const pick = firstPick.get(key(n.leagueId, n.week, n.toUserId));
			if (pick && pick.at >= from) {
				picked = pick.at;
				if (!pick.exact) estimated++;
			}
		}
		return { nudge: n, from, picked, opened: Boolean(n.openedAt) };
	});

	const channels: Array<[string, (n: NudgeDoc) => boolean]> = [
		['Push', n => n.channel === 'push'],
		['Email', n => n.channel === 'email'],
		['In-app only', n => n.channel === 'in-app'],
		['Before tracking', n => !n.channel]
	];
	const byChannel = channels.map(([label, match]) => row(label, outcomes.filter(o => match(o.nudge)))).filter(r => r.count > 0);

	// Baseline, pick 'em leagues only (survivor players who are out never pick, and we can't tell them
	// apart after the fact): for each league-week with a nudge, members who weren't nudged and had no
	// picks in when the first nudge went out. Measured from that first nudge.
	const nudgedIn = new Set(nudges.map(n => key(n.leagueId, n.week, n.toUserId)));
	const firstNudgeAt = new Map<string, Date>();
	for (const n of nudges) {
		const lw = `${n.leagueId}:${n.week}`;
		const at = new Date(n.createdAt);
		if (!firstNudgeAt.has(lw) || at < firstNudgeAt.get(lw)!) firstNudgeAt.set(lw, at);
	}
	const baselineOutcomes: Array<{ picked: Date | null; from: Date }> = [];
	for (const [lw, from] of Array.from(firstNudgeAt)) {
		const [leagueId, week] = [lw.slice(0, lw.lastIndexOf(':')), Number(lw.slice(lw.lastIndexOf(':') + 1))];
		const league = leagueById.get(leagueId);
		if (!league || league.survivor) continue;
		for (const userId of league.members) {
			const k = key(leagueId, week, userId);
			if (nudgedIn.has(k)) continue;
			const pick = firstPick.get(k);
			if (pick && pick.at < from) continue; // already in
			baselineOutcomes.push({ picked: pick?.at ?? null, from });
		}
	}

	const pickEmOnly = outcomes.filter(o => leagueById.get(o.nudge.leagueId) && !leagueById.get(o.nudge.leagueId)!.survivor);
	return {
		season,
		overall: row('All nudges', outcomes),
		byChannel,
		comparison: {
			nudged: row('Nudged', pickEmOnly),
			notNudged: row('Not nudged', baselineOutcomes)
		},
		estimatedPickTimes: estimated
	};
}
