'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LogIn, Trophy, Users, TrendingUp, Calendar, Star, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActiveLeagues from '@/components/league/ActiveLeagues';

const Dashboard = () => {
	const router = useRouter();
	const { data: session } = useSession();
	const [leagues, setLeagues] = useState([]);
	const [stats, setStats] = useState({
		totalPicks: 0,
		winRate: 0,
		currentRank: 0,
		weeklyStreak: 0
	});

	useEffect(() => {
		const fetchLeagues = async () => {
			if (!session) return;

			try {
				const response = await fetch('/api/user/leagues', {
					headers: {
						Authorization: `Bearer ${session.accessToken}`
					}
				});

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

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-7xl mx-auto space-y-8'>
				{/* Welcome Header */}
				<div className='text-center space-y-4 animate-fade-in'>
					<h1 className='text-4xl lg:text-5xl font-display font-bold gradient-text'>Welcome back, {session?.user?.name?.split(' ')[0]}!</h1>
					<p className='text-xl text-muted-foreground max-w-2xl mx-auto'>Ready to dominate your leagues? Make your picks and climb the leaderboard.</p>
				</div>

				{/* Stats Overview */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up'>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Trophy className='h-8 w-8 text-accent mx-auto' />
							<p className='text-2xl font-bold text-foreground'>{stats.totalPicks}</p>
							<p className='text-sm text-muted-foreground'>Total Picks</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<TrendingUp className='h-8 w-8 text-primary mx-auto' />
							<p className='text-2xl font-bold text-foreground'>{stats.winRate}%</p>
							<p className='text-sm text-muted-foreground'>Win Rate</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Crown className='h-8 w-8 text-accent-3 mx-auto' />
							<p className='text-2xl font-bold text-foreground'>#{stats.currentRank}</p>
							<p className='text-sm text-muted-foreground'>Current Rank</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Star className='h-8 w-8 text-accent-2 mx-auto' />
							<p className='text-2xl font-bold text-foreground'>{stats.weeklyStreak}</p>
							<p className='text-sm text-muted-foreground'>Week Streak</p>
						</CardContent>
					</Card>
				</div>

				{/* Main Content */}
				<div className='grid lg:grid-cols-3 gap-8'>
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
							<ActiveLeagues leagues={leagues} />
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
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/league/create')}>
									<Plus className='h-4 w-4 mr-3' />
									Create New League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/league/join')}>
									<LogIn className='h-4 w-4 mr-3' />
									Join League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/dashboard')}>
									<Trophy className='h-4 w-4 mr-3' />
									View Leaderboard
								</Button>
							</CardContent>
						</Card>

						{/* Recent Activity */}
						<Card className='glass border-white/10'>
							<CardHeader>
								<CardTitle className='text-lg font-display font-semibold'>Recent Activity</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4'>
								<div className='text-center py-8 text-muted-foreground'>
									<Calendar className='h-8 w-8 mx-auto mb-2' />
									<p className='text-sm'>No recent activity</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
