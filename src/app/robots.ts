import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://sportspick5.com';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: ['/', '/league/join/'],
				disallow: ['/api/', '/admin', '/dashboard', '/league/', '/settings', '/stats', '/leaderboard', '/setup', '/unsubscribed']
			}
		],
		sitemap: `${SITE_URL}/sitemap.xml`
	};
}
