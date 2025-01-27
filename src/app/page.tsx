'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoginPage from './login/page';
import { Spinner } from '@/components/ui/spinner';

export default function HomePage() {
	const { data: session, status } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (status === 'loading') return;

		if (session) {
			router.replace('/dashboard');
		}
	}, [status, session, router]);

	if (status === 'loading') {
		return (
			<div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
				<Spinner />
			</div>
		);
	}

	return <LoginPage />;
}
