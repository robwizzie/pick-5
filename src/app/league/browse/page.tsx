'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Compass, Loader2, Lock, PlusCircle, Search, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, Pill } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface League {
	id: string;
	name: string;
	memberCount: number;
	createdAt: string;
	isMember: boolean;
	/** Not returned by /api/leagues/public yet; shown when present. */
	mode?: string;
}

interface Pagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

function getPageNumbers(currentPage: number, totalPages: number) {
	const count = Math.min(5, totalPages);
	let start = 1;
	if (totalPages > 5) {
		if (currentPage <= 3) start = 1;
		else if (currentPage >= totalPages - 2) start = totalPages - 4;
		else start = currentPage - 2;
	}
	return Array.from({ length: count }, (_, i) => start + i);
}

export default function BrowseLeaguesPage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leagues, setLeagues] = useState<League[]>([]);
	const [pagination, setPagination] = useState<Pagination | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	// Password modal state
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
	const [password, setPassword] = useState('');
	const [joiningLeague, setJoiningLeague] = useState(false);
	const [joinError, setJoinError] = useState('');

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
		}
	}, [status, router]);

	const fetchLeagues = useCallback(async () => {
		try {
			setLoading(true);
			setLoadError(false);
			const params = new URLSearchParams({
				page: currentPage.toString(),
				...(searchTerm && { search: searchTerm })
			});

			const response = await fetch(`/api/leagues/public?${params}`);
			if (!response.ok) throw new Error('Failed to fetch leagues');

			const data: { leagues: League[]; pagination: Pagination } = await response.json();
			setLeagues(data.leagues);
			setPagination(data.pagination);
		} catch (error) {
			console.error('Error fetching leagues:', error);
			setLoadError(true);
		} finally {
			setLoading(false);
		}
	}, [currentPage, searchTerm]);

	useEffect(() => {
		if (status === 'authenticated') {
			fetchLeagues();
		}
	}, [status, fetchLeagues]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchTerm(searchInput.trim());
		setCurrentPage(1); // Reset to first page on new search
	};

	const clearSearch = () => {
		setSearchInput('');
		setSearchTerm('');
		setCurrentPage(1);
	};

	const handleLeagueClick = (league: League) => {
		// If user is already a member, navigate directly to the league
		if (league.isMember) {
			router.push(`/league/${league.id}`);
			return;
		}

		// Otherwise, show the password modal
		setSelectedLeague(league);
		setPassword('');
		setJoinError('');
		setShowPasswordModal(true);
	};

	const handleJoinLeague = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!selectedLeague || !password) return;

		try {
			setJoiningLeague(true);
			setJoinError('');

			const response = await fetch('/api/league/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					leagueId: selectedLeague.id,
					password
				})
			});

			const data: { error?: string } = await response.json();

			if (!response.ok) {
				setJoinError(data.error || 'Failed to join league');
				return;
			}

			// Success! Redirect to the league page
			setShowPasswordModal(false);
			router.push(`/league/${selectedLeague.id}`);
		} catch (error) {
			console.error('Error joining league:', error);
			setJoinError('An unexpected error occurred');
		} finally {
			setJoiningLeague(false);
		}
	};

	const handlePageChange = (newPage: number) => {
		if (pagination && newPage >= 1 && newPage <= pagination.totalPages) {
			setCurrentPage(newPage);
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	};

	if (status === 'loading' || !session) {
		return (
			<PageContainer className='flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center'>
				<Spinner />
			</PageContainer>
		);
	}

	const rangeStart = pagination && leagues.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
	const rangeEnd = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

	return (
		<PageContainer>
			<PageHeader
				eyebrow={
					<>
						<Compass className='h-3.5 w-3.5 text-primary' /> League finder
					</>
				}
				title='Browse Leagues'
				description='Find a league and join with its password — or start your own.'
				actions={
					<Button variant='outline' onClick={() => router.push('/league/create')}>
						<PlusCircle /> Create League
					</Button>
				}
			/>

			{/* Search */}
			<form onSubmit={handleSearch} role='search' className='mb-4 flex gap-2 animate-slide-up' style={{ animationDelay: '60ms' }}>
				<div className='relative flex-1'>
					<Search className='pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
					<Input
						type='search'
						aria-label='Search leagues by name'
						placeholder='Search leagues by name…'
						value={searchInput}
						onChange={e => setSearchInput(e.target.value)}
						className='h-12 pl-10 pr-10'
					/>
					{searchInput && (
						<button
							type='button'
							onClick={clearSearch}
							aria-label='Clear search'
							className='absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
						>
							<X className='h-4 w-4' />
						</button>
					)}
				</div>
				<Button type='submit' size='lg' className='h-12'>
					<Search className='sm:hidden' />
					<span className='hidden sm:inline'>Search</span>
					<span className='sr-only sm:hidden'>Search</span>
				</Button>
			</form>

			{/* Results info */}
			{pagination && !loading && !loadError && (
				<div className='mb-4 flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground'>
					<p className='tabular'>
						Showing {rangeStart}–{rangeEnd} of {pagination.total} {pagination.total === 1 ? 'league' : 'leagues'}
					</p>
					{searchTerm && (
						<p>
							Results for <span className='font-semibold text-primary'>&ldquo;{searchTerm}&rdquo;</span>
						</p>
					)}
				</div>
			)}

			{/* Leagues */}
			{loading ? (
				<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className='glass space-y-4 rounded-2xl p-5'>
							<div className='flex items-center gap-3'>
								<Skeleton className='h-11 w-11 rounded-xl' />
								<div className='flex-1 space-y-2'>
									<Skeleton className='h-5 w-3/4' />
									<Skeleton className='h-3 w-1/2' />
								</div>
							</div>
							<Skeleton className='h-10 w-full' />
						</div>
					))}
				</div>
			) : loadError ? (
				<EmptyState
					icon={Compass}
					title='Couldn’t load leagues'
					description='Something went wrong fetching the league list.'
					action={<Button onClick={fetchLeagues}>Try again</Button>}
				/>
			) : leagues.length === 0 ? (
				<EmptyState
					icon={searchTerm ? Search : Users}
					title={searchTerm ? 'No matches' : 'No leagues yet'}
					description={searchTerm ? `No leagues found matching “${searchTerm}”.` : 'Be the first — create a league and invite your friends.'}
					action={
						searchTerm ? (
							<Button variant='outline' onClick={clearSearch}>
								Clear search
							</Button>
						) : (
							<Button onClick={() => router.push('/league/create')}>
								<PlusCircle /> Create a League
							</Button>
						)
					}
				/>
			) : (
				<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
					{leagues.map((league, index) => (
						<button
							key={league.id}
							type='button'
							onClick={() => handleLeagueClick(league)}
							className={cn(
								'glass card-hover group flex animate-slide-up flex-col rounded-2xl p-5 text-left focus-visible:ring-2 focus-visible:ring-primary',
								league.isMember && 'bg-primary/[0.05] ring-1 ring-primary/30'
							)}
							style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
						>
							<div className='flex items-start gap-3'>
								<span
									className={cn(
										'grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold uppercase italic',
										league.isMember ? 'bg-primary text-primary-foreground' : 'bg-white/[0.06] text-foreground'
									)}
								>
									{league.name.trim().charAt(0) || '?'}
								</span>
								<div className='min-w-0 flex-1'>
									<h3 className='truncate font-display text-xl font-bold uppercase italic leading-tight tracking-tight transition-colors group-hover:text-primary'>
										{league.name}
									</h3>
									<div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
										{league.isMember && (
											<Pill tone='primary'>
												<CheckCircle2 className='h-3 w-3' /> Member
											</Pill>
										)}
										{league.mode && <Pill tone={league.mode === 'steve' ? 'accent' : 'muted'}>{league.mode === 'steve' ? 'Steve' : 'Standard'}</Pill>}
									</div>
								</div>
							</div>

							<div className='mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4'>
								<div className='flex items-center gap-3 text-xs text-muted-foreground'>
									<span className='flex items-center gap-1.5'>
										<Users className='h-3.5 w-3.5' />
										<span className='tabular font-semibold text-foreground'>{league.memberCount}</span>
										{league.memberCount === 1 ? 'member' : 'members'}
									</span>
									{!league.isMember && (
										<span className='flex items-center gap-1'>
											<Lock className='h-3.5 w-3.5' /> Private
										</span>
									)}
								</div>
								<span className={cn('flex items-center gap-1 text-sm font-semibold', league.isMember ? 'text-primary' : 'text-foreground group-hover:text-primary')}>
									{league.isMember ? 'View' : 'Join'}
									<ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
								</span>
							</div>
						</button>
					))}
				</div>
			)}

			{/* Pagination */}
			{pagination && pagination.totalPages > 1 && !loading && (
				<nav aria-label='Pagination' className='mt-6 flex items-center justify-between gap-2'>
					<Button variant='outline' size='sm' onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
						<ChevronLeft /> <span className='hidden sm:inline'>Previous</span>
					</Button>

					<div className='flex items-center gap-1'>
						{getPageNumbers(currentPage, pagination.totalPages).map(pageNum => (
							<Button
								key={pageNum}
								variant={currentPage === pageNum ? 'default' : 'ghost'}
								size='sm'
								onClick={() => handlePageChange(pageNum)}
								aria-current={currentPage === pageNum ? 'page' : undefined}
								className='w-9 px-0 tabular'
							>
								{pageNum}
							</Button>
						))}
					</div>

					<Button variant='outline' size='sm' onClick={() => handlePageChange(currentPage + 1)} disabled={!pagination.hasMore}>
						<span className='hidden sm:inline'>Next</span> <ChevronRight />
					</Button>
				</nav>
			)}

			{/* Password Modal */}
			<Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<p className='eyebrow flex items-center gap-2'>
							<Lock className='h-3.5 w-3.5 text-primary' /> Private league
						</p>
						<DialogTitle className='break-words'>Join {selectedLeague?.name}</DialogTitle>
						<DialogDescription>Enter the league password your commissioner shared with you.</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleJoinLeague} className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='league-password'>League password</Label>
							<Input
								id='league-password'
								type='password'
								value={password}
								onChange={e => {
									setPassword(e.target.value);
									if (joinError) setJoinError('');
								}}
								placeholder='Enter league password'
								aria-invalid={!!joinError}
								className={cn(joinError && 'border-destructive/60 focus-visible:border-destructive/60 focus-visible:ring-destructive/30')}
								autoFocus
							/>
						</div>

						{joinError && (
							<Alert variant='destructive'>
								<AlertDescription>{joinError}</AlertDescription>
							</Alert>
						)}

						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setShowPasswordModal(false)} disabled={joiningLeague}>
								Cancel
							</Button>
							<Button type='submit' disabled={!password || joiningLeague}>
								{joiningLeague ? (
									<>
										<Loader2 className='animate-spin' /> Joining…
									</>
								) : (
									'Join League'
								)}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}
