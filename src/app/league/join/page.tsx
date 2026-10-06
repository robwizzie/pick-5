'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/ui/page';
import { Spinner } from '@/components/ui/spinner';

export default function JoinLeaguePage() {
	const router = useRouter();

	useEffect(() => {
		// Joining now happens from the browse leagues page
		router.replace('/league/browse');
	}, [router]);

	return (
		<PageContainer size='narrow' className='flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center'>
			<Spinner label='Finding leagues…' />
		</PageContainer>
	);
}
