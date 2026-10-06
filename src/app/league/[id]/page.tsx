'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ArrowLeft, BarChart3, BookOpen, Check, Copy, Gamepad2, History, LogOut, Radio, Settings, Share2, Sparkles, TrendingUp, Trophy, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Pill } from '@/components/ui/page';
import { WeeklyPicks } from '@/components/games/WeeklyPicks';
import { Results } from '@/components/games/Results';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Recap } from '@/components/games/Recap';
import LeagueStats from '@/components/league/LeagueStats';
import { LeagueRulesDialog } from '@/components/league/LeagueRulesDialog';
import { LeagueSettingsDialog } from '@/components/league/LeagueSettingsDialog';
import { SweatView } from '@/components/league/SweatView';
import { useWeekLiveStatus } from '@/components/sweat/useSweat';
import { useWeek } from '@/contexts/WeekContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

interface League {
	name: string;
	sport: string;
	mode: string;
	creatorId?: string;
	members?: string[];
}

type MobileView = 'live' | 'picks' | 'results' | 'leaderboard' | 'stats' | 'recap';
type DesktopTab = 'live' | 'picks' | 'results' | 'recap';

const RECAP_POLL_MS = 120_000;

export default function LeagueDetails() {
	const params = useParams();
	const id = (params?.id as string) || '';
	const router = useRouter();
	const searchParams = useSearchParams();
	// Deep link from the dashboard's live banner: /league/{id}?view=live
	const wantsLive = searchParams?.get('view') === 'live';
	const { data: session } = useSession();
	const { currentWeek, liveWeek } = useWeek();
	// Mount only one layout so data components don't fetch and poll twice
	const isDesktop = useMediaQuery('(min-width: 1024px)');

	const [league, setLeague] = useState<League | null>(null);
	const [mobileView, setMobileView] = useState<MobileView>(wantsLive ? 'live' : 'picks');
	const [desktopTab, setDesktopTab] = useState<DesktopTab>(wantsLive ? 'live' : 'picks');
	const liveStatus = useWeekLiveStatus(currentWeek);
	// The Live view exists while the viewed week's slate is underway (or when deep-linked)
	const showLive = wantsLive || !!liveStatus?.sweatable;
	// Open on Live once per page load when games are in progress — unless the user already chose a view
	const autoView = useRef(wantsLive);
	const [recapWeek, setRecapWeek] = useState<number | null>(null);

	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteUrl, setInviteUrl] = useState('');
	const [inviteLoading, setInviteLoading] = useState(false);
	const [copied, setCopied] = useState(false);
	const [rulesOpen, setRulesOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/league/${id}`)
			.then(res => (res.ok ? res.json() : Promise.reject()))
			.then((data: League) => !cancelled && setLeague(data))
			.catch(() => router.replace('/dashboard'));
		return () => {
			cancelled = true;
		};
	}, [id, router]);

	// Offer "Last week's recap" while viewing the live week, once last week is complete
	useEffect(() => {
		if (!id || !liveWeek || currentWeek !== liveWeek || currentWeek <= 1) {
			setRecapWeek(null);
			return;
		}
		const previousWeek = currentWeek - 1;
		const check = async () => {
			try {
				const res = await fetch(`/api/recap?week=${previousWeek}&leagueId=${id}`, { cache: 'no-store' });
				const data = res.ok ? await res.json() : null;
				setRecapWeek(data?.hasPicks && data?.weekCompleted ? previousWeek : null);
			} catch {
				setRecapWeek(null);
			}
		};
		check();
		const interval = setInterval(check, RECAP_POLL_MS);
		return () => clearInterval(interval);
	}, [id, currentWeek, liveWeek]);

	// Don't strand the mobile view on a tab that disappeared
	useEffect(() => {
		if (!recapWeek && mobileView === 'recap') setMobileView('picks');
	}, [recapWeek, mobileView]);

	useEffect(() => {
		if (!liveStatus || autoView.current) return;
		autoView.current = true;
		if (liveStatus.liveGames > 0) {
			setMobileView('live');
			setDesktopTab('live');
		}
	}, [liveStatus]);

	// Live went away (slate finished, or the user changed weeks): fall back to Results
	useEffect(() => {
		if (!liveStatus || showLive) return;
		setMobileView(view => (view === 'live' ? 'results' : view));
		setDesktopTab(tab => (tab === 'live' ? 'results' : tab));
	}, [liveStatus, showLive]);

	const chooseMobileView = (view: MobileView) => {
		autoView.current = true;
		setMobileView(view);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const isCommissioner = !!league && !!session?.user?.id && league.creatorId === session.user.id;

	const openInvite = async () => {
		setInviteLoading(true);
		try {
			const res = await fetch(`/api/league/${id}/invite-link`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			setInviteUrl(data.inviteUrl);
			setInviteOpen(true);
		} catch {
			toast.error('Couldn’t load the invite link');
		} finally {
			setInviteLoading(false);
		}
	};

	const copyInvite = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error('Couldn’t copy — select the link and copy it manually');
		}
	};

	const shareInvite = async () => {
		try {
			await navigator.share({ title: `Join ${league?.name} on Pick 5`, text: `Join my Pick 5 league, ${league?.name}!`, url: inviteUrl });
		} catch {
			// Share sheet dismissed
		}
	};

	const leaveLeague = async () => {
		setLeaving(true);
		try {
			const res = await fetch(`/api/league/${id}/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
			if (!res.ok) throw new Error((await res.json()).error || 'Failed to leave league');
			toast.success(`You left ${league?.name}`);
			router.push('/dashboard');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to leave league');
			setLeaving(false);
			setLeaveOpen(false);
		}
	};

	if (!league || isDesktop === null) {
		return (
			<div className='mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8'>
				<Skeleton className='h-36 w-full rounded-3xl' />
				<div className='grid gap-6 lg:grid-cols-3'>
					<Skeleton className='h-[60vh] lg:col-span-2' />
					<Skeleton className='hidden h-[60vh] lg:block' />
				</div>
			</div>
		);
	}

	const mobileTabs: Array<{ id: MobileView; label: string; icon: typeof Gamepad2 }> = [
		{ id: 'picks', label: 'Picks', icon: Gamepad2 },
		// Keep the bar at ≤ 5 items: while games are live, Live takes Results' slot (Results is linked from Live)
		showLive ? { id: 'live', label: 'Live', icon: Radio } : { id: 'results', label: 'Results', icon: BarChart3 },
		{ id: 'leaderboard', label: 'Board', icon: Trophy },
		{ id: 'stats', label: 'Stats', icon: TrendingUp },
		...(recapWeek ? [{ id: 'recap' as const, label: 'Recap', icon: Sparkles }] : [])
	];

	return (
		<div className='mx-auto w-full max-w-7xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-16'>
			{/* League header */}
			<header className='glass relative mb-4 overflow-hidden rounded-3xl p-4 sm:mb-6 sm:p-7'>
				<div className='pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl' />
				<div className='pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-accent-2/15 blur-3xl' />
				<div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-brand-gradient opacity-60' />

				<div className='relative flex flex-col gap-3 sm:gap-5 md:flex-row md:items-end md:justify-between'>
					<div className='min-w-0'>
						<div className='mb-2 flex flex-wrap items-center gap-2 sm:mb-3'>
							<Pill tone={league.mode === 'steve' ? 'accent' : 'primary'}>{league.mode === 'steve' ? 'Steve mode' : 'Standard'}</Pill>
							{league.members && (
								<Pill>
									<Users className='h-3 w-3' /> {league.members.length} members
								</Pill>
							)}
							{isCommissioner && (
								<Pill tone='warning' className='hidden sm:inline-flex'>
									Commissioner
								</Pill>
							)}
						</div>
						<h1 className='display-heading break-words text-[2rem] sm:text-6xl'>{league.name}</h1>
					</div>

					<div className='flex gap-2'>
						{isCommissioner && (
							<Button onClick={openInvite} disabled={inviteLoading} size='sm'>
								<Share2 /> Invite
							</Button>
						)}
						<Button onClick={() => setRulesOpen(true)} size='sm' variant='outline' aria-label='Rules'>
							<BookOpen /> <span className='hidden sm:inline'>Rules</span>
						</Button>
						<Button asChild size='sm' variant='outline'>
							<Link href={`/league/${id}/history`} aria-label='History'>
								<History /> <span className='hidden sm:inline'>History</span>
							</Link>
						</Button>
						{isCommissioner ? (
							<Button onClick={() => setSettingsOpen(true)} size='icon' variant='outline' className='h-9 w-9' aria-label='League settings'>
								<Settings />
							</Button>
						) : (
							<Button onClick={() => setLeaveOpen(true)} size='sm' variant='ghost' className='text-muted-foreground hover:text-destructive'>
								<LogOut /> Leave
							</Button>
						)}
					</div>
				</div>
			</header>

			{isDesktop ? (
				<div className='grid grid-cols-[minmax(0,1fr)_380px] gap-6'>
					<Tabs
						value={desktopTab}
						onValueChange={value => {
							autoView.current = true;
							setDesktopTab(value as DesktopTab);
						}}
						className='min-w-0'
					>
						<TabsList className={cn('grid w-full', ['grid-cols-2', 'grid-cols-3', 'grid-cols-4'][(showLive ? 1 : 0) + (recapWeek ? 1 : 0)])}>
							{showLive && (
								<TabsTrigger value='live' className='data-[state=active]:text-live'>
									<span className='live-dot' /> Live
								</TabsTrigger>
							)}
							<TabsTrigger value='picks'>
								<Gamepad2 /> Make picks
							</TabsTrigger>
							<TabsTrigger value='results'>
								<BarChart3 /> Results
							</TabsTrigger>
							{recapWeek && (
								<TabsTrigger value='recap'>
									<Sparkles /> Week {recapWeek} recap
								</TabsTrigger>
							)}
						</TabsList>
						{showLive && (
							<TabsContent value='live'>
								<SweatView leagueId={id} week={currentWeek} onShowResults={() => setDesktopTab('results')} onMakePicks={() => setDesktopTab('picks')} />
							</TabsContent>
						)}
						<TabsContent value='picks'>
							<WeeklyPicks />
						</TabsContent>
						<TabsContent value='results'>
							<Results />
						</TabsContent>
						{recapWeek && (
							<TabsContent value='recap'>
								<Recap weekOverride={recapWeek} />
							</TabsContent>
						)}
					</Tabs>
					<aside className='space-y-6'>
						<Leaderboard />
						<LeagueStats leagueId={id} userId={session?.user?.id} leagueName={league.name} />
					</aside>
				</div>
			) : (
				<>
					<div key={mobileView} className='animate-fade-in'>
						{mobileView === 'live' && <SweatView leagueId={id} week={currentWeek} onShowResults={() => chooseMobileView('results')} onMakePicks={() => chooseMobileView('picks')} />}
						{mobileView === 'picks' && <WeeklyPicks />}
						{mobileView === 'results' && showLive && (
							<button type='button' onClick={() => chooseMobileView('live')} className='mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-primary'>
								<ArrowLeft className='h-4 w-4' /> Back to Live
							</button>
						)}
						{mobileView === 'results' && <Results />}
						{mobileView === 'leaderboard' && <Leaderboard />}
						{mobileView === 'stats' && <LeagueStats leagueId={id} userId={session?.user?.id} leagueName={league.name} />}
						{mobileView === 'recap' && recapWeek && <Recap weekOverride={recapWeek} />}
					</div>

					<nav className='fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40' aria-label='League sections'>
						<div className='glass-strong mx-auto flex max-w-md items-stretch gap-1 rounded-2xl p-1.5'>
							{mobileTabs.map(({ id: tabId, label, icon: Icon }) => {
								// Results is a sub-view of Live while games are live
								const active = mobileView === tabId || (tabId === 'live' && mobileView === 'results');
								return (
									<button
										key={tabId}
										type='button'
										onClick={() => chooseMobileView(tabId)}
										aria-current={active ? 'page' : undefined}
										className={cn(
											'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-95',
											active ? 'bg-primary text-primary-foreground shadow-primary-glow' : 'text-muted-foreground hover:text-foreground'
										)}
									>
										<Icon className='h-5 w-5' />
										{label}
									</button>
								);
							})}
						</div>
					</nav>
				</>
			)}

			{/* Invite */}
			<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Invite your crew</DialogTitle>
						<DialogDescription>Anyone with this link can join {league.name} after signing in — no password needed.</DialogDescription>
					</DialogHeader>
					<div className='flex gap-2'>
						<Input value={inviteUrl} readOnly onFocus={e => e.target.select()} className='font-mono text-xs' />
						<Button onClick={copyInvite} variant={copied ? 'success' : 'default'} className='shrink-0'>
							{copied ? <Check /> : <Copy />}
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
					{typeof navigator !== 'undefined' && 'share' in navigator && (
						<Button variant='outline' onClick={shareInvite} className='w-full'>
							<Share2 /> Share…
						</Button>
					)}
				</DialogContent>
			</Dialog>

			<LeagueRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} mode={league.mode} />

			{isCommissioner && <LeagueSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} leagueId={id} league={league} onSaved={updated => setLeague(prev => (prev ? { ...prev, ...updated } : prev))} />}

			{/* Leave */}
			<Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
				<DialogContent className='sm:max-w-sm'>
					<DialogHeader>
						<DialogTitle>Leave {league.name}?</DialogTitle>
						<DialogDescription>You’ll drop off the standings and all of your picks in this league will be deleted. You’ll need a new invite to rejoin.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='ghost' onClick={() => setLeaveOpen(false)} disabled={leaving}>
							Stay
						</Button>
						<Button variant='destructive' onClick={leaveLeague} disabled={leaving}>
							{leaving ? 'Leaving…' : 'Leave league'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
