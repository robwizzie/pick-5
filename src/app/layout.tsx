import type { Metadata } from 'next';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { GameNotificationPoller } from '@/components/notifications/GameNotificationPoller';
import '../styles/globals.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

export const metadata: Metadata = {
	title: 'Pick 5 - NFL Fantasy League',
	description: 'The ultimate NFL Pick 5 fantasy experience. Compete with friends, make strategic picks, and dominate your league.',
	keywords: ['NFL', 'Fantasy', 'Pick 5', 'Football', 'League', 'Competition'],
	authors: [{ name: 'Pick 5 Team' }],
	openGraph: {
		title: 'Pick 5 - NFL Fantasy League',
		description: 'The ultimate NFL Pick 5 fantasy experience',
		type: 'website',
		locale: 'en_US'
	}
};

export const viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	viewportFit: 'cover',
	themeColor: '#141414' // Match the background color (hsl(0 0% 8%) = #141414)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' style={{ backgroundColor: '#141414' }}>
			<head>
				<link rel='preconnect' href='https://fonts.googleapis.com' />
				<link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
				<link href='https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Oswald:wght@200..700&display=swap' rel='stylesheet' />
				<link rel='manifest' href='/manifest.json' />
				<meta name='apple-mobile-web-app-capable' content='yes' />
				<meta name='apple-mobile-web-app-status-bar-style' content='black' />
				<meta name='apple-mobile-web-app-title' content='Pick 5' />
				<link rel='apple-touch-icon' href='/icon-512.png' />
			</head>
			<body className='font-sans antialiased' style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', backgroundColor: '#141414' }}>
				<AnimatedBackground />
				<SessionProviderWrapper>
					<GameNotificationPoller />
					<StatsProvider>
						<WeekProvider>
							<LeagueProvider>
								<div className='min-h-screen animated-bg'>
									<Nav />
									<main className='relative z-10'>{children}</main>
								</div>
							</LeagueProvider>
						</WeekProvider>
					</StatsProvider>
				</SessionProviderWrapper>
			</body>
		</html>
	);
}
