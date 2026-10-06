import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Global Leaderboard');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
