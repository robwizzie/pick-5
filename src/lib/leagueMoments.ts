// Auto-posted league feed "moments": game-day events detected from picks and live scores, posted
// once each (keyed by momentKey). Generated on demand when members load the feed, throttled per
// league, so it works without a cron job.
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { LeagueMessage } from '@/models/LeagueMessage';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { seasonPickFilter, getSeasonWeeks } from '@/lib/season';
import { isSurvivorMode, rulesFor, type LeagueSettings } from '@/lib/leagueRules';
import { loadSurvivor } from '@/lib/survivorServer';
import { rescore, type PickDocLike } from '@/lib/pickScoring';
import { NFLService } from '@/services/nflService';
import { formatOdds } from '@/utils/oddsUtils';
import type { Game } from '@/components/games/GameCard';

/** Correct picks at or above these odds are called out as upsets. */
const UPSET_ODDS = 200;
/** A live game where at least this many members are on the trailing (or underdog-and-leading) side. */
const ALERT_MIN_PICKERS = 2;
/** Trailing by this much makes it a sweat. */
const SWEAT_DEFICIT = 7;
const THROTTLE_MS = 30_000;

export interface Moment {
	key: string;
	emoji: string;
	text: string;
	userIds: string[];
	week: number;
}

const lastRun = new Map<string, number>();

type LeanPick = PickDocLike & { userId: string; picks: Array<PickDocLike['picks'][number] & { opponent?: string }> };

const isFinal = (g?: Game) => g?.status === 'post' || g?.status === 'final';
const isLive = (g?: Game) => g?.status === 'in';
const nameList = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const firstName = (name: string) => name.split(' ')[0] || name;

/** Moments for one week of a pick 'em league. Pure over its inputs. */
export function pickEmMoments(input: {
	season: number;
	week: number;
	games: Game[];
	picks: LeanPick[];
	nameOf: (userId: string) => string;
	league: { mode?: string; settings?: LeagueSettings };
}): Moment[] {
	const { season, week, games, picks, nameOf, league } = input;
	const rules = rulesFor(league);
	const gameById = new Map(games.map(g => [g.id, g]));
	const moments: Moment[] = [];
	const base = `${season}:${week}`;

	// Pickers per game side
	const sides = new Map<string, { gameId: string; team: string; isHome: boolean; userIds: string[]; odds?: number }>();
	for (const doc of picks) {
		for (const p of doc.picks) {
			const key = `${p.gameId}:${p.team}`;
			const entry = sides.get(key) ?? { gameId: p.gameId, team: p.team, isHome: p.isHome, userIds: [], odds: typeof p.odds === 'number' ? p.odds : undefined };
			entry.userIds.push(String(doc.userId));
			sides.set(key, entry);
		}
	}

	for (const side of Array.from(sides.values())) {
		const game = gameById.get(side.gameId);
		if (!game) continue;
		const mine = side.isHome ? game.home : game.away;
		const theirs = side.isHome ? game.away : game.home;
		const myScore = mine.score ?? 0;
		const theirScore = theirs.score ?? 0;
		const names = side.userIds.map(id => firstName(nameOf(id)));

		// Underdog cashed
		if (isFinal(game) && myScore > theirScore && (side.odds ?? 0) >= UPSET_ODDS) {
			moments.push({
				key: `upset:${base}:${side.gameId}`,
				emoji: '🔥',
				text: `${nameList(names)} just hit a ${formatOdds(side.odds!)} upset: ${mine.abbreviation} over ${theirs.abbreviation}, ${myScore}–${theirScore}.`,
				userIds: side.userIds,
				week
			});
		}

		if (isLive(game) && side.userIds.length >= ALERT_MIN_PICKERS) {
			const n = side.userIds.length;
			if ((side.odds ?? 0) > 0 && myScore > theirScore) {
				moments.push({
					key: `alert:${base}:${side.gameId}:${side.team}`,
					emoji: '🚨',
					text: `Upset alert: ${n} of you are on the ${mine.abbreviation} (${formatOdds(side.odds!)}), up ${myScore}–${theirScore} on ${theirs.abbreviation}.`,
					userIds: side.userIds,
					week
				});
			} else if (theirScore - myScore >= SWEAT_DEFICIT) {
				moments.push({
					key: `sweat:${base}:${side.gameId}:${side.team}`,
					emoji: '😬',
					text: `Sweat check: ${n} of you are on the ${mine.abbreviation}, down ${theirScore}–${myScore} to ${theirs.abbreviation}.`,
					userIds: side.userIds,
					week
				});
			}
		}
	}

	// Per player: lock busts and perfect weeks
	const results = games.map(g => ({ id: g.id, homeScore: g.home.score, awayScore: g.away.score, homeTeam: g.home.team, awayTeam: g.away.team, status: g.status }));
	const scored = picks.map(doc => ({ userId: String(doc.userId), doc, score: rescore(doc, results, rules) }));
	for (const { userId, doc, score } of scored) {
		const name = firstName(nameOf(userId));
		if (rules.lockMultiplier > 1 && doc.lockGameId) {
			const lock = score.picks.find(p => p.gameId === doc.lockGameId);
			if (lock && lock.isCorrect === false) {
				moments.push({ key: `lockbust:${base}:${userId}`, emoji: '💀', text: `Lock bust: ${name}’s ${rules.lockMultiplier}× lock on the ${lock.team} went down.`, userIds: [userId], week });
			}
		}
		if (score.picks.length >= 5 && score.picks.every(p => p.isCorrect === true)) {
			moments.push({ key: `perfect:${base}:${userId}`, emoji: '👑', text: `${name} went a perfect ${score.picks.length}-for-${score.picks.length} in week ${week}.`, userIds: [userId], week });
		}
	}

	// Week winner once the whole slate is final
	if (games.length > 0 && games.every(isFinal) && scored.length >= 2) {
		const top = Math.max(...scored.map(s => s.score.weeklyPoints));
		if (top > 0) {
			const winners = scored.filter(s => s.score.weeklyPoints === top).map(s => s.userId);
			moments.push({
				key: `winner:${base}`,
				emoji: '🏆',
				text: `${nameList(winners.map(id => firstName(nameOf(id))))} ${winners.length > 1 ? 'split' : 'wins'} week ${week} with ${top} pts.`,
				userIds: winners,
				week
			});
		}
	}
	return moments;
}

/** Detect and post new moments for the given weeks. Throttled per league; failures are logged, never thrown. */
export async function postLeagueMoments(leagueId: string, season: number, weeks: number[]): Promise<void> {
	const now = Date.now();
	if (now - (lastRun.get(leagueId) ?? 0) < THROTTLE_MS) return;
	lastRun.set(leagueId, now);

	try {
		await connectDB();
		const league = await League.findById(leagueId, 'mode settings members').lean<{ mode?: string; settings?: LeagueSettings; members?: string[] }>();
		if (!league) return;
		const { startWeek, finalWeek } = await getSeasonWeeks(season);
		const inSeason = Array.from(new Set(weeks)).filter(w => w >= startWeek && w <= finalWeek);
		if (inSeason.length === 0) return;

		const users = await User.find({ _id: { $in: league.members ?? [] } }, 'name').lean<Array<{ _id: unknown; name?: string }>>();
		const names = new Map(users.map(u => [String(u._id), u.name || 'Someone']));
		const nameOf = (id: string) => names.get(id) ?? 'Someone';

		let moments: Moment[] = [];
		if (isSurvivorMode(league.mode)) {
			const result = await loadSurvivor(leagueId, season, '');
			if (result) {
				const { data } = result;
				for (const m of data.members) {
					if (m.eliminatedWeek !== null && inSeason.includes(m.eliminatedWeek)) {
						const pick = m.picks[m.eliminatedWeek];
						moments.push({
							key: `survivor-out:${season}:${m.userId}`,
							emoji: '🪦',
							text: m.eliminatedBy === 'no-pick' ? `${firstName(m.name)} forgot to pick in week ${m.eliminatedWeek} and is out of the pool.` : `${firstName(m.name)} is out: the ${pick?.team ?? 'pick'} lost in week ${m.eliminatedWeek}.`,
							userIds: [m.userId],
							week: m.eliminatedWeek
						});
					}
				}
				if (data.complete && data.champions.length) {
					moments.push({
						key: `survivor-champ:${season}`,
						emoji: '👑',
						text: `${nameList(data.champions.map(id => firstName(nameOf(id))))} ${data.champions.length > 1 ? 'outlasted everyone and share' : 'outlasted everyone and wins'} the survivor pool!`,
						userIds: data.champions,
						week: data.lastResolvedWeek ?? finalWeek
					});
				}
			}
		} else {
			for (const week of inSeason) {
				const [games, picks] = await Promise.all([
					NFLService.getWeeklyGames(week, season),
					Pick.find({ leagueId, week, ...seasonPickFilter(season) }, 'userId week picks tfsGame tfsScore lockGameId').lean<LeanPick[]>()
				]);
				const members = new Set((league.members ?? []).map(String));
				moments = moments.concat(pickEmMoments({ season, week, games, picks: picks.filter(p => members.has(String(p.userId))), nameOf, league }));
			}
		}
		if (moments.length === 0) return;

		await LeagueMessage.bulkWrite(
			moments.map(m => ({
				updateOne: {
					filter: { leagueId, momentKey: m.key },
					update: { $setOnInsert: { leagueId, kind: 'moment', momentKey: m.key, emoji: m.emoji, text: m.text, userIds: m.userIds, season, week: m.week } },
					upsert: true
				}
			})),
			{ ordered: false }
		);
	} catch (error) {
		// A concurrent insert of the same moment hits the unique index: harmless
		if ((error as { code?: number })?.code !== 11000) console.error(`[moments] Failed for league ${leagueId}:`, error);
	}
}
