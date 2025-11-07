'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, Users, Lock, Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface League {
	id: string;
	name: string;
	memberCount: number;
	createdAt: string;
	isMember: boolean;
}

interface Pagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

export default function BrowseLeaguesPage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leagues, setLeagues] = useState<League[]>([]);
	const [pagination, setPagination] = useState<Pagination | null>(null);
	const [loading, setLoading] = useState(true);
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
			const params = new URLSearchParams({
				page: currentPage.toString(),
				...(searchTerm && { search: searchTerm })
			});

			const response = await fetch(`/api/leagues/public?${params}`);
			if (!response.ok) throw new Error('Failed to fetch leagues');

			const data = await response.json();
			setLeagues(data.leagues);
			setPagination(data.pagination);
		} catch (error) {
			console.error('Error fetching leagues:', error);
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
		setSearchTerm(searchInput);
		setCurrentPage(1); // Reset to first page on new search
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

	const handleJoinLeague = async () => {
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

			const data = await response.json();

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
			<div className='min-h-screen flex items-center justify-center'>
				<Spinner />
			</div>
		);
	}

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-5xl mx-auto space-y-6'>
				{/* Header */}
				<div className='text-center space-y-2'>
					<h1 className='text-4xl font-display font-bold gradient-text'>Browse Leagues</h1>
					<p className='text-muted-foreground'>Find and join a league to start making picks</p>
				</div>

				{/* Search Bar */}
				<Card className='glass border-white/10'>
					<CardContent className='p-4'>
						<form onSubmit={handleSearch} className='flex gap-2'>
							<div className='relative flex-1'>
								<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
								<Input
									type='text'
									placeholder='Search leagues by name...'
									value={searchInput}
									onChange={e => setSearchInput(e.target.value)}
									className='pl-10 glass border-white/10 bg-background/50 focus:border-primary/50'
								/>
							</div>
							<Button type='submit' className='bg-primary hover:bg-primary/90'>
								Search
							</Button>
						</form>
					</CardContent>
				</Card>

				{/* Results Info */}
				{pagination && (
					<div className='flex items-center justify-between text-sm text-muted-foreground px-2'>
						<p>
							Showing {leagues.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} -{' '}
							{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} leagues
						</p>
						{searchTerm && (
							<p>
								Search: <span className='text-primary font-semibold'>&ldquo;{searchTerm}&rdquo;</span>
							</p>
						)}
					</div>
				)}

				{/* Leagues List */}
				{loading ? (
					<div className='flex items-center justify-center py-12'>
						<Spinner />
					</div>
				) : leagues.length === 0 ? (
					<Card className='glass border-white/10'>
						<CardContent className='p-12 text-center'>
							<p className='text-lg text-muted-foreground'>
								{searchTerm ? `No leagues found matching "${searchTerm}"` : 'No leagues available'}
							</p>
							{searchTerm && (
								<Button
									variant='outline'
									onClick={() => {
										setSearchInput('');
										setSearchTerm('');
									}}
									className='mt-4'>
									Clear Search
								</Button>
							)}
						</CardContent>
					</Card>
				) : (
					<div className='grid gap-4'>
						{leagues.map(league => (
							<Card
								key={league.id}
								className={`glass border-white/10 hover:border-primary/50 transition-all cursor-pointer group ${
									league.isMember ? 'border-primary/30' : ''
								}`}
								onClick={() => handleLeagueClick(league)}>
								<CardContent className='p-6'>
									<div className='flex items-center justify-between'>
										<div className='flex-1'>
											<div className='flex items-center gap-2'>
												<h3 className='text-xl font-semibold text-foreground group-hover:text-primary transition-colors'>{league.name}</h3>
												{league.isMember && (
													<div className='flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold'>
														<CheckCircle2 className='h-3 w-3' />
														<span>Member</span>
													</div>
												)}
											</div>
											<div className='flex items-center gap-4 mt-2 text-sm text-muted-foreground'>
												<div className='flex items-center gap-1'>
													<Users className='h-4 w-4' />
													<span>
														{league.memberCount} {league.memberCount === 1 ? 'member' : 'members'}
													</span>
												</div>
												<div className='flex items-center gap-1'>
													<Lock className='h-4 w-4' />
													<span>Password protected</span>
												</div>
											</div>
										</div>
										<Button
											variant='outline'
											className={
												league.isMember
													? 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/50'
													: 'group-hover:bg-primary group-hover:text-primary-foreground transition-colors'
											}>
											{league.isMember ? 'View League' : 'Join League'}
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}

				{/* Pagination */}
				{pagination && pagination.totalPages > 1 && (
					<Card className='glass border-white/10'>
						<CardContent className='p-4'>
							<div className='flex items-center justify-between'>
								<Button
									variant='outline'
									onClick={() => handlePageChange(currentPage - 1)}
									disabled={currentPage === 1}
									className='flex items-center gap-2'>
									<ChevronLeft className='h-4 w-4' />
									Previous
								</Button>

								<div className='flex items-center gap-2'>
									{Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
										// Show pages around current page
										let pageNum;
										if (pagination.totalPages <= 5) {
											pageNum = i + 1;
										} else if (currentPage <= 3) {
											pageNum = i + 1;
										} else if (currentPage >= pagination.totalPages - 2) {
											pageNum = pagination.totalPages - 4 + i;
										} else {
											pageNum = currentPage - 2 + i;
										}

										return (
											<Button
												key={pageNum}
												variant={currentPage === pageNum ? 'default' : 'outline'}
												onClick={() => handlePageChange(pageNum)}
												className={currentPage === pageNum ? 'bg-primary' : ''}>
												{pageNum}
											</Button>
										);
									})}
								</div>

								<Button
									variant='outline'
									onClick={() => handlePageChange(currentPage + 1)}
									disabled={!pagination.hasMore}
									className='flex items-center gap-2'>
									Next
									<ChevronRight className='h-4 w-4' />
								</Button>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Password Modal */}
			<Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-md'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>Join League</DialogTitle>
						<DialogDescription className='text-muted-foreground'>Enter the password to join {selectedLeague?.name}</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-4'>
						<div className='space-y-2'>
							<label htmlFor='password' className='text-sm font-medium text-foreground flex items-center gap-2'>
								<Lock className='h-4 w-4 text-primary' />
								League Password
							</label>
							<Input
								id='password'
								type='password'
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder='Enter league password'
								className='glass border-white/10 bg-background/50 focus:border-primary/50'
								onKeyDown={e => {
									if (e.key === 'Enter' && password) {
										handleJoinLeague();
									}
								}}
								autoFocus
							/>
						</div>

						{joinError && (
							<div className='p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2'>
								<div className='h-2 w-2 rounded-full bg-red-500' />
								{joinError}
							</div>
						)}

						<div className='flex gap-2 pt-2'>
							<Button variant='outline' onClick={() => setShowPasswordModal(false)} className='flex-1' disabled={joiningLeague}>
								Cancel
							</Button>
							<Button onClick={handleJoinLeague} disabled={!password || joiningLeague} className='flex-1 bg-primary hover:bg-primary/90'>
								{joiningLeague ? (
									<>
										<Loader2 className='h-4 w-4 mr-2 animate-spin' />
										Joining...
									</>
								) : (
									'Join League'
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
