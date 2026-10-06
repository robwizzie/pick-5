import { Column, Row, Text } from '@react-email/components';
import * as React from 'react';
import { Accent, EmailLayout, Headline, KickoffCard, LeagueChecklist, Paragraph, PrimaryButton } from './components';
import { baseUrl, colors, display, plural } from './theme';

interface ThursdayReminderEmailProps {
	userName: string;
	thursdayGame: {
		awayTeam: string;
		homeTeam: string;
		gameTime: string;
	};
	leagues: Array<{
		id: string;
		name: string;
		mode: string;
	}>;
	unsubscribeToken: string;
	/** Optional: shown in the header kicker when provided. */
	weekNumber?: number;
}

export const ThursdayReminderEmail = ({
	userName = 'Player',
	thursdayGame = {
		awayTeam: 'Away Team',
		homeTeam: 'Home Team',
		gameTime: '8:15 PM ET'
	},
	leagues = [],
	unsubscribeToken = '',
	weekNumber
}: ThursdayReminderEmailProps) => {
	const firstName = userName.split(' ')[0] || 'Player';
	const { awayTeam, homeTeam, gameTime } = thursdayGame;

	return (
		<EmailLayout
			preview={`${awayTeam} at ${homeTeam} kicks off at ${gameTime} — ${leagues.length > 0 ? `your picks are still open in ${plural(leagues.length, 'league')}` : 'get your picks in'}.`}
			kicker={weekNumber ? `Week ${weekNumber} · TNF` : 'Thursday Night'}
			reason='you have Thursday pick reminders turned on'
			unsubscribeToken={unsubscribeToken}
		>
			<Headline eyebrow='Thursday Night Football' eyebrowColor={colors.loss}>
				Kickoff is <Accent>tonight</Accent>
			</Headline>
			<Paragraph>
				{firstName}, the week starts tonight and you haven&apos;t locked in your picks yet. Get them in before kickoff so you don&apos;t
				start the week behind.
			</Paragraph>

			<KickoffCard badge={`Tonight · ${gameTime}`}>
				<Row>
					<Column style={{ width: '44%', textAlign: 'right', verticalAlign: 'middle' }}>
						<Text style={{ ...display, margin: 0, fontSize: '24px', lineHeight: '26px', color: colors.text, textAlign: 'right' }}>{awayTeam}</Text>
					</Column>
					<Column style={{ width: '12%', textAlign: 'center', verticalAlign: 'middle' }}>
						<Text style={{ ...display, margin: 0, fontSize: '18px', lineHeight: '26px', color: colors.muted, textAlign: 'center' }}>@</Text>
					</Column>
					<Column style={{ width: '44%', textAlign: 'left', verticalAlign: 'middle' }}>
						<Text style={{ ...display, margin: 0, fontSize: '24px', lineHeight: '26px', color: colors.text, textAlign: 'left' }}>{homeTeam}</Text>
					</Column>
				</Row>
			</KickoffCard>

			<LeagueChecklist leagues={leagues} />

			<PrimaryButton href={`${baseUrl}/dashboard`}>Make your picks</PrimaryButton>
		</EmailLayout>
	);
};

export default ThursdayReminderEmail;
