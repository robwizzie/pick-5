import type { Metadata, Viewport } from 'next';
import { Inter, Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { GameNotificationPoller } from '@/components/notifications/GameNotificationPoller';
import { Toaster } from 'sonner';
import '../styles/globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Barlow_Condensed({
	subsets: ['latin'],
	weight: ['500', '600', '700', '800', '900'],
	style: ['normal', 'italic'],
	variable: '--font-display',
	display: 'swap'
});
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://sportspick5.com'),
	title: {
		default: 'Pick 5 — Five picks. Every week. Bragging rights.',
		template: '%s · Pick 5'
	},
	description: 'The weekly NFL pick’em for you and your crew. Pick five games, back the underdogs for bigger points, and climb your league leaderboard.',
	keywords: ['NFL', 'pick em', 'Pick 5', 'football', 'league', 'picks', 'underdogs'],
	applicationName: 'Pick 5',
	manifest: '/manifest.json',
	icons: { icon: '/favicon.ico', apple: '/icon-512.png' },
	appleWebApp: { capable: true, title: 'Pick 5', statusBarStyle: 'black-translucent' },
	openGraph: {
		title: 'Pick 5 — The weekly NFL pick’em',
		description: 'Pick five games. Back the underdogs. Beat your friends.',
		type: 'website',
		locale: 'en_US',
		images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Pick 5' }]
	},
	twitter: { card: 'summary_large_image', images: ['/og-image.jpg'] }
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: '#07090e'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' className={`${sans.variable} ${display.variable} ${mono.variable}`}>
			<body>
				<AnimatedBackground />
				<SessionProviderWrapper>
					<GameNotificationPoller />
					<StatsProvider>
						<WeekProvider>
							<LeagueProvider>
								<div className='relative flex min-h-dvh flex-col pt-safe'>
									<Nav />
									<main className='relative z-10 flex-1'>{children}</main>
								</div>
							</LeagueProvider>
						</WeekProvider>
					</StatsProvider>
				</SessionProviderWrapper>
				<Toaster
					theme='dark'
					position='top-center'
					toastOptions={{
						classNames: {
							toast: '!bg-[hsl(var(--surface-raised))] !border !border-white/10 !text-foreground !rounded-xl !shadow-2xl',
							description: '!text-muted-foreground'
						}
					}}
				/>
			</body>
		</html>
	);
}
