'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { useRouter, useParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Compass, LayoutDashboard, Ticket, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, Pill } from '@/components/ui/page';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type JoinStatus = 'loading' | 'signin' | 'success' | 'error' | 'already_member';

export interface InvitePreview {
	name: string;
	members: number;
	mode: string;
}

interface JoinResponse {
	message?: string;
	error?: string;
	league?: { id: string; name: string };
}

export default function JoinInviteClient({ preview }: { preview: InvitePreview | null }) {
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
			if (preview) {
				setJoinStatus('signin');
			} else {
				setJoinStatus('error');
				setErrorMessage('This invite link isn’t valid');
			}
		} else if (status === 'authenticated') {
			handleJoinLeague();
		}
	}, [status, preview, handleJoinLeague]);

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
					{joinStatus === 'signin' && preview && (
						<>
							<div className='relative mb-6 h-[5.5rem] w-20'>
								<Image src='/pick-5-logo-sm.webp' alt='Pick 5' fill sizes='80px' className='object-contain' priority />
							</div>
							<p className='eyebrow mb-3 flex items-center gap-2'>
								<Ticket className='h-3.5 w-3.5 text-primary' /> You&apos;re invited to
							</p>
							<h1 className='display-heading break-words text-4xl sm:text-5xl'>
								<span className='gradient-text'>{preview.name}</span>
							</h1>
							<div className='mt-4 flex flex-wrap justify-center gap-2'>
								<Pill tone={preview.mode === 'steve' ? 'accent' : 'primary'}>{preview.mode === 'steve' ? 'Steve mode' : 'Standard'}</Pill>
								<Pill>
									<Users className='h-3 w-3' /> {preview.members} {preview.members === 1 ? 'player' : 'players'}
								</Pill>
							</div>
							<p className='mt-4 text-sm text-muted-foreground'>Pick five NFL games a week, back the underdogs for bigger points, and climb the standings. Free to play.</p>
							<Button
								size='xl'
								onClick={() => signIn('google', { callbackUrl: `/league/join/${inviteCode}` })}
								className='mt-7 w-full bg-white text-[#0b0d12] shadow-[0_12px_40px_-12px_rgba(255,255,255,0.45)] hover:bg-white hover:brightness-100'
							>
								<FcGoogle className='!size-5' /> Continue with Google
							</Button>
							<p className='mt-3 text-xs text-muted-foreground'>You’ll join the league as soon as you sign in.</p>
						</>
					)}

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
