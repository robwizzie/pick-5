'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LogIn, BarChart3, Users, Trophy, TrendingUp, Target, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActiveLeagues from '@/components/league/ActiveLeagues';
import LiveFeed from '@/components/dashboard/LiveFeed';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import CountUp from 'react-countup';

interface TeamPick {
	team: string;
	logo: string;
	isCorrect: boolean | null;
	gameStatus: 'scheduled' | 'in_progress' | 'final';
}

interface League {
	_id: string;
	id: string;
	name: string;
	description?: string;
	sport: string;
	creatorId?: string;
	inviteCode?: string;
	mode?: string;
	members?: string[];
}

interface RecentActivity {
	type: 'pick' | 'league_join';
	message: string;
	timestamp: Date;
	leagueId?: string;
	leagueName?: string;
	teamPicks?: TeamPick[];
	week?: number;
}

const Dashboard = () => {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leagues, setLeagues] = useState<League[]>([]);
	const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
	const [stats, setStats] = useState({
		totalSeasonPoints: 0,
		globalRank: 0,
		totalUsers: 0,
		winRate: 0,
		rankPercentage: 0
	});

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
			return;
		}
	}, [status, router]);

	useEffect(() => {
		const fetchLeagues = async () => {
			if (!session) return;

			try {
				const response = await fetch('/api/user/leagues');

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Failed to fetch leagues: ${response.status} - ${errorText}`);
					return;
				}

				const data = await response.json();
				const normalizedLeagues = data.map((league: { _id: string; name: string; description: string }) => ({
					...league,
					id: league._id
				}));

				setLeagues(normalizedLeagues);
			} catch (error) {
				console.error('Network error fetching leagues:', error);
			}
		};

		fetchLeagues();
	}, [session]);

	// Fetch stats from all leagues with TRUE global rank
	useEffect(() => {
		const fetchStats = async () => {
			if (!session || leagues.length === 0) return;

			try {
				let totalPoints = 0;
				let totalPicks = 0;
				let correctPicks = 0;

				// Map to store all users and their total points across all leagues
				const globalUserPoints = new Map<string, { name: string; totalPoints: number }>();

				// Calculate total season points and win rate across all leagues
				for (const league of leagues) {
					try {
						// Fetch leaderboard for this league to get user's points
						const leaderboardRes = await fetch(`/api/leaderboard?leagueId=${league.id}`);
						if (leaderboardRes.ok) {
							const data = await leaderboardRes.json();

							// Find user's season stats in this league
							const userSeasonStats = data.seasonStats?.find(
								(entry: { player: string }) => entry.player === session.user?.name
							);

							if (userSeasonStats) {
								totalPoints += userSeasonStats.totalPoints || 0;
								totalPicks += userSeasonStats.totalPicks || 0;
								correctPicks += userSeasonStats.correctPicks || 0;
							}

							// Aggregate all users' points across leagues for global ranking
							if (data.seasonStats && Array.isArray(data.seasonStats)) {
								data.seasonStats.forEach((stat: { player: string; totalPoints: number }) => {
									const existing = globalUserPoints.get(stat.player);
									if (existing) {
										existing.totalPoints += stat.totalPoints || 0;
									} else {
										globalUserPoints.set(stat.player, {
											name: stat.player,
											totalPoints: stat.totalPoints || 0
										});
									}
								});
							}
						}
					} catch (error) {
						console.error('Error fetching stats for league:', error);
					}
				}

				// Calculate TRUE global rank across all users in all leagues
				const allUsers = Array.from(globalUserPoints.values());
				const sortedUsers = allUsers.sort((a, b) => b.totalPoints - a.totalPoints);

				const userGlobalRank = sortedUsers.findIndex(u => u.name === session.user?.name) + 1;
				const totalGlobalUsers = sortedUsers.length;

				// Calculate win rate
				const winRate = totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0;
				const rankPercentage = totalGlobalUsers > 0 && userGlobalRank > 0
					? Math.round(((totalGlobalUsers - userGlobalRank + 1) / totalGlobalUsers) * 100)
					: 0;

				setStats({
					totalSeasonPoints: totalPoints,
					globalRank: userGlobalRank,
					totalUsers: totalGlobalUsers,
					winRate,
					rankPercentage
				});
			} catch (error) {
				console.error('Error calculating stats:', error);
			}
		};

		fetchStats();
	}, [session, leagues]);

	useEffect(() => {
		const fetchRecentActivity = async () => {
			if (!session || leagues.length === 0) return;

			try {
				const activities: RecentActivity[] = [];

				// Fetch recent picks from all leagues
				for (const league of leagues) {
					try {
						const response = await fetch(`/api/picks/user?leagueId=${league.id}`);
						if (response.ok) {
							const picks = await response.json();
							// Get all picks and add them to activities
							if (Array.isArray(picks) && picks.length > 0) {
								// Fetch game data for each week to get logos and statuses
								for (const pick of picks) {
									try {
										const games = await NFLService.getWeeklyGames(pick.week);
										const teamPicks: TeamPick[] = [];

										// Build game results for scoring
										const gameResults = games.map(game => ({
											id: game.id,
											homeScore: game.home.score || 0,
											awayScore: game.away.score || 0,
											homeTeam: game.home.team,
											awayTeam: game.away.team,
											status: game.status
										}));

										// Match picks with games to get logos and status
										if (pick.picks && Array.isArray(pick.picks)) {
											pick.picks.forEach((p: { gameId: string; team: string; isHome: boolean; isCorrect?: boolean | null }) => {
												const game = games.find(g => g.id === p.gameId);
												if (game) {
													const teamData = p.team === game.home.team ? game.home : game.away;
													const status = game.status?.toLowerCase() || 'scheduled';
													let gameStatus: 'scheduled' | 'in_progress' | 'final' = 'scheduled';

													if (status === 'in' || status === 'in_progress') {
														gameStatus = 'in_progress';
													} else if (status === 'post' || status === 'final' || status === 'status_final') {
														gameStatus = 'final';
													}

													// Calculate isCorrect for finished games
													let isCorrect: boolean | null = null;
													if (gameStatus === 'final') {
														const gameResult = gameResults.find(gr => gr.id === p.gameId);
														if (gameResult) {
															isCorrect = ScoringService.calculatePickResult(p, gameResult);
														}
													}

													teamPicks.push({
														team: p.team,
														logo: teamData.logo,
														isCorrect,
														gameStatus
													});
												}
											});
										}

										// Use updatedAt, createdAt, or ObjectID timestamp as fallback
										const timestamp = pick.updatedAt || pick.createdAt || new Date(parseInt(pick._id.toString().substring(0, 8), 16) * 1000);
										activities.push({
											type: 'pick',
											message: `Made picks for Week ${pick.week}`,
											timestamp: new Date(timestamp),
											leagueId: league.id,
											leagueName: league.name,
											teamPicks,
											week: pick.week
										});
									} catch (error) {
										console.error('Error fetching game data for pick:', error);
									}
								}
							}
						}
					} catch (error) {
						console.error('Error fetching picks for league:', error);
					}
				}

				// Sort by timestamp and take the 10 most recent
				if (activities.length > 0) {
					activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
					setRecentActivity(activities.slice(0, 10));
				}
			} catch (error) {
				console.error('Error fetching recent activity:', error);
			}
		};

		fetchRecentActivity();
	}, [session, leagues]);

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-7xl mx-auto space-y-6 lg:space-y-8'>
				{/* Welcome Header - Compact on Mobile */}
				<div className='text-center space-y-2 lg:space-y-4 animate-fade-in'>
					<h1 className='text-3xl lg:text-5xl font-display font-bold gradient-text'>Welcome back, {session?.user?.name?.split(' ')[0]}!</h1>
					<p className='text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto'>Ready to dominate your leagues? Make your picks and climb the leaderboard.</p>
				</div>

				{/* Leagues Section - FIRST on Mobile */}
				<div className='lg:hidden space-y-4'>
					<div className='flex items-center justify-between'>
						<h2 className='text-xl font-display font-bold text-foreground'>Your Leagues</h2>
						<div className='flex gap-2'>
							<Button variant='outline' size='sm' onClick={() => router.push('/league/create')} className='glass border-white/20 hover:border-primary/50'>
								<Plus className='h-4 w-4 mr-1.5' />
								Create
							</Button>
							<Button size='sm' onClick={() => router.push('/league/join')} className='bg-primary hover:bg-primary/90'>
								<LogIn className='h-4 w-4 mr-1.5' />
								Join
							</Button>
						</div>
					</div>

					{leagues.length > 0 ? (
						<ActiveLeagues leagues={leagues} userId={session?.user?.id} />
					) : (
						<Card className='glass border-white/10'>
							<CardContent className='p-8 text-center space-y-4'>
								<div className='w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center'>
									<Users className='h-8 w-8 text-muted-foreground' />
								</div>
								<div className='space-y-2'>
									<h3 className='text-lg font-semibold text-foreground'>No leagues yet</h3>
									<p className='text-sm text-muted-foreground'>Join your first league to start competing.</p>
								</div>
								<div className='flex flex-col gap-2'>
									<Button onClick={() => router.push('/league/create')} className='bg-primary hover:bg-primary/90'>
										<Plus className='h-4 w-4 mr-2' />
										Create League
									</Button>
									<Button variant='outline' onClick={() => router.push('/league/join')} className='glass border-white/20 hover:border-primary/50'>
										<LogIn className='h-4 w-4 mr-2' />
										Join League
									</Button>
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				{/* Stats Overview - Below Leagues on Mobile, Above on Desktop */}
				{leagues.length > 0 && (
					<>
						{/* Mobile: Horizontal Scroll */}
						<div className='lg:hidden'>
							<h3 className='text-lg font-display font-bold text-foreground mb-3'>Your Stats</h3>
							<div className='flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide'>
								{/* Season Points */}
								<Card className='flex-shrink-0 w-[280px] glass border-white/10 snap-start'>
									<CardContent className='p-5'>
										<div className='flex items-start justify-between'>
											<div className='space-y-1.5'>
												<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Season Points</p>
												<div className='flex items-baseline gap-2'>
													<p className='text-3xl font-mono font-bold text-primary'>
														<CountUp end={stats.totalSeasonPoints} duration={1.5} />
													</p>
													{stats.rankPercentage > 0 && (
														<span className='text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary'>
															Top {stats.rankPercentage}%
														</span>
													)}
												</div>
											</div>
											<div className='p-2.5 rounded-full bg-primary/10'>
												<Trophy className='h-5 w-5 text-primary' />
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Global Rank */}
								<Card className='flex-shrink-0 w-[280px] glass border-white/10 snap-start'>
									<CardContent className='p-5'>
										<div className='flex items-start justify-between'>
											<div className='space-y-1.5'>
												<div className='flex items-center gap-1.5'>
													<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Global Rank</p>
													<div className='group relative'>
														<Info className='h-3 w-3 text-muted-foreground cursor-help' />
														<div className='absolute left-0 top-full mt-2 w-64 p-3 bg-card border border-white/20 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-50 text-xs text-foreground'>
															Your rank among all unique users across all your leagues, based on total points.
														</div>
													</div>
												</div>
												<div className='flex items-baseline gap-2'>
													<p className='text-3xl font-mono font-bold text-primary'>
														#{stats.globalRank > 0 ? <CountUp end={stats.globalRank} duration={1.5} /> : '—'}
													</p>
												</div>
												{stats.totalUsers > 0 && (
													<p className='text-[10px] text-muted-foreground'>of {stats.totalUsers.toLocaleString()} users</p>
												)}
												<Button
													variant='ghost'
													size='sm'
													className='text-[10px] h-6 px-2 text-primary hover:text-primary/80 hover:bg-primary/10'
													onClick={() => router.push('/leaderboard')}
												>
													View Global Leaderboard →
												</Button>
											</div>
											<div className='p-2.5 rounded-full bg-primary/10'>
												<Target className='h-5 w-5 text-primary' />
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Win Rate */}
								<Card className='flex-shrink-0 w-[280px] glass border-white/10 snap-start'>
									<CardContent className='p-5'>
										<div className='flex items-start justify-between'>
											<div className='space-y-1.5'>
												<p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Win Rate</p>
												<div className='flex items-baseline gap-2'>
													<p className='text-3xl font-mono font-bold text-primary'>
														<CountUp end={stats.winRate} duration={1.5} />%
													</p>
												</div>
											</div>
											<div className='p-2.5 rounded-full bg-primary/10'>
												<TrendingUp className='h-5 w-5 text-primary' />
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>

						{/* Desktop: Grid */}
						<div className='hidden lg:grid grid-cols-3 gap-6 animate-slide-up'>
							{/* Season Points */}
							<Card className='glass border-white/10 hover:border-primary/30 transition-all duration-300'>
								<CardContent className='p-6'>
									<div className='flex items-start justify-between'>
										<div className='space-y-2'>
											<p className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>Season Points</p>
											<div className='flex items-baseline gap-2'>
												<p className='text-4xl font-mono font-bold text-primary'>
													<CountUp end={stats.totalSeasonPoints} duration={1.5} />
												</p>
												{stats.rankPercentage > 0 && (
													<span className='text-xs font-semibold px-2 py-1 rounded-full bg-primary/20 text-primary'>
														Top {stats.rankPercentage}%
													</span>
												)}
											</div>
										</div>
										<div className='p-3 rounded-full bg-primary/10'>
											<Trophy className='h-6 w-6 text-primary' />
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Global Rank */}
							<Card className='glass border-white/10 hover:border-primary/30 transition-all duration-300'>
								<CardContent className='p-6'>
									<div className='flex items-start justify-between'>
										<div className='space-y-2'>
											<div className='flex items-center gap-2'>
												<p className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>Global Rank</p>
												<div className='group relative'>
													<Info className='h-4 w-4 text-muted-foreground cursor-help' />
													<div className='absolute left-0 top-full mt-2 w-72 p-4 bg-card border border-white/20 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-50 text-sm text-foreground'>
														<p className='font-semibold mb-1'>How Global Rank Works:</p>
														<p className='text-xs'>Your rank among all unique users across all your leagues, based on total season points.</p>
													</div>
												</div>
											</div>
											<div className='flex items-baseline gap-2'>
												<p className='text-4xl font-mono font-bold text-primary'>
													#{stats.globalRank > 0 ? <CountUp end={stats.globalRank} duration={1.5} /> : '—'}
												</p>
											</div>
											{stats.totalUsers > 0 && (
												<p className='text-xs text-muted-foreground'>of {stats.totalUsers.toLocaleString()} users</p>
											)}
											<Button
												variant='ghost'
												size='sm'
												className='text-xs h-7 px-3 text-primary hover:text-primary/80 hover:bg-primary/10 mt-1'
												onClick={() => router.push('/leaderboard')}
											>
												View Global Leaderboard →
											</Button>
										</div>
										<div className='p-3 rounded-full bg-primary/10'>
											<Target className='h-6 w-6 text-primary' />
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Win Rate */}
							<Card className='glass border-white/10 hover:border-primary/30 transition-all duration-300'>
								<CardContent className='p-6'>
									<div className='flex items-start justify-between'>
										<div className='space-y-2'>
											<p className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>Win Rate</p>
											<div className='flex items-baseline gap-2'>
												<p className='text-4xl font-mono font-bold text-primary'>
													<CountUp end={stats.winRate} duration={1.5} />%
												</p>
											</div>
										</div>
										<div className='p-3 rounded-full bg-primary/10'>
											<TrendingUp className='h-6 w-6 text-primary' />
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</>
				)}

				{/* Mobile: Quick Actions and Live Feed */}
				<div className='lg:hidden space-y-6'>
					{/* Quick Actions */}
					<Card className='glass border-white/10'>
						<CardHeader>
							<CardTitle className='text-lg font-display font-semibold'>Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/league/create')}>
								<Plus className='h-4 w-4 mr-3' />
								Create New League
							</Button>
							<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/league/join')}>
								<LogIn className='h-4 w-4 mr-3' />
								Join League
							</Button>
							<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/stats')}>
								<BarChart3 className='h-4 w-4 mr-3' />
								My Stats
							</Button>
						</CardContent>
					</Card>

					{/* Live Feed */}
					<LiveFeed recentActivity={recentActivity} />
				</div>

				{/* Desktop Layout: Leagues + Sidebar */}
				<div className='hidden lg:grid lg:grid-cols-3 gap-8'>
					{/* Leagues Section */}
					<div className='lg:col-span-2 space-y-6'>
						<div className='flex items-center justify-between'>
							<h2 className='text-2xl font-display font-bold text-foreground'>Your Leagues</h2>
							<div className='flex space-x-3'>
								<Button variant='outline' onClick={() => router.push('/league/create')} className='glass border-white/20 hover:border-primary/50 btn-hover'>
									<Plus className='h-4 w-4 mr-2' />
									Create
								</Button>
								<Button onClick={() => router.push('/league/join')} className='bg-primary hover:bg-primary/90 btn-hover'>
									<LogIn className='h-4 w-4 mr-2' />
									Join
								</Button>
							</div>
						</div>

						{leagues.length > 0 ? (
							<ActiveLeagues leagues={leagues} userId={session?.user?.id} />
						) : (
							<Card className='glass border-white/10'>
								<CardContent className='p-12 text-center space-y-6'>
									<div className='w-24 h-24 mx-auto bg-muted/20 rounded-full flex items-center justify-center'>
										<Users className='h-12 w-12 text-muted-foreground' />
									</div>
									<div className='space-y-2'>
										<h3 className='text-xl font-semibold text-foreground'>No leagues yet</h3>
										<p className='text-muted-foreground max-w-md mx-auto'>Join your first league to start competing with friends and making picks.</p>
									</div>
									<div className='flex flex-col sm:flex-row gap-3 justify-center'>
										<Button onClick={() => router.push('/league/create')} className='bg-primary hover:bg-primary/90 btn-hover'>
											<Plus className='h-4 w-4 mr-2' />
											Create League
										</Button>
										<Button variant='outline' onClick={() => router.push('/league/join')} className='glass border-white/20 hover:border-primary/50 btn-hover'>
											<LogIn className='h-4 w-4 mr-2' />
											Join League
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</div>

					{/* Sidebar */}
					<div className='space-y-6'>
						{/* Quick Actions */}
						<Card className='glass border-white/10'>
							<CardHeader>
								<CardTitle className='text-lg font-display font-semibold'>Quick Actions</CardTitle>
							</CardHeader>
							<CardContent className='space-y-3'>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/league/create')}>
									<Plus className='h-4 w-4 mr-3' />
									Create New League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/league/join')}>
									<LogIn className='h-4 w-4 mr-3' />
									Join League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10 transition-all' onClick={() => router.push('/stats')}>
									<BarChart3 className='h-4 w-4 mr-3' />
									My Stats
								</Button>
							</CardContent>
						</Card>

						{/* Live Feed */}
						<LiveFeed recentActivity={recentActivity} />
					</div>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
