'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, LogIn } from 'lucide-react';
import Image from 'next/image';

export default function JoinOrCreate() {
	const router = useRouter();

	return (
		<div className='max-w-7xl mx-auto px-4'>
			<Card className='mb-8 bg-card border-2 border-primary/20 shadow-lg'>
				<div className='flex flex-col items-center mt-3 mb-3'>
					<Image src='/pick-5-logo.png' alt='Pick 5 Logo' width={128} height={128} />
				</div>
				<CardContent>
					<p className='text-center text-muted-foreground font-medium'>Choose how you want to get started</p>
				</CardContent>
			</Card>
			<Card className='w-full max-w-md mx-auto'>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary text-center'>Get Started</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<Button className='w-full flex items-center justify-center gap-2' onClick={() => router.push('/league/create')}>
						<PlusCircle /> Create a League
					</Button>
					<Button variant='success' className='w-full flex items-center justify-center text-black gap-2' onClick={() => router.push('/league/join')}>
						<LogIn /> Join a League
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
