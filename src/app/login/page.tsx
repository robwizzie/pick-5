import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Landing } from '@/components/landing/Landing';

export const metadata: Metadata = {
	title: 'Sign in',
	alternates: { canonical: '/' },
	robots: { index: false, follow: true }
};

/**
 * Reduce the callback to a same-site path. The auth middleware sends an absolute
 * URL, so keep only its path + query; that can never redirect off-site.
 */
function safeCallback(url: string | undefined): string {
	if (!url) return '/dashboard';
	try {
		const { pathname, search } = new URL(url, 'http://local');
		return pathname.startsWith('/') && !pathname.startsWith('//') ? `${pathname}${search}` : '/dashboard';
	} catch {
		return '/dashboard';
	}
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
	const { error, callbackUrl } = await searchParams;
	const target = safeCallback(callbackUrl);

	const session = await getServerSession(authOptions);
	if (session && !error) redirect(target);

	return <Landing error={error} callbackUrl={target} />;
}
