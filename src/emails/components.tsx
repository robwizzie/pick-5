import { Body, Button, Column, Container, Head, Heading, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { baseUrl, brandStripe, colors, display, fonts, modeLabel, ordinal, plural, rankColor, tabular } from './theme';

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

// Progressive enhancement only: clients that honour <style>/<link> (Apple Mail, iOS, Gmail apps)
// get tighter mobile padding and the real display face; everything else falls back to inline styles.
const responsiveCss = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&display=swap');
:root { color-scheme: dark light; supported-color-schemes: dark light; }
@media only screen and (max-width: 480px) {
	.p5-pad { padding-left: 20px !important; padding-right: 20px !important; }
	.p5-h1 { font-size: 40px !important; line-height: 40px !important; }
	.p5-stat-num { font-size: 32px !important; }
	.p5-cta { display: block !important; }
	.p5-hide-sm { display: none !important; }
}
`;

interface EmailLayoutProps {
	preview: string;
	/** Short broadcast-style tag shown top-right of the header, e.g. "Week 6 · Final". */
	kicker?: string;
	/** Completes "You're receiving this because …". */
	reason: string;
	unsubscribeToken: string;
	children: React.ReactNode;
}

export const EmailLayout = ({ preview, kicker, reason, unsubscribeToken, children }: EmailLayoutProps) => (
	<Html lang='en' dir='ltr'>
		<Head>
			<meta name='color-scheme' content='dark light' />
			<meta name='supported-color-schemes' content='dark light' />
			<style>{responsiveCss}</style>
		</Head>
		<Preview>{preview}</Preview>
		<Body style={body}>
			<Container style={container}>
				<BrandHeader kicker={kicker} />
				<Section style={card}>
					<BrandStripe />
					<Section className='p5-pad' style={cardInner}>
						{children}
					</Section>
				</Section>
				<Footer reason={reason} unsubscribeToken={unsubscribeToken} />
			</Container>
		</Body>
	</Html>
);

const BrandHeader = ({ kicker }: { kicker?: string }) => (
	<Section style={{ padding: '0 4px 16px' }}>
		<Row>
			<Column style={{ width: '48px', verticalAlign: 'middle' }}>
				<Link href={baseUrl}>
					<Img src={`${baseUrl}/email-logo.png`} width='40' height='46' alt='Pick 5' style={{ display: 'block', border: 0 }} />
				</Link>
			</Column>
			<Column style={{ verticalAlign: 'middle' }}>
				<Text style={{ ...display, margin: 0, fontSize: '26px', lineHeight: '26px', color: colors.text }}>
					Pick <span style={{ color: colors.primary }}>5</span>
				</Text>
			</Column>
			{kicker ? (
				<Column align='right' style={{ verticalAlign: 'middle' }}>
					<Text style={{ ...eyebrowBase, margin: 0, color: colors.muted, textAlign: 'right' }}>{kicker}</Text>
				</Column>
			) : null}
		</Row>
	</Section>
);

/** Solid-color cells instead of a CSS gradient so Outlook/Gmail render the brand bar. */
const BrandStripe = () => (
	<Row>
		{brandStripe.map(color => (
			<Column key={color} style={{ backgroundColor: color, height: '4px', lineHeight: '4px', fontSize: '1px' }}>
				&nbsp;
			</Column>
		))}
	</Row>
);

const Footer = ({ reason, unsubscribeToken }: { reason: string; unsubscribeToken: string }) => (
	<Section style={{ padding: '24px 16px 8px', textAlign: 'center' }}>
		<Text style={footerText}>You&apos;re receiving this because {reason}.</Text>
		<Text style={footerText}>
			<Link href={`${baseUrl}/settings`} style={footerLink}>
				Email preferences
			</Link>
			<span style={{ color: colors.faint }}>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
			<Link href={`${baseUrl}/api/unsubscribe/${unsubscribeToken}`} style={footerLink}>
				Unsubscribe
			</Link>
			<span style={{ color: colors.faint }}>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
			<Link href={baseUrl} style={footerLink}>
				sportspick5.com
			</Link>
		</Text>
		<Text style={{ ...footerText, color: colors.faint, fontSize: '11px' }}>
			Pick 5 is a free game for friends. Not affiliated with or endorsed by the NFL.
		</Text>
	</Section>
);

/* ------------------------------------------------------------------ */
/* Typography + primitives                                             */
/* ------------------------------------------------------------------ */

export const Headline = ({ eyebrow, eyebrowColor = colors.primary, children }: { eyebrow?: string; eyebrowColor?: string; children: React.ReactNode }) => (
	<>
		{eyebrow ? <Text style={{ ...eyebrowBase, color: eyebrowColor, margin: '0 0 10px' }}>{eyebrow}</Text> : null}
		<Heading as='h1' className='p5-h1' style={h1}>
			{children}
		</Heading>
	</>
);

export const Accent = ({ color = colors.primary, children }: { color?: string; children: React.ReactNode }) => (
	<span style={{ color }}>{children}</span>
);

export const Paragraph = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
	<Text style={{ ...paragraph, ...style }}>{children}</Text>
);

export const SectionLabel = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
	<Row style={{ margin: '32px 0 10px' }}>
		<Column>
			<Text style={{ ...display, margin: 0, fontSize: '20px', lineHeight: '22px', color: colors.text }}>{children}</Text>
		</Column>
		{right ? (
			<Column align='right'>
				<Text style={{ ...eyebrowBase, margin: 0, color: colors.muted, textAlign: 'right' }}>{right}</Text>
			</Column>
		) : null}
	</Row>
);

export const Pill = ({ color, children }: { color: string; children: React.ReactNode }) => (
	<span
		style={{
			display: 'inline-block',
			border: `1px solid ${color}`,
			borderRadius: '999px',
			padding: '3px 9px',
			color,
			fontFamily: fonts.body,
			fontSize: '10px',
			lineHeight: '14px',
			fontWeight: 700,
			letterSpacing: '0.12em',
			textTransform: 'uppercase',
			whiteSpace: 'nowrap'
		}}
	>
		{children}
	</span>
);

export const PrimaryButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
	<Section style={{ textAlign: 'center', margin: '32px 0 4px' }}>
		<Button className='p5-cta' href={href} style={button}>
			{children}&nbsp;&nbsp;→
		</Button>
	</Section>
);

/** Inset panel on the card surface. */
export const Panel = ({ children, tone, style }: { children: React.ReactNode; tone?: 'win' | 'loss' | 'warn' | 'primary'; style?: React.CSSProperties }) => {
	const toneMap = {
		win: [colors.winTint, colors.win],
		loss: [colors.lossTint, colors.loss],
		warn: [colors.warnTint, colors.warn],
		primary: [colors.primaryTint, colors.primary]
	} as const;
	const [bg, accent] = tone ? toneMap[tone] : [colors.cardRaised, colors.border];
	return (
		<Section
			style={{
				backgroundColor: bg,
				border: `1px solid ${tone ? accent : colors.border}`,
				borderRadius: '12px',
				...style
			}}
		>
			{children}
		</Section>
	);
};

/* ------------------------------------------------------------------ */
/* Reminder pieces                                                     */
/* ------------------------------------------------------------------ */

/** Broadcast "on air" card: a red live-style badge over big display text. */
export const KickoffCard = ({ badge, children }: { badge: string; children: React.ReactNode }) => (
	<Panel style={{ margin: '24px 0 0' }}>
		<Section style={{ padding: '18px 16px 18px', textAlign: 'center' }}>
			<Text style={{ margin: '0 0 10px', textAlign: 'center' }}>
				<span
					style={{
						display: 'inline-block',
						backgroundColor: colors.loss,
						color: '#ffffff',
						borderRadius: '4px',
						padding: '3px 8px',
						fontSize: '10px',
						lineHeight: '14px',
						fontWeight: 700,
						letterSpacing: '0.16em',
						textTransform: 'uppercase'
					}}
				>
					{badge}
				</span>
			</Text>
			{children}
		</Section>
	</Panel>
);

export interface ReminderLeague {
	id: string;
	name: string;
	mode: string;
}

export const LeagueChecklist = ({ leagues }: { leagues: ReminderLeague[] }) => {
	if (leagues.length === 0) return null;
	return (
		<>
			<SectionLabel right={plural(leagues.length, 'league')}>Still needs picks</SectionLabel>
			<Panel>
				{leagues.map((league, i) => (
					<Row key={league.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.border}` }}>
						<Column style={{ padding: '14px 0 14px 16px', verticalAlign: 'middle' }}>
							<Link href={`${baseUrl}/league/${league.id}`} style={{ color: colors.text, fontSize: '16px', lineHeight: '20px', fontWeight: 700, textDecoration: 'none' }}>
								{league.name}
							</Link>
							<Text style={{ margin: '2px 0 0', color: colors.muted, fontSize: '12px', lineHeight: '16px' }}>{modeLabel(league.mode)}</Text>
						</Column>
						<Column align='right' style={{ padding: '14px 16px 14px 8px', verticalAlign: 'middle', width: '120px' }}>
							<Pill color={colors.warn}>Picks needed</Pill>
						</Column>
					</Row>
				))}
			</Panel>
		</>
	);
};

/* ------------------------------------------------------------------ */
/* Score pieces                                                        */
/* ------------------------------------------------------------------ */

interface Stat {
	label: string;
	value: React.ReactNode;
	sub: React.ReactNode;
	color: string;
}

export const ScoreBoard = ({ stats }: { stats: Stat[] }) => (
	<Panel style={{ margin: '28px 0 0' }}>
		<Row>
			{stats.map((stat, i) => (
				<Column
					key={stat.label}
					style={{
						width: `${Math.floor(100 / stats.length)}%`,
						padding: '18px 8px 16px',
						textAlign: 'center',
						verticalAlign: 'top',
						borderLeft: i === 0 ? 'none' : `1px solid ${colors.border}`
					}}
				>
					<Text style={{ ...eyebrowBase, margin: 0, color: colors.muted, fontSize: '10px' }}>{stat.label}</Text>
					<Text className='p5-stat-num' style={{ ...display, ...tabular, margin: '6px 0 2px', fontSize: '40px', lineHeight: '40px', color: stat.color }}>
						{stat.value}
					</Text>
					<Text style={{ margin: 0, color: colors.muted, fontSize: '12px', lineHeight: '16px', ...tabular }}>{stat.sub}</Text>
				</Column>
			))}
		</Row>
	</Panel>
);

export interface PickResult {
	/** Team the user picked. */
	team: string;
	opponent: string;
	/** true = correct, false = wrong, null/undefined = not final. */
	isCorrect?: boolean | null;
	/** American odds at the time of the pick (Standard mode). */
	odds?: number;
	/** Points earned for this pick. */
	points?: number;
}

const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`);

export const PicksList = ({ picks, showOdds }: { picks: PickResult[]; showOdds: boolean }) => {
	if (picks.length === 0) return null;
	const correct = picks.filter(p => p.isCorrect === true).length;
	return (
		<>
			<SectionLabel right={`${correct}/${picks.length} correct`}>Your picks</SectionLabel>
			<Panel>
				{picks.map((pick, i) => {
					const state = pick.isCorrect === true ? 'win' : pick.isCorrect === false ? 'loss' : 'pending';
					const mark = state === 'win' ? '✓' : state === 'loss' ? '✗' : '–';
					const markColor = state === 'win' ? colors.win : state === 'loss' ? colors.loss : colors.warn;
					const points = pick.points ?? 0;
					return (
						<Row key={`${pick.team}-${i}`} style={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.border}` }}>
							<Column style={{ width: '36px', padding: '12px 0 12px 14px', verticalAlign: 'middle' }}>
								<Text style={{ margin: 0, width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', borderRadius: '999px', border: `1px solid ${markColor}`, color: markColor, fontSize: '13px', fontWeight: 700 }}>
									{mark}
								</Text>
							</Column>
							<Column style={{ padding: '12px 8px', verticalAlign: 'middle' }}>
								<Text style={{ margin: 0, color: colors.text, fontSize: '15px', lineHeight: '20px', fontWeight: 700 }}>{pick.team}</Text>
								<Text style={{ margin: 0, color: colors.muted, fontSize: '12px', lineHeight: '16px' }}>
									vs {pick.opponent}
									{showOdds && pick.odds !== undefined ? <span style={tabular}>&nbsp;·&nbsp;{formatOdds(pick.odds)}</span> : null}
								</Text>
							</Column>
							<Column align='right' style={{ width: '64px', padding: '12px 14px 12px 0', verticalAlign: 'middle' }}>
								<Text style={{ ...display, ...tabular, margin: 0, fontSize: '22px', lineHeight: '22px', textAlign: 'right', color: points > 0 ? colors.win : colors.faint }}>
									{points > 0 ? `+${points}` : '0'}
								</Text>
							</Column>
						</Row>
					);
				})}
			</Panel>
		</>
	);
};

export interface StandingsEntry {
	userId: string;
	player: string;
	points: number;
	correct: number;
}

interface StandingsProps {
	entries: StandingsEntry[];
	userRank: number;
	userName: string;
	userPoints: number;
	userCorrect?: number;
	totalPlayers: number;
}

export const StandingsTable = ({ entries, userRank, userName, userPoints, userCorrect, totalPlayers }: StandingsProps) => {
	if (entries.length === 0) return null;
	// The cron route sorts the full leaderboard and derives rank from the same order, so the
	// user's row in the top-N slice is exactly index userRank - 1.
	const userInList = userRank >= 1 && userRank <= entries.length;
	const rows = entries.map((e, i) => ({ rank: i + 1, name: e.player, points: e.points, correct: e.correct as number | undefined, isUser: userInList && i === userRank - 1 }));
	if (!userInList && userRank > 0) {
		rows.push({ rank: userRank, name: userName, points: userPoints, correct: userCorrect, isUser: true });
	}

	return (
		<>
			<SectionLabel right={`Top ${entries.length} of ${totalPlayers}`}>League standings</SectionLabel>
			<Panel>
				<Row>
					<Column style={{ ...thCell, width: '44px', paddingLeft: '16px' }}>Rk</Column>
					<Column style={thCell}>Player</Column>
					<Column className='p5-hide-sm' align='right' style={{ ...thCell, width: '64px', textAlign: 'right' }}>
						Correct
					</Column>
					<Column align='right' style={{ ...thCell, width: '64px', textAlign: 'right', paddingRight: '16px' }}>
						Pts
					</Column>
				</Row>
				{rows.map((row, i) => {
					const gap = !userInList && row.isUser;
					return (
						<Row
							key={`${row.rank}-${row.name}`}
							style={{
								backgroundColor: row.isUser ? colors.primaryTint : 'transparent',
								borderTop: gap ? `1px dashed ${colors.borderStrong}` : `1px solid ${colors.border}`,
								borderRadius: i === rows.length - 1 ? '0 0 12px 12px' : undefined
							}}
						>
							<Column style={{ ...tdCell, width: '44px', paddingLeft: row.isUser ? '13px' : '16px', borderLeft: row.isUser ? `3px solid ${colors.primary}` : 'none' }}>
								<span style={{ ...display, ...tabular, fontSize: '20px', color: rankColor(row.rank) }}>{row.rank}</span>
							</Column>
							<Column style={{ ...tdCell, color: colors.text, fontWeight: row.isUser || row.rank <= 3 ? 700 : 400 }}>
								{row.name}
								{row.isUser ? <span style={{ color: colors.primary, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>&nbsp;&nbsp;YOU</span> : null}
							</Column>
							<Column className='p5-hide-sm' align='right' style={{ ...tdCell, ...tabular, width: '64px', textAlign: 'right', color: colors.muted }}>
								{row.correct ?? '–'}
							</Column>
							<Column align='right' style={{ ...tdCell, width: '64px', textAlign: 'right', paddingRight: '16px' }}>
								<span style={{ ...display, ...tabular, fontSize: '20px', color: row.isUser ? colors.primary : colors.text }}>{row.points}</span>
							</Column>
						</Row>
					);
				})}
			</Panel>
		</>
	);
};

export const Callout = ({ tone, label, title, children }: { tone: 'win' | 'loss'; label: string; title: React.ReactNode; children: React.ReactNode }) => {
	const accent = tone === 'win' ? colors.win : colors.loss;
	return (
		<Panel tone={tone} style={{ margin: '28px 0 0' }}>
			<Section style={{ padding: '18px 20px' }}>
				<Text style={{ ...eyebrowBase, margin: '0 0 6px', color: accent }}>{label}</Text>
				<Text style={{ ...display, margin: '0 0 6px', fontSize: '26px', lineHeight: '28px', color: colors.text }}>{title}</Text>
				<Text style={{ margin: 0, color: colors.textSoft, fontSize: '14px', lineHeight: '21px' }}>{children}</Text>
			</Section>
		</Panel>
	);
};

/** "Alice, Bob and 3 others" — keeps long name lists from blowing up the layout. */
export const nameList = (names: string[], max = 3): string => {
	if (names.length <= max) {
		return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}
	const rest = names.length - max;
	return `${names.slice(0, max).join(', ')} and ${plural(rest, 'other')}`;
};

/* ------------------------------------------------------------------ */
/* Score email shell shared by Standard + Steve                        */
/* ------------------------------------------------------------------ */

export interface ScoreEmailBaseProps {
	userName: string;
	leagueName: string;
	weekNumber: number;
	userPoints: number;
	maxPoints: number;
	userRank: number;
	totalPlayers: number;
	leaderboard: StandingsEntry[];
	unsubscribeToken: string;
	/** Optional: links the CTA straight to the league page instead of the dashboard. */
	leagueId?: string;
	/** Optional: user's correct-pick count (otherwise read from the leaderboard when the user is in it). */
	userCorrect?: number;
	/** Optional: per-pick breakdown for the scorecard. */
	picks?: PickResult[];
}

interface ScoreEmailShellProps extends ScoreEmailBaseProps {
	mode: 'standard' | 'steve';
	/** Mode-specific blocks rendered between the picks and the standings (e.g. Steve TFS). */
	extra?: React.ReactNode;
	/** Mode-specific callout rendered after the standings. */
	callout?: React.ReactNode;
}

export const ScoreEmailShell = ({
	mode,
	userName,
	leagueName,
	weekNumber,
	userPoints,
	maxPoints,
	userRank,
	totalPlayers,
	leaderboard,
	unsubscribeToken,
	leagueId,
	userCorrect,
	picks,
	extra,
	callout
}: ScoreEmailShellProps) => {
	const firstName = userName.split(' ')[0] || 'Player';
	const correct = userCorrect ?? (userRank >= 1 && userRank <= leaderboard.length ? leaderboard[userRank - 1].correct : picks?.filter(p => p.isCorrect === true).length);
	const leaderPoints = leaderboard[0]?.points;
	const behind = leaderPoints !== undefined ? Math.max(0, leaderPoints - userPoints) : undefined;

	const headline =
		userRank === 1 ? (
			<>
				Week {weekNumber} <Accent color={colors.gold}>is yours</Accent>
			</>
		) : userRank > 1 && userRank <= 3 ? (
			<>
				<Accent color={rankColor(userRank)}>Podium</Accent> finish
			</>
		) : (
			<>
				Week {weekNumber} <Accent>is final</Accent>
			</>
		);

	const summary =
		userRank === 1
			? `you topped ${leagueName} with ${plural(userPoints, 'point')}. Enjoy the bragging rights.`
			: `you put up ${plural(userPoints, 'point')} in ${leagueName} and finished ${ordinal(userRank)} of ${totalPlayers}.`;

	const thirdStat: Stat =
		correct !== undefined
			? { label: 'Correct', value: correct, sub: picks?.length ? `of ${picks.length} picks` : 'picks right', color: colors.text }
			: { label: 'Back of 1st', value: behind ?? '–', sub: 'points', color: colors.text };

	return (
		<EmailLayout
			preview={`Week ${weekNumber} is final: ${plural(userPoints, 'pt')} and ${ordinal(userRank)} place in ${leagueName}.`}
			kicker={`Week ${weekNumber} · Final`}
			reason={`you're in ${leagueName} and have weekly score emails turned on`}
			unsubscribeToken={unsubscribeToken}
		>
			<Headline eyebrow={`${leagueName} · ${modeLabel(mode)}`}>{headline}</Headline>
			<Paragraph>
				{firstName}, {summary}
			</Paragraph>

			<ScoreBoard
				stats={[
					{ label: 'Points', value: userPoints, sub: `of ${maxPoints} possible`, color: userPoints > 0 ? colors.win : colors.text },
					{ label: 'Rank', value: ordinal(userRank), sub: `of ${totalPlayers}`, color: userRank <= 3 ? rankColor(userRank) : colors.text },
					thirdStat
				]}
			/>

			{picks?.length ? <PicksList picks={picks} showOdds={mode === 'standard'} /> : null}
			{extra}

			<StandingsTable entries={leaderboard} userRank={userRank} userName={userName} userPoints={userPoints} userCorrect={correct} totalPlayers={totalPlayers} />

			{callout}

			<PrimaryButton href={leagueId ? `${baseUrl}/league/${leagueId}` : `${baseUrl}/dashboard`}>View full standings</PrimaryButton>
		</EmailLayout>
	);
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const eyebrowBase = {
	fontFamily: fonts.body,
	fontSize: '11px',
	lineHeight: '14px',
	fontWeight: 700,
	letterSpacing: '0.18em',
	textTransform: 'uppercase'
} as const;

const body: React.CSSProperties = {
	backgroundColor: colors.page,
	margin: 0,
	padding: '24px 0 32px',
	fontFamily: fonts.body,
	color: colors.text,
	WebkitFontSmoothing: 'antialiased'
};

const container: React.CSSProperties = {
	maxWidth: '600px',
	width: '100%',
	margin: '0 auto',
	padding: '0 12px'
};

const card: React.CSSProperties = {
	backgroundColor: colors.card,
	border: `1px solid ${colors.border}`,
	borderRadius: '16px',
	overflow: 'hidden'
};

const cardInner: React.CSSProperties = {
	padding: '32px 32px 36px'
};

const h1: React.CSSProperties = {
	...display,
	color: colors.text,
	fontSize: '52px',
	lineHeight: '50px',
	margin: '0 0 16px'
};

const paragraph: React.CSSProperties = {
	color: colors.textSoft,
	fontSize: '16px',
	lineHeight: '24px',
	margin: '0 0 8px'
};

const button: React.CSSProperties = {
	...display,
	backgroundColor: colors.primary,
	color: colors.primaryInk,
	fontSize: '20px',
	lineHeight: '20px',
	letterSpacing: '0.02em',
	padding: '17px 36px',
	borderRadius: '10px',
	textDecoration: 'none',
	textAlign: 'center'
};

const thCell: React.CSSProperties = {
	...eyebrowBase,
	fontSize: '10px',
	color: colors.faint,
	padding: '12px 8px 10px'
};

const tdCell: React.CSSProperties = {
	fontFamily: fonts.body,
	fontSize: '15px',
	lineHeight: '20px',
	padding: '11px 8px',
	verticalAlign: 'middle'
};

const footerText: React.CSSProperties = {
	color: colors.muted,
	fontSize: '12px',
	lineHeight: '18px',
	margin: '0 0 8px',
	textAlign: 'center'
};

const footerLink: React.CSSProperties = {
	color: colors.primary,
	textDecoration: 'underline'
};
