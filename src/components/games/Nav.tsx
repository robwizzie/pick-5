'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, LogIn, User } from 'lucide-react';
import { AuthDialog } from './AuthDialog';
import { useSession, signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface NavProps {
	currentWeek: number;
	onWeekChange: (week: number) => void;
}

export function Nav({ currentWeek, onWeekChange }: NavProps) {
	const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
	const { data: session, status } = useSession();
	const isLoading = status === 'loading';

	const handlePreviousWeek = () => {
		if (currentWeek > 10) {
			onWeekChange(currentWeek - 1);
		}
	};

	const handleNextWeek = () => {
		if (currentWeek < 17) {
			onWeekChange(currentWeek + 1);
		}
	};

	return (
		<nav className='bg-white shadow-md sticky top-0 z-50'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16'>
				{/* Week Navigation */}
				<div className='flex items-center space-x-4'>
					<Button variant='outline' size='icon' onClick={handlePreviousWeek} disabled={currentWeek <= 10}>
						<ChevronLeft className='h-4 w-4' />
					</Button>
					<span className='text-lg font-medium'>Week {currentWeek}</span>
					<Button variant='outline' size='icon' onClick={handleNextWeek} disabled={currentWeek >= 17}>
						<ChevronRight className='h-4 w-4' />
					</Button>
				</div>

				{/* Logo in the Center */}
				<div className='absolute left-1/2 transform -translate-x-1/2'>
					<Image src='/pick-5-logo.png' alt='Pick 5 Logo' height={48} width={48} className='h-12 w-auto'/>
				</div>

				{/* Authentication */}
				<div>
					{isLoading ? (
						<div className='animate-pulse h-8 w-8 rounded-full bg-gray-200' />
					) : session ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='ghost' className='relative h-8 w-8 rounded-full'>
									<Avatar className='h-8 w-8'>
										<AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
										<AvatarFallback>
											{session.user?.name
												?.split(' ')
												.map(n => n[0])
												.join('')
												.toUpperCase() || 'U'}
										</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className='w-56' align='end' forceMount>
								<DropdownMenuLabel className='font-normal'>
									<div className='flex flex-col space-y-1'>
										<p className='text-sm font-medium leading-none'>{session.user?.name}</p>
										<p className='text-xs leading-none text-muted-foreground'>{session.user?.email}</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem className='text-red-600 cursor-pointer' onClick={() => signOut({ callbackUrl: '/' })}>
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<Button variant='default' onClick={() => setIsAuthDialogOpen(true)}>
							<LogIn className='mr-2 h-4 w-4' /> Sign In
						</Button>
					)}
				</div>
			</div>

			{/* Authentication Dialog */}
			<AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
		</nav>
	);
}
