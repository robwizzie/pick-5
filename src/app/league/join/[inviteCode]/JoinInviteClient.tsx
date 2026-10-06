'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Compass, LayoutDashboard, Ticket, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, Pill } from '@/components/ui/page';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type JoinStatus = 'loading' | 'success' | 'error' | 'already_member';

interface JoinResponse {
	message?: string;
	error?: string;
	league?: { id: string; name: string };
}

export default function JoinInvitePage() {
	const params = useParams();
	const inviteCode = (params?.inviteCode as string) || '';
	const router = useRouter();
	const { status } = useSession();
	const [joinStatus, setJoinStatus] = useState<JoinStatus>('loading');
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

			const data: JoinResponse = await response.json();

			if (!response.ok || !data.league) {
				setJoinStatus('error');
				setErrorMessage(data.error || 'Failed to join league');
				return;
			}

			setLeagueName(data.league.name);
			setLeagueId(data.league.id);
			setJoinStatus(data.message === 'Already a member' ? 'already_member' : 'success');
		} catch (error) {
			console.error('Error joining league:', error);
			setJoinStatus('error');
			setErrorMessage('An unexpected error occurred');
		}
	}, [inviteCode]);

	useEffect(() => {
		if (status === 'unauthenticated') {
			// Store the invite code in sessionStorage so we can join after login
			try {
				sessionStorage.setItem('pendingInviteCode', inviteCode);
			} catch {
				// Storage can be unavailable (private mode); login still proceeds
			}
			router.push('/login');
		} else if (status === 'authenticated') {
			handleJoinLeague();
		}
	}, [status, inviteCode, router, handleJoinLeague]);

	const isLoading = status === 'loading' || joinStatus === 'loading';
	const isError = !isLoading && joinStatus === 'error';
	const joined = !isLoading && (joinStatus === 'success' || joinStatus === 'already_member');

	return (
		<PageContainer size='narrow' className='flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center'>
			<div className={cn('glass relative w-full max-w-md animate-scale-in overflow-hidden rounded-3xl', joined && 'gradient-border')}>
				<div
					aria-hidden
					className={cn('pointer-events-none absolute inset-x-0 -top-28 mx-auto h-56 w-56 rounded-full blur-3xl', isError ? 'bg-destructive/20' : joined ? 'bg-accent/20' : 'bg-primary/25')}
				/>

				<div className='relative flex flex-col items-center px-6 pb-7 pt-9 text-center sm:px-8'>
					{isLoading && (
						<>
							<div className='relative mb-6 h-[5.5rem] w-20'>
								<Image src='/pick-5-logo-sm.webp' alt='Pick 5' fill sizes='80px' className='object-contain' priority />
							</div>
							<p className='eyebrow mb-2 flex items-center gap-2'>
								<Ticket className='h-3.5 w-3.5 text-primary' /> League invitation
							</p>
							<h1 className='display-heading text-4xl'>You&apos;re invited</h1>
							<Spinner label='Accepting your invite…' className='mt-8' />
						</>
					)}

					{joined && (
						<>
							<div className='relative mb-5'>
								<div className='absolute inset-0 rounded-full bg-accent/30 blur-xl' />
								<div className='relative grid h-16 w-16 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent'>
									<CheckCircle2 className='h-8 w-8' />
								</div>
							</div>
							<p className='eyebrow mb-3 flex items-center gap-2'>
								<Ticket className='h-3.5 w-3.5 text-primary' /> You&apos;re invited to
							</p>
							<h1 className='display-heading break-words text-4xl sm:text-5xl'>
								<span className='gradient-text'>{leagueName}</span>
							</h1>
							<div className='mt-4'>
								{joinStatus === 'success' ? <Pill tone='accent'>Invite accepted</Pill> : <Pill tone='primary'>Already a member</Pill>}
							</div>
							<p className='mt-4 text-sm text-muted-foreground'>
								{joinStatus === 'success'
									? 'Welcome to the league! Make your 5 picks each week and climb the standings.'
									: 'You’re already on the roster for this league. Jump back in.'}
							</p>
							<Button size='xl' variant='gradient' className='mt-7 w-full' onClick={() => router.push(`/league/${leagueId}`)}>
								Go to League <ArrowRight />
							</Button>
						</>
					)}

					{isError && (
						<>
							<div className='relative mb-5'>
								<div className='absolute inset-0 rounded-full bg-destructive/25 blur-xl' />
								<div className='relative grid h-16 w-16 place-items-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive'>
									<XCircle className='h-8 w-8' />
								</div>
							</div>
							<p className='eyebrow mb-2'>League invitation</p>
							<h1 className='display-heading text-4xl'>Unable to join</h1>
							<p className='mt-3 text-sm font-medium text-destructive'>{errorMessage}</p>
							<p className='mt-1 text-sm text-muted-foreground'>The invite link may be invalid or expired. Ask your commissioner for a fresh link.</p>
							<div className='mt-7 grid w-full gap-2 sm:grid-cols-2'>
								<Button asChild variant='outline' size='lg' className='w-full'>
									<Link href='/dashboard'>
										<LayoutDashboard /> Dashboard
									</Link>
								</Button>
								<Button asChild size='lg' className='w-full'>
									<Link href='/league/browse'>
										<Compass /> Browse Leagues
									</Link>
								</Button>
							</div>
						</>
					)}
				</div>
			</div>
		</PageContainer>
	);
}
