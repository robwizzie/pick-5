'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

export default function JoinLeaguePage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to the new browse leagues page
		router.push('/league/browse');
	}, [router]);

	return (
		<div className='min-h-screen flex items-center justify-center'>
			<Spinner />
		</div>
	);
}
