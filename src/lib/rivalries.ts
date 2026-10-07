// All-time head-to-head records between league members, across every season the league has
// played. Past seasons never change, so their tallies are cached for the life of the process.
import { loadLeagueSeason, type LeagueSeason } from '@/lib/leagueSeason';
import { seasonsWithPicks } from '@/lib/season';
import { pairKey, weekMatchups, type PairRecord } from '@/lib/matchups';

const pastSeasonCache = new Map<string, Record<string, PairRecord>>();

/** Pair tallies from every final, contested member-vs-member matchup of a season through `throughWeek`. */
export function seasonPairRecords(season: LeagueSeason, throughWeek = Infinity): Record<string, PairRecord> {
	const pairs: Record<string, PairRecord> = {};
	for (const week of Array.from(season.weeks.keys()).filter(w => w <= throughWeek)) {
		for (const m of weekMatchups(season, week)) {
			if (m.isBye || m.status !== 'final' || m.noContest) continue;
			const [a, b] = m.sides.map(s => s.userId).sort();
			const rec = (pairs[pairKey(a, b)] ??= { a, b, aWins: 0, bWins: 0, ties: 0 });
			if (m.isTie) rec.ties++;
			else if (m.winnerId === a) rec.aWins++;
			else rec.bWins++;
		}
	}
	return pairs;
}

function addInto(total: Record<string, PairRecord>, add: Record<string, PairRecord>) {
	for (const [key, rec] of Object.entries(add)) {
		const t = (total[key] ??= { a: rec.a, b: rec.b, aWins: 0, bWins: 0, ties: 0 });
		t.aWins += rec.aWins;
		t.bWins += rec.bWins;
		t.ties += rec.ties;
	}
}

/**
 * Every pair's all-time record in this league: past seasons (each paired among the members who
 * played that season, as the schedule then was) plus `current` through `throughWeek`.
 */
export async function allTimePairRecords(leagueId: string, current: LeagueSeason, throughWeek: number): Promise<Record<string, PairRecord>> {
	const total: Record<string, PairRecord> = {};
	const past = (await seasonsWithPicks({ leagueId })).filter(s => s < current.season);
	for (const year of past) {
		const key = `${leagueId}:${year}`;
		let records = pastSeasonCache.get(key);
		if (!records) {
			const season = await loadLeagueSeason(leagueId, year);
			if (!season) continue;
			// Pair only the members who actually played that season
			const played = new Set(Array.from(season.weeks.values()).flatMap(byUser => Array.from(byUser.keys())));
			records = seasonPairRecords({ ...season, members: season.members.filter(m => played.has(m.userId)) });
			pastSeasonCache.set(key, records);
		}
		addInto(total, records);
	}
	addInto(total, seasonPairRecords(current, throughWeek));
	return total;
}
