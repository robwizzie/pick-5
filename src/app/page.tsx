import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Landing } from '@/components/landing/Landing';

export const metadata: Metadata = {
	alternates: { canonical: '/' }
};

const SITE_URL = process.env.NEXTAUTH_URL || 'https://sportspick5.com';

// Structured data so search engines understand what Pick 5 is
const jsonLd = {
	'@context': 'https://schema.org',
	'@type': 'WebApplication',
	name: 'Pick 5',
	url: SITE_URL,
	applicationCategory: 'GameApplication',
	operatingSystem: 'Any',
	description: 'The free weekly NFL pick’em for you and your friends. Pick five games, back the underdogs for bigger points, and climb your league’s leaderboard all season.',
	image: `${SITE_URL}/og-image.jpg`,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
};

export default async function HomePage() {
	const session = await getServerSession(authOptions);
	if (session) redirect('/dashboard');
	return (
		<>
			<script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			<Landing />
		</>
	);
}
