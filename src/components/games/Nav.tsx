'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Settings, LogOut, BarChart3, Shield, Trophy, ChevronDown } from 'lucide-react';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ADMIN_USER_ID } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { AuthDialog } from './AuthDialog';
import { WeekSelectorModal } from './WeekSelectorModal';

const NAV_LINKS = [
	{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
	{ href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
	{ href: '/stats', label: 'My Stats', icon: BarChart3 }
];

const RESERVED_LEAGUE_ROUTES = ['/league/create', '/league/join', '/league/browse'];

export function Nav() {
	const { currentWeek, setCurrentWeek, liveWeek } = useWeek();
	const { leagueId } = useLeague();
	const pathname = usePathname() ?? '';
	const { data: session, status } = useSession();
	const [authOpen, setAuthOpen] = useState(false);
	const [weekPickerOpen, setWeekPickerOpen] = useState(false);
	const [weeksWithPicks, setWeeksWithPicks] = useState<number[]>([]);
	const [scrolled, setScrolled] = useState(false);

	// A league's main page (not create/join/browse, not history)
	const isLeaguePage = /^\/league\/[^/]+$/.test(pathname) && !RESERVED_LEAGUE_ROUTES.some(r => pathname.startsWith(r));
	const isAdmin = session?.user?.id === ADMIN_USER_ID;

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	useEffect(() => {
		if (!session || !leagueId || !isLeaguePage) return;
		let cancelled = false;
		fetch(`/api/picks/user?leagueId=${leagueId}`)
			.then(res => (res.ok ? res.json() : []))
			.then((data: Array<{ week: number }>) => {
				if (!cancelled && Array.isArray(data)) setWeeksWithPicks(data.map(p => p.week));
			})
			.catch(error => console.error('Error fetching weeks with picks:', error));
		return () => {
			cancelled = true;
		};
	}, [session, leagueId, isLeaguePage]);

	return (
		<nav
			className={cn(
				'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
				scrolled ? 'border-b border-white/[0.07] bg-background/95 backdrop-blur-xl' : 'border-b border-transparent'
			)}
		>
			<div className='mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8'>
				{/* Brand */}
				<Link href={session ? '/dashboard' : '/'} className='group flex shrink-0 items-center gap-2.5' aria-label='Pick 5 home'>
					<Image src='/pick-5-logo-sm.webp' alt='' width={36} height={41} priority className='h-9 w-auto drop-shadow-[0_4px_14px_rgba(56,214,255,0.35)] transition-transform duration-300 group-hover:scale-105' />
					<span className={cn('font-display text-2xl font-extrabold uppercase italic tracking-tight', isLeaguePage && 'hidden sm:inline')}>
						Pick<span className='brand-text'>5</span>
					</span>
				</Link>

				{/* Week switcher (league pages) */}
				{isLeaguePage && (
					<div className='flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md'>
						<button
							type='button'
							onClick={() => setCurrentWeek(currentWeek - 1)}
							disabled={currentWeek <= 1}
							aria-label='Previous week'
							className='grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30'
						>
							<ChevronLeft className='h-4 w-4' />
						</button>
						<button
							type='button'
							onClick={() => setWeekPickerOpen(true)}
							className='flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors hover:bg-white/10'
						>
							<span className='font-display text-lg font-bold uppercase italic leading-none tabular'>Week {currentWeek}</span>
							{liveWeek === currentWeek && <span className='live-dot' aria-label='Current week' />}
							<ChevronDown className='h-3.5 w-3.5 text-muted-foreground' />
						</button>
						<button
							type='button'
							onClick={() => setCurrentWeek(currentWeek + 1)}
							disabled={currentWeek >= 18}
							aria-label='Next week'
							className='grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30'
						>
							<ChevronRight className='h-4 w-4' />
						</button>
					</div>
				)}

				<div className='flex items-center gap-1'>
					{/* Desktop links */}
					{session && (
						<div className='mr-2 hidden items-center gap-1 md:flex'>
							{NAV_LINKS.map(({ href, label }) => {
								const active = pathname === href;
								return (
									<Link
										key={href}
										href={href}
										className={cn(
											'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
											active ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
										)}
									>
										{label}
									</Link>
								);
							})}
						</div>
					)}

					{status === 'loading' ? (
						<div className='h-9 w-9 animate-pulse rounded-full bg-white/10' />
					) : session ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button type='button' className='rounded-full ring-2 ring-white/10 transition-all hover:ring-primary/60 focus-visible:ring-primary' aria-label='Account menu'>
									<Avatar className='h-9 w-9'>
										<AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
										<AvatarFallback className='bg-primary/15 font-semibold text-primary'>{session.user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
									</Avatar>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className='w-60' align='end' sideOffset={10}>
								<DropdownMenuLabel className='px-2.5 py-2 font-normal'>
									<p className='truncate font-semibold text-foreground'>{session.user?.name}</p>
									<p className='truncate text-xs text-muted-foreground'>{session.user?.email}</p>
								</DropdownMenuLabel>
								<DropdownMenuSeparator className='bg-white/[0.07]' />
								{NAV_LINKS.map(({ href, label, icon: Icon }) => (
									<DropdownMenuItem key={href} asChild>
										<Link href={href}>
											<Icon className='text-muted-foreground' />
											{label}
										</Link>
									</DropdownMenuItem>
								))}
								<DropdownMenuItem asChild>
									<Link href='/settings'>
										<Settings className='text-muted-foreground' />
										Settings
									</Link>
								</DropdownMenuItem>
								{isAdmin && (
									<DropdownMenuItem asChild>
										<Link href='/admin' className='text-primary'>
											<Shield />
											Admin tools
										</Link>
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator className='bg-white/[0.07]' />
								<DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className='text-destructive focus:text-destructive'>
									<LogOut />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<Button size='sm' variant='outline' onClick={() => setAuthOpen(true)} className='rounded-full px-4'>
							Sign in
						</Button>
					)}
				</div>
			</div>

			<AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
			{isLeaguePage && (
				<WeekSelectorModal open={weekPickerOpen} onOpenChange={setWeekPickerOpen} currentWeek={currentWeek} liveWeek={liveWeek} onWeekSelect={setCurrentWeek} weeksWithPicks={weeksWithPicks} />
			)}
		</nav>
	);
}
