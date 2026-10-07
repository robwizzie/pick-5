'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ADMIN_USER_ID } from '@/lib/constants';

export default function AdminShell({ children }: { children: React.ReactNode }) {
	const { data: session, status } = useSession();
	const pathname = usePathname();
	const isAdminHome = pathname === '/admin';
	const isAdmin = session?.user?.id === ADMIN_USER_ID;

	useEffect(() => {
		if (status === 'unauthenticated') {
			window.location.href = '/api/auth/signin';
		} else if (status === 'authenticated' && !isAdmin) {
			window.location.href = '/';
		}
	}, [status, isAdmin]);

	if (status === 'loading') {
		return (
			<div className='grid min-h-[60vh] place-items-center'>
				<Spinner label='Checking access…' />
			</div>
		);
	}

	if (!isAdmin) return null;

	return (
		<div className='min-h-screen bg-background'>
			<div className='border-b border-white/[0.07] bg-background/70 backdrop-blur-xl'>
				<div className='mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8'>
					<div className='flex min-w-0 items-center gap-3'>
						<span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary'>
							<ShieldCheck className='h-4 w-4' />
						</span>
						<div className='min-w-0'>
							<p className='font-display text-lg font-bold uppercase italic leading-none tracking-tight'>Admin Panel</p>
							<p className='eyebrow mt-1 truncate'>Pick 5 management tools</p>
						</div>
					</div>
					<Button asChild variant='ghost' size='sm'>
						<Link href={isAdminHome ? '/' : '/admin'}>
							<ArrowLeft />
							{isAdminHome ? 'Back to app' : 'Admin home'}
						</Link>
					</Button>
				</div>
			</div>
			{children}
		</div>
	);
}
