import { privatePage } from '@/lib/seo';

export const metadata = privatePage('My Stats');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
