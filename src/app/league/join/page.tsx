'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, LogIn, Eye, EyeOff } from 'lucide-react';

export default function JoinLeaguePage() {
	const router = useRouter();
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleJoinLeague = async () => {
		if (!password) {
			setError('Please enter the league password');
			return;
		}

		try {
			const response = await fetch('/api/league/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }) // Only send the password
			});

			if (response.ok) {
				router.push('/dashboard');
			} else {
				const errorData = await response.json();
				setError(errorData.error || 'Failed to join league');
			}
		} catch (err) {
			setError('An unexpected error occurred');
			console.error(err);
		}
	};

	return (
		<div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
			<Card className='w-[400px] p-6'>
				<CardHeader className='relative'>
					<Button variant='ghost' size='icon' className='absolute top-0 left-0 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={() => router.push('/dashboard')}>
						<ArrowLeft className='w-5 h-5' />
					</Button>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary text-center'>Join a League</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<div className='relative'>
						<Input type={showPassword ? 'text' : 'password'} placeholder='Enter League Password' value={password} onChange={e => setPassword(e.target.value)} />
						<Button variant='ghost' size='icon' className='absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={() => setShowPassword(!showPassword)}>
							{showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
						</Button>
					</div>
					<Button variant='success' onClick={handleJoinLeague} className='w-full flex items-center justify-center text-black gap-2'>
						<LogIn className='w-4 h-4' /> Join League
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
