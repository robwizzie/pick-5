import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
	Hr
} from '@react-email/components';
import * as React from 'react';

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
}

export const StandardScoreEmail = ({
	userName = 'Player',
	leagueName = 'My League',
	weekNumber = 1,
	userPoints = 0,
	maxPoints = 75,
	userRank = 1,
	totalPlayers = 10,
	leaderboard = [],
	upsetInfo = null,
	unsubscribeToken = 'token'
}: StandardScoreEmailProps) => {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.sportspick5.com';

	const getRankSuffix = (rank: number) => {
		if (rank === 1) return 'st';
		if (rank === 2) return 'nd';
		if (rank === 3) return 'rd';
		return 'th';
	};

	const getRankEmoji = (rank: number) => {
		if (rank === 1) return '🏆';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return '📊';
	};

	return (
		<Html>
			<Head />
			<Preview>{`Week ${weekNumber} Results - You scored ${userPoints}/${maxPoints} points in ${leagueName}!`}</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={`${baseUrl}/pick-5-logo.png`} width='auto' height='100' alt='Pick 5 Logo' style={logo} />
					</Section>

					{/* Heading */}
					<Heading style={h1}>📊 Week {weekNumber} Results Are In!</Heading>

					{/* Greeting */}
					<Text style={text}>Hey {userName},</Text>

					{/* League name */}
					<Text style={leagueNameText}>
						<strong>{leagueName}</strong> <span style={modeLabel}>(Standard Mode)</span>
					</Text>

					{/* User Score Section */}
					<Section style={scoreBox}>
						<Text style={scoreHeading}>Your Score</Text>
						<Text style={scorePoints}>
							<span style={userPointsStyle}>{userPoints}</span>
							<span style={separator}>/</span>
							<span style={maxPointsStyle}>{maxPoints}</span>
						</Text>
						<Text style={scoreSubtext}>points this week</Text>
					</Section>

					{/* Rank Section */}
					<Section style={rankSection}>
						<Text style={rankText}>
							<span style={rankEmoji}>{getRankEmoji(userRank)}</span> You placed{' '}
							<strong style={rankNumber}>
								{userRank}
								{getRankSuffix(userRank)}
							</strong>{' '}
							out of {totalPlayers} players
						</Text>
					</Section>

					{/* Leaderboard */}
					<Section style={leaderboardSection}>
						<Text style={leaderboardHeading}>🏅 Top 5 Leaderboard</Text>
						<Section style={leaderboardBox}>
							{leaderboard.map((entry, index) => (
								<div key={entry.userId} style={leaderboardItem}>
									<span style={leaderboardRank}>{index + 1}.</span>
									<span style={leaderboardName}>{entry.player}</span>
									<span style={leaderboardPoints}>{entry.points} pts</span>
								</div>
							))}
						</Section>
					</Section>

					{/* Upset Section */}
					{upsetInfo && upsetInfo.points && (
						<Section style={upsetSection}>
							<Text style={upsetHeading}>💎 Biggest Upset Pick</Text>
							<Text style={upsetText}>How could they have seen that coming?</Text>
							<Section style={upsetBox}>
								<Text style={upsetTeam}>
									{upsetInfo.team} beat {upsetInfo.opponent}
								</Text>
								<Text style={upsetSubtext}>
									Worth <strong>{upsetInfo.points}</strong> {upsetInfo.points === 1 ? 'point' : 'points'}! {upsetInfo.userCount}{' '}
									{upsetInfo.userCount === 1 ? 'player' : 'players'} nailed this upset pick.
								</Text>
							</Section>
						</Section>
					)}

					<Hr style={divider} />

					{/* CTA Button */}
					<Section style={buttonContainer}>
						<Button style={button} href={`${baseUrl}/dashboard`}>
							View Full Standings
						</Button>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<Text style={footerText}>
							You&apos;re receiving this because you&apos;re a member of {leagueName} on Pick 5.
						</Text>
						<Text style={footerText}>
							<Link href={`${baseUrl}/settings`} style={link}>
								Manage notification preferences
							</Link>
							{' · '}
							<Link href={`${baseUrl}/api/unsubscribe/${unsubscribeToken}`} style={link}>
								Unsubscribe
							</Link>
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

export default StandardScoreEmail;

// Styles
const main = {
	backgroundColor: '#0f0f0f',
	fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif'
};

const container = {
	backgroundColor: 'rgba(255, 255, 255, 0.05)',
	backdropFilter: 'blur(10px)',
	border: '1px solid rgba(255, 255, 255, 0.1)',
	borderRadius: '16px',
	margin: '40px auto',
	padding: '40px',
	maxWidth: '600px'
};

const logoSection = {
	textAlign: 'center' as const,
	marginBottom: '32px'
};

const logo = {
	margin: '0 auto'
};

const h1 = {
	color: '#5ec4ff',
	fontSize: '28px',
	fontWeight: 'bold',
	textAlign: 'center' as const,
	margin: '0 0 24px',
	lineHeight: '1.3'
};

const text = {
	color: '#f4f4f5',
	fontSize: '16px',
	lineHeight: '24px',
	margin: '16px 0'
};

const leagueNameText = {
	color: '#f4f4f5',
	fontSize: '18px',
	lineHeight: '24px',
	margin: '16px 0',
	textAlign: 'center' as const
};

const modeLabel = {
	color: '#a1a1aa',
	fontSize: '14px'
};

const scoreBox = {
	backgroundColor: 'rgba(94, 196, 255, 0.1)',
	border: '2px solid rgba(94, 196, 255, 0.4)',
	borderRadius: '12px',
	padding: '24px',
	margin: '24px 0',
	textAlign: 'center' as const
};

const scoreHeading = {
	color: '#5ec4ff',
	fontSize: '14px',
	fontWeight: 'bold',
	textTransform: 'uppercase' as const,
	letterSpacing: '1px',
	margin: '0 0 12px'
};

const scorePoints = {
	color: '#f4f4f5',
	fontSize: '48px',
	fontWeight: 'bold',
	lineHeight: '1',
	margin: '0'
};

const userPointsStyle = {
	color: '#5ec4ff'
};

const separator = {
	color: '#71717a',
	margin: '0 8px'
};

const maxPointsStyle = {
	color: '#a1a1aa'
};

const scoreSubtext = {
	color: '#a1a1aa',
	fontSize: '14px',
	margin: '8px 0 0'
};

const rankSection = {
	textAlign: 'center' as const,
	margin: '24px 0'
};

const rankText = {
	color: '#f4f4f5',
	fontSize: '18px',
	lineHeight: '28px',
	margin: '0'
};

const rankEmoji = {
	fontSize: '24px',
	marginRight: '8px'
};

const rankNumber = {
	color: '#5ec4ff',
	fontSize: '20px'
};

const leaderboardSection = {
	margin: '32px 0'
};

const leaderboardHeading = {
	color: '#f4f4f5',
	fontSize: '18px',
	fontWeight: 'bold',
	margin: '0 0 16px',
	textAlign: 'center' as const
};

const leaderboardBox = {
	backgroundColor: 'rgba(255, 255, 255, 0.03)',
	border: '1px solid rgba(255, 255, 255, 0.1)',
	borderRadius: '12px',
	padding: '16px'
};

const leaderboardItem = {
	display: 'flex',
	alignItems: 'center',
	padding: '12px 0',
	borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
};

const leaderboardRank = {
	color: '#5ec4ff',
	fontSize: '16px',
	fontWeight: 'bold',
	width: '40px'
};

const leaderboardName = {
	color: '#f4f4f5',
	fontSize: '16px',
	flex: '1'
};

const leaderboardPoints = {
	color: '#a1a1aa',
	fontSize: '14px',
	fontWeight: 'bold'
};

const upsetSection = {
	margin: '32px 0'
};

const upsetHeading = {
	color: '#f4f4f5',
	fontSize: '18px',
	fontWeight: 'bold',
	margin: '0 0 8px',
	textAlign: 'center' as const
};

const upsetText = {
	color: '#a1a1aa',
	fontSize: '14px',
	margin: '0 0 16px',
	textAlign: 'center' as const
};

const upsetBox = {
	backgroundColor: 'rgba(168, 85, 247, 0.1)',
	border: '1px solid rgba(168, 85, 247, 0.3)',
	borderRadius: '12px',
	padding: '20px',
	textAlign: 'center' as const
};

const upsetTeam = {
	color: '#c084fc',
	fontSize: '18px',
	fontWeight: 'bold',
	margin: '0 0 12px'
};

const upsetSubtext = {
	color: '#e5e5e5',
	fontSize: '14px',
	margin: '0'
};

const divider = {
	borderColor: 'rgba(255, 255, 255, 0.1)',
	margin: '32px 0'
};

const buttonContainer = {
	textAlign: 'center' as const,
	margin: '32px 0'
};

const button = {
	backgroundColor: '#5ec4ff',
	borderRadius: '8px',
	color: '#0f0f0f',
	fontSize: '16px',
	fontWeight: 'bold',
	textDecoration: 'none',
	textAlign: 'center' as const,
	display: 'inline-block',
	padding: '14px 32px',
	cursor: 'pointer'
};

const footer = {
	borderTop: '1px solid rgba(255, 255, 255, 0.1)',
	marginTop: '32px',
	paddingTop: '24px'
};

const footerText = {
	color: '#a1a1aa',
	fontSize: '14px',
	lineHeight: '20px',
	textAlign: 'center' as const,
	margin: '8px 0'
};

const link = {
	color: '#5ec4ff',
	textDecoration: 'underline'
};
