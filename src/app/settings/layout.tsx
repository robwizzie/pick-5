import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Settings');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
