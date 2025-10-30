'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signIn, getSession } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trophy, Users, Target, Zap } from 'lucide-react';

export default function LoginPage() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const errorParam = searchParams.get('error');
		if (errorParam) {
			setError(`Authentication error: ${errorParam}`);
		}
	}, [searchParams]);

	const handleGoogleSignIn = async () => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await signIn('google', {
				callbackUrl: '/dashboard',
				redirect: false
			});

			if (result?.error) {
				setError(`Sign in failed: ${result.error}`);
			} else if (result?.ok) {
				// Force a session refresh
				await getSession();
				window.location.href = '/dashboard';
			}
		} catch (err) {
			setError('An unexpected error occurred during sign in');
			console.error('Sign in error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className='min-h-screen flex items-center justify-center p-4'>
			<div className='w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center'>
				{/* Left side - Hero content */}
				<div className='space-y-8 animate-fade-in'>
					<div className='space-y-6'>
						<div className='relative w-32 h-32 mx-auto lg:mx-0'>
							<Image src='/pick-5-logo.png' alt='NFL Pick 5' fill className='object-contain drop-shadow-2xl' priority />
						</div>
						<div className='text-center lg:text-left space-y-4'>
							<h1 className='text-5xl lg:text-6xl font-display font-bold gradient-text leading-tight'>PICK 5</h1>
							<p className='text-xl text-muted-foreground max-w-md mx-auto lg:mx-0'>The ultimate NFL fantasy experience. Make strategic picks, compete with friends, and dominate your league.</p>
						</div>
					</div>

					{/* Feature highlights */}
					<div className='grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0'>
						<div className='glass rounded-xl p-4 text-center space-y-2'>
							<Trophy className='h-8 w-8 text-accent mx-auto' />
							<p className='text-sm font-medium'>Compete</p>
						</div>
						<div className='glass rounded-xl p-4 text-center space-y-2'>
							<Users className='h-8 w-8 text-primary mx-auto' />
							<p className='text-sm font-medium'>Social</p>
						</div>
						<div className='glass rounded-xl p-4 text-center space-y-2'>
							<Target className='h-8 w-8 text-accent-2 mx-auto' />
							<p className='text-sm font-medium'>Strategic</p>
						</div>
						<div className='glass rounded-xl p-4 text-center space-y-2'>
							<Zap className='h-8 w-8 text-accent-3 mx-auto' />
							<p className='text-sm font-medium'>Fast</p>
						</div>
					</div>
				</div>

				{/* Right side - Login form */}
				<div className='w-full max-w-md mx-auto animate-slide-up'>
					<Card className='glass border-white/10 shadow-2xl'>
						<CardHeader className='text-center space-y-4 pb-8'>
							<CardTitle className='text-3xl font-display font-bold gradient-text'>Welcome Back</CardTitle>
							<CardDescription className='text-muted-foreground text-lg'>Sign in to access your leagues and make your picks</CardDescription>
						</CardHeader>
						<CardContent className='space-y-6'>
							{error && <div className='p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm'>{error}</div>}
							<Button variant='outline' onClick={handleGoogleSignIn} disabled={isLoading} size='lg' className='w-full h-14 glass border-white/20 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300 btn-hover group'>
								<div className='flex items-center justify-center space-x-3'>
									<FcGoogle className='w-6 h-6 group-hover:scale-110 transition-transform' />
									<span className='text-lg font-medium'>{isLoading ? 'Signing in...' : 'Continue with Google'}</span>
								</div>
							</Button>

							<div className='text-center'>
								<p className='text-sm text-muted-foreground'>By signing in, you agree to our terms of service and privacy policy</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
