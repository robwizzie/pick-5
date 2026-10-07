import type { Metadata, Viewport } from 'next';
import { Inter, Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import { AnimatedBackground } from '@/components/ui/animated-background';
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

const SITE_URL = process.env.NEXTAUTH_URL || 'https://sportspick5.com';
const SITE_DESCRIPTION = 'The free weekly NFL pick’em for you and your friends. Pick five games, back the underdogs for bigger points, and climb your league’s leaderboard all season.';
const OG_IMAGE = { url: '/og-image.jpg', width: 1200, height: 630, alt: 'Pick 5 — Five picks. Every week. Bragging rights.' };

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: 'Pick 5 — The Weekly NFL Pick’em for Friends',
		template: '%s · Pick 5'
	},
	description: SITE_DESCRIPTION,
	keywords: ['NFL pick em', 'NFL picks', 'pick em league', 'football pool', 'weekly NFL picks', 'NFL pick em with friends', 'moneyline picks', 'Pick 5'],
	applicationName: 'Pick 5',
	category: 'sports',
	manifest: '/manifest.json',
	icons: {
		// app/favicon.ico is linked automatically
		icon: [
			{ url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
			{ url: '/icon-192.png', type: 'image/png', sizes: '192x192' }
		],
		apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }]
	},
	appleWebApp: { capable: true, title: 'Pick 5', statusBarStyle: 'black-translucent' },
	formatDetection: { telephone: false },
	openGraph: {
		type: 'website',
		siteName: 'Pick 5',
		locale: 'en_US',
		title: 'Pick 5 — Five picks. Every week. Bragging rights.',
		description: 'Pick five NFL games a week, back the underdogs for bigger points, and beat your friends all season. Free to play.',
		images: [OG_IMAGE]
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Pick 5 — Five picks. Every week. Bragging rights.',
		description: 'The free weekly NFL pick’em for you and your friends.',
		images: [OG_IMAGE]
	},
	robots: { index: true, follow: true }
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: '#07090e',
	colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en' className={`${sans.variable} ${display.variable} ${mono.variable}`}>
			<body>
				<AnimatedBackground />
				<SessionProviderWrapper>
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
