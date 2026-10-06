import { Text } from '@react-email/components';
import * as React from 'react';
import { Accent, EmailLayout, Headline, KickoffCard, LeagueChecklist, Paragraph, PrimaryButton } from './components';
import { baseUrl, colors, display, plural } from './theme';

interface SaturdayReminderEmailProps {
	userName: string;
	leagues: Array<{
		id: string;
		name: string;
		mode: string;
	}>;
	unsubscribeToken: string;
	/** Optional: shown in the header kicker when provided. */
	weekNumber?: number;
}

export const SaturdayReminderEmail = ({ userName = 'Player', leagues = [], unsubscribeToken = '', weekNumber }: SaturdayReminderEmailProps) => {
	const firstName = userName.split(' ')[0] || 'Player';

	return (
		<EmailLayout
			preview={`Sunday's early games kick off tomorrow at 1:00 PM ET. ${leagues.length > 0 ? `You still need picks in ${plural(leagues.length, 'league')}.` : 'Lock in your picks.'}`}
			kicker={weekNumber ? `Week ${weekNumber} · Sunday` : 'Sunday slate'}
			reason='you have Saturday pick reminders turned on'
			unsubscribeToken={unsubscribeToken}
		>
			<Headline eyebrow='Kickoff tomorrow · 1:00 PM ET' eyebrowColor={colors.warn}>
				Last call <Accent>for picks</Accent>
			</Headline>
			<Paragraph>
				{firstName}, Sunday&apos;s slate kicks off tomorrow and your picks aren&apos;t in yet. It takes a minute — lock them in tonight
				and enjoy the games.
			</Paragraph>

			<KickoffCard badge='Tomorrow · Early window'>
				<Text style={{ ...display, margin: 0, fontSize: '30px', lineHeight: '32px', color: colors.text, textAlign: 'center' }}>
					Sunday <Accent color={colors.warn}>1:00 PM ET</Accent>
				</Text>
				<Text style={{ margin: '6px 0 0', color: colors.muted, fontSize: '13px', lineHeight: '18px', textAlign: 'center' }}>
					Get your picks in before the first game kicks off.
				</Text>
			</KickoffCard>

			<LeagueChecklist leagues={leagues} />

			<PrimaryButton href={`${baseUrl}/dashboard`}>Make your picks</PrimaryButton>
		</EmailLayout>
	);
};

export default SaturdayReminderEmail;
