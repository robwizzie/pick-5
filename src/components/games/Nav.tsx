'use client';

import { useWeek } from '@/contexts/WeekContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home, Trophy, Users, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AuthDialog } from './AuthDialog';
import { useState } from 'react';

export function Nav() {
	const { currentWeek, setCurrentWeek } = useWeek();
	const pathname = usePathname();
	const router = useRouter();
	const { data: session, status } = useSession();
	const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
	const isLoading = status === 'loading';
	const isLeaguePage = pathname?.startsWith('/league/');

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
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center h-20'>
					{/* Left side - Week navigation for league pages */}
					<div className='flex items-center space-x-4'>
						{isLeaguePage ? (
							<div className='flex items-center space-x-2 glass rounded-full px-4 py-2'>
								<Button variant='ghost' size='sm' onClick={handlePreviousWeek} disabled={currentWeek <= 1} className='h-8 w-8 p-0 hover:bg-primary/20 text-primary rounded-full'>
									<ChevronLeft className='h-4 w-4' />
								</Button>
								<span className='text-lg font-display uppercase tracking-wide text-primary font-semibold min-w-[80px] text-center'>Week {currentWeek}</span>
								<Button variant='ghost' size='sm' onClick={handleNextWeek} disabled={currentWeek >= 18} className='h-8 w-8 p-0 hover:bg-primary/20 text-primary rounded-full'>
									<ChevronRight className='h-4 w-4' />
								</Button>
							</div>
						) : (
							<div className='flex items-center space-x-2'>
								<Button variant='ghost' size='sm' onClick={() => router.push('/dashboard')} className='flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors'>
									<Home className='h-4 w-4' />
									<span className='hidden sm:inline font-medium'>Dashboard</span>
								</Button>
							</div>
						)}
					</div>

					{/* Center - Logo */}
					<div className='absolute left-1/2 transform -translate-x-1/2'>
						<div className='cursor-pointer transition-all duration-300 hover:scale-110 hover:drop-shadow-glow' onClick={() => router.push('/dashboard')}>
							<Image src='/pick-5-logo.png' alt='Pick 5 Logo' width={56} height={56} className='drop-shadow-lg' priority />
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
								<DropdownMenuContent className='w-64 glass border-white/10 backdrop-blur-xl' align='end' forceMount>
									<DropdownMenuLabel className='pb-2'>
										<div className='flex flex-col space-y-1'>
											<p className='font-semibold text-foreground'>{session.user?.name}</p>
											<p className='text-sm text-muted-foreground'>{session.user?.email}</p>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator className='bg-white/10' />
									<DropdownMenuItem onClick={() => router.push('/dashboard')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<Home className='h-4 w-4' />
										<span>Dashboard</span>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => router.push('/dashboard')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<Trophy className='h-4 w-4' />
										<span>My Leagues</span>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => router.push('/dashboard')} className='flex items-center space-x-2 cursor-pointer hover:bg-primary/10'>
										<Users className='h-4 w-4' />
										<span>Leaderboard</span>
									</DropdownMenuItem>
									<DropdownMenuSeparator className='bg-white/10' />
									<DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className='flex items-center space-x-2 cursor-pointer hover:bg-destructive/10 text-destructive'>
										<Settings className='h-4 w-4' />
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
		</nav>
	);
}
