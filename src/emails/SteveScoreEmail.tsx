import { Column, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Callout, nameList, Panel, ScoreEmailShell, SectionLabel, type PickResult } from './components';
import { colors, display, plural, tabular } from './theme';

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

interface TfsResult {
	/** Matchup label, e.g. "KC @ BUF". */
	game: string;
	/** User's total-final-score guess. */
	guess: number;
	/** Actual combined final score (null if the game isn't final). */
	actual: number | null;
	/** Points earned from the TFS guess. */
	points: number;
}

interface SteveScoreEmailProps {
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
	/** Optional: per-pick scorecard (team, result, points). */
	picks?: PickResult[];
	/** Optional: Total Final Score tiebreaker result. */
	tfs?: TfsResult;
}

const TfsCard = ({ tfs }: { tfs: TfsResult }) => {
	const off = tfs.actual === null ? null : Math.abs(tfs.guess - tfs.actual);
	const cells: Array<[string, React.ReactNode, string]> = [
		['Your guess', tfs.guess, colors.text],
		['Actual', tfs.actual ?? '–', colors.text],
		['Points', tfs.points > 0 ? `+${tfs.points}` : '0', tfs.points > 0 ? colors.win : colors.faint]
	];
	return (
		<>
			<SectionLabel right={tfs.game}>Total final score</SectionLabel>
			<Panel>
				<Row>
					{cells.map(([label, value, color], i) => (
						<Column key={label} style={{ width: '33%', padding: '14px 8px', textAlign: 'center', borderLeft: i === 0 ? 'none' : `1px solid ${colors.border}` }}>
							<Text style={{ margin: 0, color: colors.muted, fontSize: '10px', lineHeight: '14px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</Text>
							<Text style={{ ...display, ...tabular, margin: '4px 0 0', fontSize: '28px', lineHeight: '30px', color }}>{value}</Text>
						</Column>
					))}
				</Row>
				{off !== null ? (
					<Section style={{ borderTop: `1px solid ${colors.border}`, padding: '10px 16px' }}>
						<Text style={{ margin: 0, color: colors.muted, fontSize: '12px', lineHeight: '16px', textAlign: 'center' }}>
							{off === 0 ? 'Dead on. Perfect guess.' : `Off by ${plural(off, 'point')}.`}
						</Text>
					</Section>
				) : null}
			</Panel>
		</>
	);
};

export const SteveScoreEmail = ({
	userName = 'Player',
	leagueName = 'My League',
	weekNumber = 1,
	userPoints = 0,
	maxPoints = 10,
	userRank = 1,
	totalPlayers = 1,
	leaderboard = [],
	upsetInfo = null,
	unsubscribeToken = '',
	leagueId,
	userCorrect,
	picks,
	tfs
}: SteveScoreEmailProps) => {
	const victims = upsetInfo?.players?.length ? nameList(upsetInfo.players) : upsetInfo ? plural(upsetInfo.userCount, 'player') : '';
	const verb = (upsetInfo?.players?.length ?? upsetInfo?.userCount ?? 0) === 1 ? 'was' : 'were';

	return (
		<ScoreEmailShell
			mode='steve'
			{...{ userName, leagueName, weekNumber, userPoints, maxPoints, userRank, totalPlayers, leaderboard, unsubscribeToken, leagueId, userCorrect, picks }}
			extra={tfs ? <TfsCard tfs={tfs} /> : null}
			callout={
				upsetInfo ? (
					<Callout tone='loss' label='Biggest upset' title={`${upsetInfo.team} stunned ${upsetInfo.opponent}`}>
						{victims} {verb} riding with {upsetInfo.opponent}. Nobody saw that one coming.
					</Callout>
				) : null
			}
		/>
	);
};

export default SteveScoreEmail;
