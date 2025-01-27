'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import Image from 'next/image';

export default function LoginPage() {
	return (
		<div className='flex flex-col items-center justify-center h-[calc(100vh-4rem)]'>
			<div className='mb-8 text-center relative'>
				<div className='relative w-40 h-40 mx-auto'>
					<Image src='/pick-5-logo.png' alt='NFL Pick 5' fill className='object-contain' priority />
				</div>
				<h1 className='font-oswald text-2xl uppercase text-primary tracking-wide mt-4'>Welcome to NFL Pick 5</h1>
			</div>

			<Card className='w-[425px] border-2 border-primary/20 shadow-lg bg-card/95'>
				<CardHeader className='text-center'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Sign In</CardTitle>
					<CardDescription className='text-primary/80'>Make your picks and compete with friends</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant='outline' onClick={() => signIn('google', { callbackUrl: '/' })} className='w-full flex items-center justify-center gap-2 bg-background border-2 border-primary/20 text-primary hover:bg-primary/10 transition-colors'>
						<FcGoogle className='w-5 h-5' />
						Continue with Google
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
