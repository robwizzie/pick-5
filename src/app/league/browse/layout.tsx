import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Browse Leagues');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
