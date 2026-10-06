'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, LayoutDashboard, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer, Pill } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';

interface League {
	name: string;
	sport: string;
	mode: string;
	_id: string;
}

function SetupContent() {
	const searchParams = useSearchParams();
	const leagueId = searchParams?.get('id');
	const [league, setLeague] = useState<League | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchLeague = async () => {
			try {
				// Prefer the league id handed over by the create page; fall back to the most recent league.
				const response = await fetch(leagueId ? `/api/league/${leagueId}` : '/api/league/latest');
				if (response.ok) {
					const leagueData: League = await response.json();
					setLeague(leagueData);
				} else {
					setError('Failed to fetch league details.');
				}
			} catch {
				setError('An unexpected error occurred.');
			}
		};

		fetchLeague();
	}, [leagueId]);

	const isSteve = league?.mode === 'steve';

	return (
		<PageContainer size='narrow' className='flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center'>
			<div className='gradient-border glass w-full max-w-md animate-scale-in overflow-hidden rounded-3xl'>
				<div aria-hidden className='pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-accent/25 blur-3xl' />
				<div className='relative flex flex-col items-center px-6 pb-7 pt-9 text-center sm:px-8'>
					<div className='relative mb-5'>
						<div className='absolute inset-0 rounded-full bg-accent/30 blur-xl' />
						<div className='relative grid h-16 w-16 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent'>
							<CheckCircle2 className='h-8 w-8' />
						</div>
					</div>
					<p className='eyebrow mb-2'>League setup</p>
					<h1 className='display-heading text-4xl sm:text-5xl'>You&apos;re on the clock</h1>
					<p className='mt-3 text-sm text-muted-foreground'>Your league has been created. Invite your friends and start making picks.</p>

					{error && (
						<Alert variant='destructive' className='mt-6 text-left'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{!error && (
						<div className='mt-7 w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left'>
							{league ? (
								<div className='flex items-center gap-4'>
									<div className='relative h-14 w-12 shrink-0'>
										<Image src='/pick-5-logo-sm.webp' alt='' fill sizes='48px' className='object-contain' />
									</div>
									<div className='min-w-0 flex-1'>
										<p className='truncate font-display text-xl font-bold uppercase italic tracking-tight'>{league.name}</p>
										<div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
											<Pill tone='muted'>{league.sport}</Pill>
											<Pill tone={isSteve ? 'accent' : 'primary'}>{isSteve ? 'Steve Mode' : 'Standard Mode'}</Pill>
										</div>
									</div>
								</div>
							) : (
								<div className='flex items-center gap-4'>
									<Skeleton className='h-14 w-12 rounded-lg' />
									<div className='flex-1 space-y-2'>
										<Skeleton className='h-5 w-2/3' />
										<Skeleton className='h-4 w-1/2' />
									</div>
								</div>
							)}
						</div>
					)}

					<div className='mt-6 flex w-full flex-col gap-2'>
						{league && (
							<Button asChild size='lg' className='w-full'>
								<Link href={`/league/${league._id}`}>
									<Trophy /> View League <ArrowRight />
								</Link>
							</Button>
						)}
						<Button asChild size='lg' variant='outline' className='w-full'>
							<Link href='/dashboard'>
								<LayoutDashboard /> Go to Dashboard
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</PageContainer>
	);
}

export default function SetupPage() {
	return (
		<Suspense fallback={null}>
			<SetupContent />
		</Suspense>
	);
}
