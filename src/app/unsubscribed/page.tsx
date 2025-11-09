'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UnsubscribedPage() {
	const router = useRouter();

	return (
		<div className='min-h-screen flex items-center justify-center p-4'>
			<Card className='glass border-white/10 max-w-md w-full'>
				<CardContent className='p-8'>
					<div className='text-center space-y-6'>
						<div className='flex justify-center'>
							<CheckCircle2 className='h-16 w-16 text-primary' />
						</div>
						<div className='space-y-2'>
							<h1 className='text-2xl font-bold text-foreground'>You&apos;ve Been Unsubscribed</h1>
							<p className='text-muted-foreground'>
								You won&apos;t receive any more pick reminder emails from us.
							</p>
							<p className='text-sm text-muted-foreground'>
								You can always re-enable email reminders in your settings if you change your mind.
							</p>
						</div>
						<div className='flex gap-2'>
							<Button onClick={() => router.push('/settings')} variant='outline' className='flex-1'>
								Go to Settings
							</Button>
							<Button onClick={() => router.push('/dashboard')} className='flex-1 bg-primary hover:bg-primary/90'>
								Go to Dashboard
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
