// Season achievements ("badges") per member per league. The compute functions are pure over a
// LeagueSeason; only loadKickoffs touches the network (ESPN schedule, cached).
//
// Definitions (only FINAL games count, so nothing about unstarted picks is revealed):
// - Upset Hunter: 3 correct picks on plus-money underdogs (stored odds > 0). Picks without stored
//   odds (common in Steve leagues) aren't eligible.
// - Giant Killer: a correct pick at +300 or longer.
// - Perfect Week: 5 picks in a week, all final and correct.
// - Hot Streak: 5 correct picks in a row, ordered by kickoff (then week, then game id). A loss
//   (ties count as losses, as in scoring) breaks it. This is pick-level, unlike the stats page's
//   older "weeks at 60%+" streak metric.
// - Lock Legend: 3 correct locks of the week.
// - Weekly Winner: top score (ties included, > 0 points) of a finished week with 2+ players.
import type { LeagueSeason, ScoredPick } from '@/lib/leagueSeason';
import { NFLService } from '@/services/nflService';

export type BadgeId = 'upset-hunter' | 'giant-killer' | 'perfect-week' | 'hot-streak' | 'lock-legend' | 'weekly-winner';
export type BadgeTone = 'gold' | 'accent' | 'primary' | 'hot' | 'warning' | 'violet';

export interface Badge {
	id: BadgeId;
	name: string;
	description: string;
	/** lucide-react icon name */
	icon: 'Crosshair' | 'Swords' | 'Crown' | 'Flame' | 'Lock' | 'Trophy';
	tier: 'common' | 'rare' | 'epic' | 'legendary';
	tone: BadgeTone;
	earned: boolean;
	progress: { current: number; target: number };
	/** Week the badge was first earned */
	earnedWeek: number | null;
	/** Times achieved this season (e.g. 2 perfect weeks) */
	count: number;
}

export const BADGE_DEFS: Record<BadgeId, Omit<Badge, 'earned' | 'progress' | 'earnedWeek' | 'count'> & { target: number }> = {
	'hot-streak': { id: 'hot-streak', name: 'Hot Streak', description: '5 correct picks in a row', icon: 'Flame', tier: 'rare', tone: 'hot', target: 5 },
	'upset-hunter': { id: 'upset-hunter', name: 'Upset Hunter', description: '3 correct underdog picks (plus-money)', icon: 'Crosshair', tier: 'rare', tone: 'accent', target: 3 },
	'weekly-winner': { id: 'weekly-winner', name: 'Weekly Winner', description: 'Topped the league in a week', icon: 'Trophy', tier: 'rare', tone: 'primary', target: 1 },
	'lock-legend': { id: 'lock-legend', name: 'Lock Legend', description: '3 correct locks of the week', icon: 'Lock', tier: 'epic', tone: 'violet', target: 3 },
	'giant-killer': { id: 'giant-killer', name: 'Giant Killer', description: 'Hit a +300 or longer underdog', icon: 'Swords', tier: 'epic', tone: 'warning', target: 1 },
	'perfect-week': { id: 'perfect-week', name: 'Perfect Week', description: 'All 5 picks correct in a week', icon: 'Crown', tier: 'legendary', tone: 'gold', target: 5 }
};

/** Display order: most prestigious first (used for the leaderboard's top-3 icons). */
export const BADGE_ORDER: BadgeId[] = ['perfect-week', 'giant-killer', 'lock-legend', 'hot-streak', 'upset-hunter', 'weekly-winner'];

export const UPSET_TARGET = 3;
export const GIANT_KILLER_ODDS = 300;
export const STREAK_TARGET = 5;
export const LOCK_TARGET = 3;

interface FinalPick extends ScoredPick {
	week: number;
	kickoff: number;
	order: number;
}

function badge(id: BadgeId, current: number, earnedWeek: number | null, count: number): Badge {
	const { target, ...def } = BADGE_DEFS[id];
	const earned = earnedWeek !== null;
	return { ...def, earned, progress: { current: earned ? target : Math.min(current, target), target }, earnedWeek, count };
}

/** Week in which a running count over chronological picks first reaches target. */
function weekReaching(picks: FinalPick[], target: number, pred: (p: FinalPick) => boolean): { count: number; week: number | null } {
	let count = 0;
	let week: number | null = null;
	for (const p of picks) {
		if (!pred(p)) continue;
		count++;
		if (count === target) week = p.week;
	}
	return { count, week };
}

/**
 * Badges for every member of the league. `kickoffs` (gameId -> epoch ms) orders picks for the
 * streak; without it picks fall back to week, then pick order.
 */
export function computeLeagueBadges(season: LeagueSeason, kickoffs: Map<string, number> = new Map()): Map<string, Badge[]> {
	const weeks = Array.from(season.weeks.keys()).sort((a, b) => a - b);
	const finalStatus = (week: number) => {
		const status = new Map((season.resultsByWeek.get(week) ?? []).map(r => [r.id, r.status]));
		return (gameId: string) => status.get(gameId) === 'post' || status.get(gameId) === 'final';
	};

	// Weekly winners: weeks where every picked game (anyone's) is final
	const weekWinners = new Map<number, Set<string>>();
	for (const week of weeks) {
		const byUser = season.weeks.get(week)!;
		const isFinal = finalStatus(week);
		const players = Array.from(byUser.values()).filter(w => w.picks.length > 0);
		if (players.length < 2 || !players.every(w => w.picks.every(p => isFinal(p.gameId)))) continue;
		const top = Math.max(...players.map(w => w.weeklyPoints));
		if (top <= 0) continue;
		weekWinners.set(week, new Set(players.filter(w => w.weeklyPoints === top).map(w => w.userId)));
	}

	const result = new Map<string, Badge[]>();
	for (const { userId } of season.members) {
		const finalPicks: FinalPick[] = [];
		let perfectWeeks = 0;
		let firstPerfect: number | null = null;
		let bestFinishedWeek = 0;

		for (const week of weeks) {
			const mw = season.weeks.get(week)!.get(userId);
			if (!mw) continue;
			const finals = mw.picks.filter(p => p.isCorrect !== null);
			mw.picks.forEach((p, order) => {
				if (p.isCorrect !== null) finalPicks.push({ ...p, week, order, kickoff: kickoffs.get(p.gameId) ?? Number.NaN });
			});
			if (finals.length === mw.picks.length && mw.picks.length > 0) {
				const correct = finals.filter(p => p.isCorrect).length;
				bestFinishedWeek = Math.max(bestFinishedWeek, correct);
				if (mw.picks.length >= 5 && correct === mw.picks.length) {
					perfectWeeks++;
					firstPerfect ??= week;
				}
			}
		}

		finalPicks.sort((a, b) => {
			const ka = Number.isNaN(a.kickoff) ? Infinity : a.kickoff;
			const kb = Number.isNaN(b.kickoff) ? Infinity : b.kickoff;
			return a.week - b.week || ka - kb || a.order - b.order || a.gameId.localeCompare(b.gameId);
		});

		// Streak
		let run = 0;
		let bestRun = 0;
		let streakWeek: number | null = null;
		let streaks = 0;
		for (const p of finalPicks) {
			run = p.isCorrect ? run + 1 : 0;
			bestRun = Math.max(bestRun, run);
			if (run === STREAK_TARGET) {
				streaks++;
				streakWeek ??= p.week;
			}
		}

		const upsets = weekReaching(finalPicks, UPSET_TARGET, p => !!p.isCorrect && typeof p.odds === 'number' && p.odds > 0);
		const giants = weekReaching(finalPicks, 1, p => !!p.isCorrect && typeof p.odds === 'number' && p.odds >= GIANT_KILLER_ODDS);
		const locks = weekReaching(finalPicks, LOCK_TARGET, p => !!p.isCorrect && p.isLock);
		const wonWeeks = weeks.filter(w => weekWinners.get(w)?.has(userId));

		const badges: Record<BadgeId, Badge> = {
			'perfect-week': badge('perfect-week', bestFinishedWeek, firstPerfect, perfectWeeks),
			'giant-killer': badge('giant-killer', giants.count, giants.week, giants.count),
			'lock-legend': badge('lock-legend', locks.count, locks.week, Math.floor(locks.count / LOCK_TARGET)),
			'hot-streak': badge('hot-streak', bestRun, streakWeek, streaks),
			'upset-hunter': badge('upset-hunter', upsets.count, upsets.week, Math.floor(upsets.count / UPSET_TARGET)),
			'weekly-winner': badge('weekly-winner', wonWeeks.length, wonWeeks[0] ?? null, wonWeeks.length)
		};
		result.set(userId, BADGE_ORDER.map(id => badges[id]));
	}
	return result;
}

/* ------------------------------ cross-league ------------------------------ */

export interface UserBadge extends Badge {
	/** League where it was first earned (or with the most progress when locked) */
	leagueId: string | null;
	leagueName: string | null;
	leagues: Array<{ leagueId: string; leagueName: string; earned: boolean; earnedWeek: number | null; progress: Badge['progress']; count: number }>;
}

/** Merge one member's badges across leagues: earned if earned anywhere. */
export function mergeUserBadges(perLeague: Array<{ leagueId: string; leagueName: string; badges: Badge[] }>): UserBadge[] {
	return BADGE_ORDER.map(id => {
		const entries = perLeague
			.map(l => ({ league: l, badge: l.badges.find(b => b.id === id) }))
			.filter((e): e is { league: (typeof perLeague)[number]; badge: Badge } => !!e.badge);
		const earned = entries.filter(e => e.badge.earned).sort((a, b) => (a.badge.earnedWeek ?? 99) - (b.badge.earnedWeek ?? 99));
		const best = earned[0] ?? [...entries].sort((a, b) => b.badge.progress.current - a.badge.progress.current)[0];
		const base = best?.badge ?? badge(id, 0, null, 0);
		return {
			...base,
			count: entries.reduce((s, e) => s + e.badge.count, 0),
			leagueId: best?.league.leagueId ?? null,
			leagueName: best?.league.leagueName ?? null,
			leagues: entries.map(e => ({ leagueId: e.league.leagueId, leagueName: e.league.leagueName, earned: e.badge.earned, earnedWeek: e.badge.earnedWeek, progress: e.badge.progress, count: e.badge.count }))
		};
	});
}

/** GET /api/league/[id]/badges */
export interface LeagueBadgesResponse {
	leagueId: string;
	season: number;
	members: Array<{ userId: string; badges: Badge[] }>;
}

/** GET /api/user/badges */
export interface UserBadgesResponse {
	season: number;
	badges: UserBadge[];
}

/** Kickoff times for the given weeks (gameId -> epoch ms). Failures just leave weeks out. */
export async function loadKickoffs(weeks: number[], season: number): Promise<Map<string, number>> {
	const lists = await Promise.all(Array.from(new Set(weeks)).map(week => NFLService.getWeeklyGames(week, season).catch(() => [])));
	const map = new Map<string, number>();
	for (const games of lists) {
		for (const g of games) {
			const t = new Date(g.date).getTime();
			if (!Number.isNaN(t)) map.set(g.id, t);
		}
	}
	return map;
}
