'use client';

import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home, Settings, LogOut, BarChart3, Shield } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AuthDialog } from './AuthDialog';
import { WeekSelectorModal } from './WeekSelectorModal';
import { useState, useEffect } from 'react';

const ADMIN_USER_ID = '67c124e9cce9530ce4c1a655';

export function Nav() {
	const { currentWeek, setCurrentWeek } = useWeek();
	const { leagueId } = useLeague();
	const pathname = usePathname();
	const router = useRouter();
	const { data: session, status } = useSession();
	const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
	const [isWeekSelectorOpen, setIsWeekSelectorOpen] = useState(false);
	const [weeksWithPicks, setWeeksWithPicks] = useState<number[]>([]);
	const isLoading = status === 'loading';
	const isLeaguePage = pathname?.startsWith('/league/');
	const isDashboard = pathname === '/dashboard';
	const isCreateLeague = pathname === '/league/create';
	const isJoinLeague = pathname === '/league/join';
	const isBrowseLeague = pathname === '/league/browse';
	const isAdmin = session?.user?.id === ADMIN_USER_ID;

	// Fetch weeks with picks for the current league
	useEffect(() => {
		const fetchWeeksWithPicks = async () => {
			if (!session || !leagueId) return;

			try {
				const response = await fetch(`/api/picks/user?leagueId=${leagueId}`);
				if (response.ok) {
					const data: Array<{ week: number }> = await response.json();
					console.log('[Nav] Fetched picks data:', data);
					if (Array.isArray(data)) {
						const weeks = data.map(pick => pick.week);
						console.log('[Nav] Weeks with picks:', weeks);
						setWeeksWithPicks(weeks);
					}
				}
			} catch (error) {
				console.error('Error fetching weeks with picks:', error);
			}
		};

		fetchWeeksWithPicks();
	}, [session, leagueId]);

	const handleNextWeek = () => {
		if (currentWeek < 18) {
			const newWeek = currentWeek + 1;
			setCurrentWeek(newWeek);
		}
	};

	const handlePreviousWeek = () => {
		if (currentWeek > 1) {
			const newWeek = currentWeek - 1;
			setCurrentWeek(newWeek);
		}
	};

	return (
		<nav className='glass sticky top-0 z-50 border-b border-white/10'>
			<div className='max-w-7xl mx-auto px-3 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center h-16'>
					{/* Left side - Week navigation for league pages or Dashboard button */}
					<div className='flex items-center'>
						{isLeaguePage && !isCreateLeague && !isJoinLeague && !isBrowseLeague ? (
							<div className='flex items-center space-x-2 glass rounded-full px-3 py-1.5'>
								<Button variant='ghost' size='sm' onClick={handlePreviousWeek} disabled={currentWeek <= 1} className='h-7 w-7 p-0 hover:bg-primary/20 text-primary rounded-full disabled:opacity-30 disabled:cursor-not-allowed'>
									<ChevronLeft className='h-4 w-4' />
								</Button>
								<button onClick={() => setIsWeekSelectorOpen(true)} className='text-base sm:text-lg font-display uppercase tracking-wide text-primary font-semibold min-w-[70px] sm:min-w-[80px] text-center hover:bg-primary/10 px-2 py-0.5 rounded transition-colors cursor-pointer'>
									Week {currentWeek}
								</button>
								<Button variant='ghost' size='sm' onClick={handleNextWeek} disabled={currentWeek >= 18} className='h-7 w-7 p-0 hover:bg-primary/20 text-primary rounded-full'>
									<ChevronRight className='h-4 w-4' />
								</Button>
							</div>
						) : !isDashboard ? (
							<Button
								variant='ghost'
								size='sm'
								onClick={() => router.push('/dashboard')}
								className='flex items-center gap-2 text-primary hover:bg-primary/10 transition-colors px-3 py-2 rounded-full glass'
							>
								<Home className='h-4 w-4' />
								<span className='hidden sm:inline text-sm font-medium'>Dashboard</span>
							</Button>
						) : null}
					</div>

					{/* Center - Logo */}
					<div className='absolute left-1/2 transform -translate-x-1/2'>
						<div className='cursor-pointer transition-all duration-300 hover:scale-110 hover:drop-shadow-glow' onClick={() => router.push('/dashboard')}>
							<Image src='/pick-5-logo.png' alt='Pick 5 Logo' width={48} height={48} className='drop-shadow-lg sm:w-14 sm:h-14' priority />
						</div>
					</div>

					{/* Right side - User menu */}
					<div className='flex items-center space-x-4'>
						{isLoading ? (
							<div className='animate-pulse h-10 w-10 rounded-full bg-muted/50' />
						) : session ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' className='relative h-10 w-10 rounded-full ring-2 ring-primary/50 hover:ring-primary transition-all duration-300 hover:scale-105'>
										<Avatar className='h-10 w-10'>
											<AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
											<AvatarFallback className='bg-primary/20 text-primary font-semibold'>{session.user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
										</Avatar>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className='w-56 glass border-white/10 backdrop-blur-xl' align='end' forceMount>
									<DropdownMenuLabel className='pb-2'>
										<div className='flex flex-col space-y-1'>
											<p className='font-semibold text-foreground'>{session.user?.name}</p>
											<p className='text-xs text-muted-foreground truncate'>{session.user?.email}</p>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator className='bg-white/10' />
									<DropdownMenuItem onClick={() => router.push('/dashboard')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<Home className='h-4 w-4' />
										<span>Dashboard</span>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => router.push('/stats')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<BarChart3 className='h-4 w-4' />
										<span>My Stats</span>
									</DropdownMenuItem>
									{isAdmin && (
										<DropdownMenuItem onClick={() => router.push('/admin')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10 text-primary'>
											<Shield className='h-4 w-4' />
											<span>Admin Tools</span>
										</DropdownMenuItem>
									)}
									<DropdownMenuSeparator className='bg-white/10' />
									<DropdownMenuItem onClick={() => router.push('/settings')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<Settings className='h-4 w-4' />
										<span>Settings</span>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className='flex items-center space-x-2 cursor-pointer hover:bg-destructive/10 text-destructive'>
										<LogOut className='h-4 w-4' />
										<span>Sign Out</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Button variant='outline' onClick={() => setIsAuthDialogOpen(true)} className='glass border-white/20 hover:border-primary/50 hover:bg-primary/10 transition-all duration-300'>
								Sign In
							</Button>
						)}
					</div>
				</div>
			</div>
			<AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
			<WeekSelectorModal open={isWeekSelectorOpen} onOpenChange={setIsWeekSelectorOpen} currentWeek={currentWeek} onWeekSelect={setCurrentWeek} weeksWithPicks={weeksWithPicks} />
		</nav>
	);
}
