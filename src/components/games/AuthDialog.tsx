// src/components/games/AuthDialog.tsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';

interface AuthDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>Sign in to NFL Pick 5</DialogTitle>
					<DialogDescription>Choose your preferred sign in method below.</DialogDescription>
				</DialogHeader>
				<div className='grid gap-4 py-4'>
					<Button variant='outline' onClick={() => signIn('google', { callbackUrl: '/' })} className='flex items-center justify-center gap-2'>
						<FcGoogle className='w-5 h-5' />
						Continue with Google
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
