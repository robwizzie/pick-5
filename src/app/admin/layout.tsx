import { privatePage } from '@/lib/seo';
import AdminShell from './AdminShell';

export const metadata = privatePage('Admin');

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	return <AdminShell>{children}</AdminShell>;
}
