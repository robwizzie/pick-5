// src/lib/notifications/jobs/scoreEmails.ts
// Weekly results email, one per (user, league), once the week's games are all final.
// Each email is claimed through a NotificationMarker before sending, so repeated or concurrent
// runs never send it twice; a run that runs out of budget is resumed by the next hourly run.
import { render } from '@react-email/render';
import { connectDB } from '@/lib/db';
import { seasonPickFilter } from '@/lib/season';
import { League } from '@/models/League';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { ScoringService } from '@/services/scoringService';
import { rulesFor, type ScoringRules } from '@/lib/leagueRules';
import { SeasonService } from '@/services/seasonService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import SteveScoreEmail from '@/emails/SteveScoreEmail';
import StandardScoreEmail from '@/emails/StandardScoreEmail';
import type { PickResult } from '@/emails/components';
import { getLastCompletedWeek, isFinal, pointsForCorrectPick, toGameResults, type GameResultRow } from '../games';
import { isEmailConfigured, sendEmail } from '../email';
import { claimMarker, ensureMarkerIndexes, hasRetryableMarkers, isJobDone, markerKeys, markFailed, markJobDone, markSent } from '../markers';
import { scoreEmailRecipientsFilter } from '../preferences';
import { RunBudget, errorMessage } from '../runtime';

const JOB = 'score-emails';
/** The TFS tiebreaker is worth at most 5 points (ScoringService.calculateTFSPoints). */
const MAX_TFS_POINTS = 5;

export interface ScoreEmailsJobResult {
	skipped?: string;
	week?: number;
	leagues?: number;
	emailsSent?: number;
	emailsFailed?: number;
	partial?: boolean;
	complete?: boolean;
}

interface LeanPickDoc {
	userId: string;
	leagueId: string;
	picks: Array<{ gameId: string; team: string; opponent: string; isHome: boolean; odds?: number }>;
	tfsGame?: string | null;
	tfsScore?: number | null;
	lockGameId?: string | null;
}

interface LeaderboardEntry {
	userId: string;
	player: string;
	points: number;
	correct: number;
}

interface UpsetInfo {
	team: string;
	opponent: string;
	userCount: number;
	points?: number;
	players?: string[];
}

interface ScoredEntry {
	doc: LeanPickDoc;
	isCorrect: Array<boolean | null>;
	weeklyPoints: number;
	correctPicks: number;
	tfsPoints: number;
}

export async function runScoreEmailsJob({ budgetMs }: { budgetMs: number }): Promise<ScoreEmailsJobResult> {
	const budget = new RunBudget(budgetMs);

	await connectDB();
	const seasonStatus = await SeasonService.getSeasonStatus();
	// canSendNotifications still allows the final week's email after ESPN moves on a week.
	if (!seasonStatus.canSendNotifications) return { skipped: 'season not active for notifications' };
	if (!isEmailConfigured()) return { skipped: 'RESEND_API_KEY not set' };

	const season = seasonStatus.seasonYear;
	const completed = await getLastCompletedWeek(season);
	if (!completed) return { skipped: 'no completed week yet' };
	const { week } = completed;

	await ensureMarkerIndexes();
	if (await isJobDone(JOB, season, week)) return { skipped: 'already sent', week };

	const gameResults = toGameResults(completed.games);
	const gameById = new Map(gameResults.map(g => [g.id, g]));
	const gameMeta = new Map(completed.games.map(g => [g.id, g]));

	const recipients = (await User.find(scoreEmailRecipientsFilter)
		.select('name email unsubscribeToken')
		.lean()) as unknown as Array<{ _id: unknown; name?: string; email: string; unsubscribeToken?: string }>;
	const recipientById = new Map(recipients.map(u => [String(u._id), u]));
	if (recipients.length === 0) {
		await markJobDone(JOB, season, week);
		return { week, emailsSent: 0, complete: true };
	}

	const leagues = (await League.find({ members: { $in: Array.from(recipientById.keys()) } })
		.select('name mode settings')
		.lean()) as unknown as Array<{ _id: unknown; name: string; mode?: string; settings?: object }>;
	const leagueIds = leagues.map(l => String(l._id));
	const allPicks = (await Pick.find({ week, leagueId: { $in: leagueIds }, ...seasonPickFilter(season) })
		.select('userId leagueId picks tfsGame tfsScore lockGameId')
		.lean()) as unknown as LeanPickDoc[];

	const pickerIds = Array.from(new Set(allPicks.map(p => String(p.userId))));
	const pickers = (await User.find({ _id: { $in: pickerIds } })
		.select('name')
		.lean()) as unknown as Array<{ _id: unknown; name?: string }>;
	const nameById = new Map(pickers.map(u => [String(u._id), u.name || 'Unknown Player']));

	const picksByLeague = new Map<string, LeanPickDoc[]>();
	for (const pick of allPicks) {
		const leagueId = String(pick.leagueId);
		picksByLeague.set(leagueId, [...(picksByLeague.get(leagueId) ?? []), pick]);
	}

	const result: ScoreEmailsJobResult = { week, leagues: 0, emailsSent: 0, emailsFailed: 0 };
	const touchedKeys: string[] = [];

	outer: for (const league of leagues) {
		const leagueId = String(league._id);
		const leaguePicks = picksByLeague.get(leagueId) ?? [];
		const toEmail = leaguePicks.filter(p => recipientById.has(String(p.userId)));
		if (toEmail.length === 0) continue;
		result.leagues!++;

		const mode = league.mode || 'standard';
		const rules = rulesFor(league);
		const scored: ScoredEntry[] = leaguePicks.map(doc => {
			const score = ScoringService.calculateWeekScore(doc.picks, gameResults, doc.tfsGame ?? null, doc.tfsScore ?? null, rules, calculatePointsFromOdds, doc.lockGameId);
			return {
				doc,
				isCorrect: score.scoredPicks.map(p => p.isCorrect ?? null),
				weeklyPoints: score.weeklyPoints,
				correctPicks: score.correctPicks,
				tfsPoints: score.tfsPoints
			};
		});
		const leaderboard: LeaderboardEntry[] = scored
			.map(s => ({ userId: String(s.doc.userId), player: nameById.get(String(s.doc.userId)) || 'Unknown Player', points: s.weeklyPoints, correct: s.correctPicks }))
			.sort((a, b) => b.points - a.points);
		const upsetInfo = findUpset(mode, scored, nameById);

		for (const entry of scored) {
			const userId = String(entry.doc.userId);
			const user = recipientById.get(userId);
			if (!user) continue;
			if (budget.exhausted) {
				result.partial = true;
				break outer;
			}

			const key = markerKeys.scoreEmail(season, week, userId, leagueId);
			touchedKeys.push(key);
			if (!(await claimMarker(key, { kind: 'score_email', userId, leagueId, season, week }))) continue;

			try {
				const props = {
					userName: user.name || 'Player',
					leagueName: league.name,
					weekNumber: week,
					userPoints: entry.weeklyPoints,
					maxPoints: maxPossiblePoints(rules, entry.doc, leaguePicks, gameById),
					userRank: leaderboard.findIndex(e => e.userId === userId) + 1,
					totalPlayers: leaderboard.length,
					leaderboard: leaderboard.slice(0, 5),
					upsetInfo,
					unsubscribeToken: user.unsubscribeToken || '',
					leagueId,
					userCorrect: entry.correctPicks,
					picks: pickResults(rules, entry)
				};
				const html = await render(
					mode === 'steve' ? SteveScoreEmail({ ...props, tfs: tfsResult(entry, gameMeta) }) : StandardScoreEmail(props)
				);
				const sent = await sendEmail({
					to: user.email,
					subject: `📊 Week ${week} Results - ${league.name}`,
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
					console.error(`[Score Emails] Email to user ${userId} (league ${leagueId}) failed: ${sent.error}`);
				}
			} catch (error) {
				await markFailed(key, errorMessage(error));
				result.emailsFailed!++;
				console.error(`[Score Emails] Email to user ${userId} (league ${leagueId}) failed: ${errorMessage(error)}`);
			}
		}
	}

	if (!result.partial && !(await hasRetryableMarkers(touchedKeys))) {
		await markJobDone(JOB, season, week);
		result.complete = true;
	}
	return result;
}

function pickResults(rules: ScoringRules, entry: ScoredEntry): PickResult[] {
	return entry.doc.picks.map((pick, i) => {
		const isCorrect = entry.isCorrect[i];
		const isLock = rules.lockMultiplier > 1 && !!entry.doc.lockGameId && entry.doc.lockGameId === pick.gameId;
		return {
			team: pick.team,
			opponent: pick.opponent,
			isCorrect,
			odds: typeof pick.odds === 'number' ? pick.odds : undefined,
			points: isCorrect ? pointsForCorrectPick(rules, pick.odds, isLock) : 0,
			isLock
		};
	});
}

function tfsResult(entry: ScoredEntry, games: Map<string, { home: { abbreviation: string; score?: number }; away: { abbreviation: string; score?: number }; status?: string }>) {
	const { tfsGame, tfsScore } = entry.doc;
	if (!tfsGame || tfsScore === null || tfsScore === undefined) return undefined;
	const game = games.get(tfsGame);
	if (!game) return undefined;
	return {
		game: `${game.away.abbreviation} @ ${game.home.abbreviation}`,
		guess: tfsScore,
		actual: isFinal(game) ? (game.home.score || 0) + (game.away.score || 0) : null,
		points: entry.tfsPoints
	};
}

/** Most points the user could have scored with the picks they made (finished games only). */
function maxPossiblePoints(rules: ScoringRules, userPick: LeanPickDoc, leaguePicks: LeanPickDoc[], gameById: Map<string, GameResultRow>): number {
	const finished = userPick.picks.filter(p => {
		const game = gameById.get(p.gameId);
		return !!game && isFinal(game);
	});

	const lockMultiplier = rules.lockMultiplier;
	if (rules.mode === 'steve') {
		// 2 per correct pick, plus the TFS tiebreaker when it was graded.
		const tfsGame = userPick.tfsGame ? gameById.get(userPick.tfsGame) : undefined;
		const tfsGraded = rules.tfsEnabled && !!tfsGame && isFinal(tfsGame) && userPick.tfsScore !== null && userPick.tfsScore !== undefined;
		// A winning lock doubles one pick, so it's part of the best possible week
		const lockBonus = finished.length > 0 ? 2 * (lockMultiplier - 1) : 0;
		return finished.length * 2 + lockBonus + (tfsGraded ? MAX_TFS_POINTS : 0);
	}

	// Standard: for each picked game, the best payout anyone in the league could get on it,
	// with the richest one doubled as a winning lock.
	let max = 0;
	let bestSingle = 0;
	for (const pick of finished) {
		let best = 5; // default if no odds found
		for (const other of leaguePicks) {
			const odds = other.picks.find(p => p.gameId === pick.gameId)?.odds;
			if (typeof odds === 'number') best = Math.max(best, calculatePointsFromOdds(odds));
		}
		max += best;
		bestSingle = Math.max(bestSingle, best);
	}
	return max + bestSingle * (lockMultiplier - 1);
}

/**
 * Steve mode: the game the most players got wrong. Standard mode: the highest-paying correct
 * pick. Uses the live re-scored results (stored isCorrect can be stale).
 */
function findUpset(mode: string, scored: ScoredEntry[], nameById: Map<string, string>): UpsetInfo | null {
	let upset: UpsetInfo | null = null;

	if (mode === 'steve') {
		const counts = new Map<string, { winningTeam: string; losingTeam: string; players: string[] }>();
		for (const entry of scored) {
			const player = nameById.get(String(entry.doc.userId)) || 'Unknown Player';
			entry.doc.picks.forEach((pick, i) => {
				if (entry.isCorrect[i] !== false) return;
				const key = `${pick.gameId}-${pick.team}`;
				const row = counts.get(key) ?? { winningTeam: pick.opponent, losingTeam: pick.team, players: [] };
				row.players.push(player);
				counts.set(key, row);
			});
		}
		let most = 0;
		for (const row of Array.from(counts.values())) {
			if (row.players.length > most) {
				most = row.players.length;
				upset = { team: row.winningTeam, opponent: row.losingTeam, userCount: row.players.length, players: row.players };
			}
		}
		return upset;
	}

	const byTeam = new Map<string, { points: number; opponent: string; players: string[] }>();
	for (const entry of scored) {
		const player = nameById.get(String(entry.doc.userId)) || 'Unknown Player';
		entry.doc.picks.forEach((pick, i) => {
			if (entry.isCorrect[i] !== true || typeof pick.odds !== 'number') return;
			const row = byTeam.get(pick.team) ?? { points: calculatePointsFromOdds(pick.odds), opponent: pick.opponent, players: [] };
			row.players.push(player);
			byTeam.set(pick.team, row);
		});
	}
	let maxPoints = 0;
	for (const [team, row] of Array.from(byTeam.entries())) {
		if (row.points > maxPoints) {
			maxPoints = row.points;
			upset = { team, opponent: row.opponent, userCount: row.players.length, points: row.points, players: row.players };
		}
	}
	return upset;
}
