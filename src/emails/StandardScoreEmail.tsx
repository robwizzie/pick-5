import * as React from 'react';
import { Callout, nameList, ScoreEmailShell, type PickResult } from './components';
import { colors, plural } from './theme';

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

interface StandardScoreEmailProps {
	userName: string;
	leagueName: string;
	weekNumber: number;
	userPoints: number;
	maxPoints: number;
	userRank: number;
	totalPlayers: number;
	leaderboard: LeaderboardEntry[];
	upsetInfo: UpsetInfo | null;
	unsubscribeToken: string;
	/** Optional: links the CTA to the league page. */
	leagueId?: string;
	/** Optional: user's correct-pick count. */
	userCorrect?: number;
	/** Optional: per-pick scorecard (team, result, odds, points). */
	picks?: PickResult[];
}

export const StandardScoreEmail = ({
	userName = 'Player',
	leagueName = 'My League',
	weekNumber = 1,
	userPoints = 0,
	maxPoints = 75,
	userRank = 1,
	totalPlayers = 1,
	leaderboard = [],
	upsetInfo = null,
	unsubscribeToken = '',
	leagueId,
	userCorrect,
	picks
}: StandardScoreEmailProps) => {
	const hitters = upsetInfo?.players?.length ? nameList(upsetInfo.players) : upsetInfo ? plural(upsetInfo.userCount, 'player') : '';

	return (
		<ScoreEmailShell
			mode='standard'
			{...{ userName, leagueName, weekNumber, userPoints, maxPoints, userRank, totalPlayers, leaderboard, unsubscribeToken, leagueId, userCorrect, picks }}
			callout={
				upsetInfo && upsetInfo.points ? (
					<Callout tone='win' label='Upset of the week' title={`${upsetInfo.team} over ${upsetInfo.opponent}`}>
						Worth <strong style={{ color: colors.win }}>+{plural(upsetInfo.points, 'pt')}</strong>. {hitters} called it.
					</Callout>
				) : null
			}
		/>
	);
};

export default StandardScoreEmail;
