'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoginPage from './login/page';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [isRedirecting, setIsRedirecting] = useState(false);

	useEffect(() => {
		if (status === 'loading') return;

		if (session && !isRedirecting) {
			setIsRedirecting(true);
			router.replace('/dashboard');
		}
	}, [status, session, router, isRedirecting]);

	if (status === 'loading') {
		return (
			<div className='min-h-screen flex items-center justify-center animated-bg'>
				<div className='text-center space-y-4'>
					<div className='w-16 h-16 mx-auto'>
						<Spinner />
					</div>
					<p className='text-muted-foreground'>Loading...</p>
				</div>
			</div>
		);
	}

	if (isRedirecting) {
		return (
			<div className='min-h-screen flex items-center justify-center animated-bg'>
				<div className='text-center space-y-4'>
					<div className='w-16 h-16 mx-auto'>
						<Spinner />
					</div>
					<p className='text-muted-foreground'>Redirecting to dashboard...</p>
				</div>
			</div>
		);
	}

	return <LoginPage />;
}
