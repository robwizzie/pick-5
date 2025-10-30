import type { Metadata } from 'next';
import { Inter, Oswald } from 'next/font/google';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import '../styles/globals.css';

const interFont = Inter({
	variable: '--font-inter',
	subsets: ['latin'],
	display: 'swap'
});

const oswaldFont = Oswald({
	variable: '--font-oswald',
	subsets: ['latin'],
	display: 'swap'
});

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
	themeColor: '#0066ff'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' className={`${interFont.variable} ${oswaldFont.variable}`}>
			<body className='font-sans antialiased'>
				<SessionProviderWrapper>
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
