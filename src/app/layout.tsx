import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import '../styles/globals.css';

const interFont = Inter({
	variable: '--font-inter',
	subsets: ['latin']
});

const robotoMonoFont = Roboto_Mono({
	variable: '--font-roboto-mono',
	subsets: ['latin']
});

export const metadata: Metadata = {
	title: 'Pick 5 App',
	description: 'Manage your Pick 5 leagues and games'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body className={`${interFont.variable} ${robotoMonoFont.variable} antialiased`}>
				<SessionProviderWrapper>
					<StatsProvider>
						<WeekProvider>
							<LeagueProvider>
								<div className='min-h-screen bg-gradient-to-br from-primary/10 to-primary/30'>
									<Nav />
									<main className='container mx-auto'>{children}</main>
								</div>
							</LeagueProvider>
						</WeekProvider>
					</StatsProvider>
				</SessionProviderWrapper>
			</body>
		</html>
	);
}
