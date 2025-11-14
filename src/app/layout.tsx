import type { Metadata } from 'next';
import SessionProviderWrapper from '@/components/providers/SessionProviderWrapper';
import { StatsProvider } from '@/contexts/StatsContext';
import { WeekProvider } from '@/contexts/WeekContext';
import { LeagueProvider } from '@/contexts/LeagueContext';
import { Nav } from '@/components/games/Nav';
import { AnimatedBackground } from '@/components/ui/animated-background';
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
				<meta name='apple-mobile-web-app-status-bar-style' content='black-translucent' />
				<link rel='apple-touch-icon' href='/icon-512.png' />

				{/* iOS Splash Screens */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 14 Pro Max, 15 Pro Max */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 14 Pro, 15 Pro */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 14 Plus, 15 Plus */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 14, 13 Pro, 12 Pro */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 13 mini, 12 mini, 11 Pro, X, XS */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 11 Pro Max, XS Max */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPhone 11, XR */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' /> {/* iPhone 8 Plus, 7 Plus, 6s Plus */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPhone SE, 8, 7, 6s */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPhone SE 1st gen, 5s */}

				{/* iPad Splash Screens */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPad Pro 12.9" */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPad Pro 11" */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPad Air */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPad 10.2" */}
				<link rel='apple-touch-startup-image' href='/pick-5-logo-background.png' media='(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)' /> {/* iPad Mini, iPad */}
			</head>
			<body className='font-sans antialiased' style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', backgroundColor: '#141414' }}>
				<AnimatedBackground />
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
