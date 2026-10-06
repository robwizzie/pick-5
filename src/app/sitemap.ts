import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXTAUTH_URL || 'https://sportspick5.com';

// Everything else is behind sign-in, so the landing page is the only public page
export default function sitemap(): MetadataRoute.Sitemap {
	return [{ url: SITE_URL, changeFrequency: 'weekly', priority: 1 }];
}
