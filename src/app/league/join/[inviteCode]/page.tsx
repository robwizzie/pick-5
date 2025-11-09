'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

interface JoinInvitePageProps {
	params: Promise<{ inviteCode: string }>;
}

export default function JoinInvitePage({ params }: JoinInvitePageProps) {
	// Always call use() - React hooks can't be conditional
	const resolvedParams = use(params);
	const inviteCode = resolvedParams?.inviteCode || '';
	const router = useRouter();
	const { status } = useSession();
	const [joinStatus, setJoinStatus] = useState<'loading' | 'success' | 'error' | 'already_member'>('loading');
	const [leagueName, setLeagueName] = useState('');
	const [leagueId, setLeagueId] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const handleJoinLeague = useCallback(async () => {
		if (!inviteCode) {
			setJoinStatus('error');
			setErrorMessage('Invalid invite code');
			return;
		}

		try {
			setJoinStatus('loading');

			const response = await fetch('/api/league/join-by-invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ inviteCode })
			});

			const data = await response.json();

			if (!response.ok) {
				setJoinStatus('error');
				setErrorMessage(data.error || 'Failed to join league');
				return;
			}

			setLeagueName(data.league.name);
			setLeagueId(data.league.id);

			// Check if user was already a member
			if (data.message === 'Already a member') {
				setJoinStatus('already_member');
			} else {
				setJoinStatus('success');
			}
		} catch (error) {
			console.error('Error joining league:', error);
			setJoinStatus('error');
			setErrorMessage('An unexpected error occurred');
		}
	}, [inviteCode]);

	useEffect(() => {
		if (status === 'unauthenticated') {
			// Store the invite code in sessionStorage so we can join after login
			sessionStorage.setItem('pendingInviteCode', inviteCode);
			router.push('/login');
		} else if (status === 'authenticated') {
			handleJoinLeague();
		}
	}, [status, inviteCode, router, handleJoinLeague]);

	if (status === 'loading' || joinStatus === 'loading') {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='text-center space-y-4'>
					<Spinner />
					<p className='text-lg text-muted-foreground'>Joining league...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen flex items-center justify-center p-4'>
			<Card className='glass border-white/10 max-w-md w-full'>
				<CardContent className='p-8'>
					{joinStatus === 'success' && (
						<div className='text-center space-y-6'>
							<div className='flex justify-center'>
								<CheckCircle2 className='h-16 w-16 text-green-500' />
							</div>
							<div className='space-y-2'>
								<h1 className='text-2xl font-bold text-foreground'>Welcome to the League!</h1>
								<p className='text-muted-foreground'>
									You&apos;ve successfully joined <span className='text-primary font-semibold'>{leagueName}</span>
								</p>
							</div>
							<Button onClick={() => router.push(`/league/${leagueId}`)} className='w-full bg-primary hover:bg-primary/90 text-lg py-6'>
								Go to League
							</Button>
						</div>
					)}

					{joinStatus === 'already_member' && (
						<div className='text-center space-y-6'>
							<div className='flex justify-center'>
								<CheckCircle2 className='h-16 w-16 text-primary' />
							</div>
							<div className='space-y-2'>
								<h1 className='text-2xl font-bold text-foreground'>You&apos;re Already In!</h1>
								<p className='text-muted-foreground'>
									You&apos;re already a member of <span className='text-primary font-semibold'>{leagueName}</span>
								</p>
							</div>
							<Button onClick={() => router.push(`/league/${leagueId}`)} className='w-full bg-primary hover:bg-primary/90 text-lg py-6'>
								Go to League
							</Button>
						</div>
					)}

					{joinStatus === 'error' && (
						<div className='text-center space-y-6'>
							<div className='flex justify-center'>
								<XCircle className='h-16 w-16 text-red-500' />
							</div>
							<div className='space-y-2'>
								<h1 className='text-2xl font-bold text-foreground'>Unable to Join League</h1>
								<p className='text-red-500'>{errorMessage}</p>
								<p className='text-sm text-muted-foreground'>The invite link may be invalid or expired.</p>
							</div>
							<div className='flex gap-2'>
								<Button onClick={() => router.push('/dashboard')} variant='outline' className='flex-1'>
									Go to Dashboard
								</Button>
								<Button onClick={() => router.push('/league/browse')} className='flex-1 bg-primary hover:bg-primary/90'>
									Browse Leagues
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
