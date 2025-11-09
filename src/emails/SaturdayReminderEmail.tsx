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
	Text
} from '@react-email/components';
import * as React from 'react';

interface SaturdayReminderEmailProps {
	userName: string;
	leagues: Array<{
		id: string;
		name: string;
		mode: string;
	}>;
	unsubscribeToken: string;
}

export const SaturdayReminderEmail = ({
	userName = 'Player',
	leagues = [],
	unsubscribeToken = 'token'
}: SaturdayReminderEmailProps) => {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.sportspick5.com';

	return (
		<Html>
			<Head />
			<Preview>Last chance! Get your Pick 5 picks in before Sunday&apos;s games!</Preview>
			<Body style={main}>
				<Container style={container}>
					{/* Logo */}
					<Section style={logoSection}>
						<Img src={`${baseUrl}/pick-5-logo.png`} width='100' height='100' alt='Pick 5 Logo' style={logo} />
					</Section>

					{/* Heading */}
					<Heading style={h1}>Last Chance for Pick 5! ⏰</Heading>

					{/* Greeting */}
					<Text style={text}>Hey {userName},</Text>

					{/* Main Message */}
					<Text style={text}>
						<strong>Sunday&apos;s NFL games start tomorrow!</strong> You still haven&apos;t submitted your picks for the following
						league{leagues.length > 1 ? 's' : ''}:
					</Text>

					{/* Leagues List */}
					<Section style={leaguesBox}>
						{leagues.map((league, index) => (
							<div key={league.id} style={leagueItem}>
								<Text style={leagueName}>
									<span style={bullet}>•</span> {league.name}
									<span style={leagueMode}> ({league.mode === 'steve' ? 'Steve Mode' : 'Standard Mode'})</span>
								</Text>
							</div>
						))}
					</Section>

					<Text style={text}>
						Don&apos;t miss out on this week&apos;s competition! Make your picks now before the Sunday 1 PM ET games kick off.
					</Text>

					{/* CTA Button */}
					<Section style={buttonContainer}>
						<Button style={button} href={`${baseUrl}/dashboard`}>
							Make Your Picks Now
						</Button>
					</Section>

					{/* Footer */}
					<Section style={footer}>
						<Text style={footerText}>
							You&apos;re receiving this because you have pick reminders enabled for your Pick 5 leagues.
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

export default SaturdayReminderEmail;

// Styles (matching Thursday email)
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
	color: '#e879f9',
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

const leaguesBox = {
	backgroundColor: 'rgba(232, 121, 249, 0.1)',
	border: '1px solid rgba(232, 121, 249, 0.2)',
	borderRadius: '12px',
	padding: '20px',
	margin: '24px 0'
};

const leagueItem = {
	marginBottom: '8px'
};

const leagueName = {
	color: '#f4f4f5',
	fontSize: '16px',
	margin: '0',
	lineHeight: '24px'
};

const bullet = {
	color: '#e879f9',
	marginRight: '8px'
};

const leagueMode = {
	color: '#a1a1aa',
	fontSize: '14px'
};

const buttonContainer = {
	textAlign: 'center' as const,
	margin: '32px 0'
};

const button = {
	backgroundColor: '#e879f9',
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
	color: '#e879f9',
	textDecoration: 'underline'
};
