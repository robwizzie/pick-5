import { Text } from '@react-email/components';
import * as React from 'react';
import { Accent, EmailLayout, Headline, KickoffCard, Paragraph, PrimaryButton } from './components';
import { baseUrl, colors, display } from './theme';

interface NudgeEmailProps {
	userName: string;
	fromName: string;
	leagueId: string;
	leagueName: string;
	week: number;
	/** e.g. "Thu 8:15 PM EDT" — the next game that can still be picked */
	nextKickoff?: string | null;
	unsubscribeToken: string;
}

/** A league-mate's nudge to get this week's picks in. */
export const NudgeEmail = ({ userName = 'Player', fromName = 'A league-mate', leagueId = '', leagueName = 'your league', week = 1, nextKickoff, unsubscribeToken = '' }: NudgeEmailProps) => {
	const firstName = userName.split(' ')[0] || 'Player';
	const fromFirst = fromName.split(' ')[0] || fromName;

	return (
		<EmailLayout
			preview={`${fromFirst} nudged you: your Week ${week} picks aren't in yet in ${leagueName}.`}
			kicker={`Week ${week} · ${leagueName}`}
			reason={`${fromFirst} nudged you from ${leagueName}`}
			unsubscribeToken={unsubscribeToken}
		>
			<Headline eyebrow={`From ${fromFirst}`} eyebrowColor={colors.warn}>
				You&apos;ve been <Accent>nudged</Accent>
			</Headline>
			<Paragraph>
				{firstName}, {fromFirst} noticed your Week {week} picks aren&apos;t in yet in <strong>{leagueName}</strong>. Five picks, one minute — don&apos;t hand
				them a free week.
			</Paragraph>

			{nextKickoff && (
				<KickoffCard badge='Next kickoff'>
					<Text style={{ ...display, margin: 0, fontSize: '30px', lineHeight: '32px', color: colors.text, textAlign: 'center' }}>
						<Accent color={colors.warn}>{nextKickoff}</Accent>
					</Text>
					<Text style={{ margin: '6px 0 0', color: colors.muted, fontSize: '13px', lineHeight: '18px', textAlign: 'center' }}>
						Games lock at kickoff. Get yours in before then.
					</Text>
				</KickoffCard>
			)}

			<PrimaryButton href={`${baseUrl}/league/${leagueId}`}>Make my picks</PrimaryButton>
		</EmailLayout>
	);
};

export default NudgeEmail;
