'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AuthDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-sm'>
				<div className='flex justify-center pt-2'>
					<Image src='/pick-5-logo-sm.webp' alt='' width={72} height={82} className='drop-shadow-[0_8px_24px_rgba(56,214,255,0.4)]' />
				</div>
				<DialogHeader className='items-center pr-0 text-center'>
					<DialogTitle className='text-3xl'>Get in the game</DialogTitle>
					<DialogDescription>Sign in to make your picks and join your league.</DialogDescription>
				</DialogHeader>
				<Button size='lg' variant='outline' onClick={() => signIn('google', { callbackUrl: '/dashboard' })} className='w-full bg-white text-[#0b0d12] hover:bg-white/90'>
					<FcGoogle className='!size-5' />
					Continue with Google
				</Button>
			</DialogContent>
		</Dialog>
	);
}
