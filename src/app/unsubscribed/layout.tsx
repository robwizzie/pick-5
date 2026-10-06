import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Unsubscribed');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
