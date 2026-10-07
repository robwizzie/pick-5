import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
