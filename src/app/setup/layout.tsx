import { privatePage } from '@/lib/seo';

export const metadata = privatePage('League Ready');

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
