'use client';

import { useWeek } from '@/contexts/WeekContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AuthDialog } from './AuthDialog';
import { useState } from 'react';

export function Nav() {
	const { currentWeek, setCurrentWeek } = useWeek(); // Access week state
	const pathname = usePathname();
	const router = useRouter();
	const { data: session, status } = useSession();
	const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
	const isLoading = status === 'loading';
	const isLeaguePage = pathname?.startsWith('/league/');

	const handleNextWeek = () => {
		if (currentWeek < 17) {
			const newWeek = currentWeek + 1;
			setCurrentWeek(newWeek);
		}
	};

	const handlePreviousWeek = () => {
		if (currentWeek > 10) {
			const newWeek = currentWeek - 1;
			setCurrentWeek(newWeek);
		}
	};

	return (
		<nav className='bg-card shadow-lg sticky top-0 z-50 border-b-2 border-primary/20'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16'>
				<div className='flex items-center justify-between h-full'>
					{/* Left side - Week selector */}
					<div className='flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1'>
						{isLeaguePage ? (
							<>
								<Button variant='ghost' size='icon' onClick={handlePreviousWeek} disabled={currentWeek <= 1} className='hover:bg-primary/20 text-primary flex-shrink-0'>
									<ChevronLeft className='h-4 w-4' />
								</Button>
								<span className='text-sm sm:text-lg font-oswald uppercase tracking-wide text-primary whitespace-nowrap'>Week {currentWeek}</span>
								<Button variant='ghost' size='icon' onClick={handleNextWeek} disabled={currentWeek >= 18} className='hover:bg-primary/20 text-primary flex-shrink-0'>
									<ChevronRight className='h-4 w-4' />
								</Button>
							</>
						) : (
							<div className='w-8' /> {/* Placeholder for alignment */}
						)}
					</div>

					{/* Center - Logo (hidden on small screens when on league page to prevent overlap) */}
					<div className={`flex-shrink-0 ${isLeaguePage ? 'hidden sm:block' : ''}`}>
						<Image src='/pick-5-logo.png' alt='Pick 5 Logo' width={48} height={48} className='cursor-pointer' onClick={() => router.push('/dashboard')} />
					</div>

					{/* Right side - User menu */}
					<div className='flex items-center justify-end flex-1 min-w-0'>
						{isLoading ? (
							<div className='animate-pulse h-8 w-8 rounded-full bg-muted flex-shrink-0' />
						) : session ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' className='relative h-8 w-8 rounded-full ring-2 ring-primary hover:ring-primary/80 flex-shrink-0'>
										<Avatar className='h-8 w-8'>
											<AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
											<AvatarFallback>{session.user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
										</Avatar>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className='w-56 bg-card border-primary/20' align='end' forceMount>
									<DropdownMenuLabel>
										<div className='flex flex-col'>
											<p>{session.user?.name}</p>
											<p>{session.user?.email}</p>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => router.push('/dashboard')}>View All Leagues</DropdownMenuItem>
									<DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>
				</div>
			</div>
			<AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
		</nav>
	);
}
