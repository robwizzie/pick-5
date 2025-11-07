'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LogIn, BarChart3, Users, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActiveLeagues from '@/components/league/ActiveLeagues';

interface RecentActivity {
	type: 'pick' | 'league_join';
	message: string;
	timestamp: Date;
	leagueId?: string;
	leagueName?: string;
}

const Dashboard = () => {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leagues, setLeagues] = useState([]);
	const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

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

	useEffect(() => {
		const fetchRecentActivity = async () => {
			if (!session || leagues.length === 0) return;

			try {
				const activities: RecentActivity[] = [];

				// Fetch recent picks from all leagues
				for (const league of leagues) {
					try {
						const response = await fetch(`/api/picks/user?leagueId=${(league as any).id}`);
						if (response.ok) {
							const picks = await response.json();
							// Get all picks and add them to activities
							if (Array.isArray(picks) && picks.length > 0) {
								picks.forEach((pick: any) => {
									// Use updatedAt, createdAt, or ObjectID timestamp as fallback
									const timestamp = pick.updatedAt || pick.createdAt || new Date(parseInt(pick._id.toString().substring(0, 8), 16) * 1000);
									activities.push({
										type: 'pick',
										message: `Made picks for Week ${pick.week}`,
										timestamp: new Date(timestamp),
										leagueId: (league as any).id,
										leagueName: (league as any).name
									});
								});
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
			<div className='max-w-7xl mx-auto space-y-8'>
				{/* Welcome Header */}
				<div className='text-center space-y-4 animate-fade-in'>
					<h1 className='text-4xl lg:text-5xl font-display font-bold gradient-text'>Welcome back, {session?.user?.name?.split(' ')[0]}!</h1>
					<p className='text-xl text-muted-foreground max-w-2xl mx-auto'>Ready to dominate your leagues? Make your picks and climb the leaderboard.</p>
				</div>

				{/* Stats Overview - TODO: Implement stats fetching */}
				{/* <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up'>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Trophy className='h-8 w-8 text-accent mx-auto' />
							<p className='text-2xl font-bold text-foreground'>0</p>
							<p className='text-sm text-muted-foreground'>Total Picks</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<TrendingUp className='h-8 w-8 text-primary mx-auto' />
							<p className='text-2xl font-bold text-foreground'>0%</p>
							<p className='text-sm text-muted-foreground'>Win Rate</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Crown className='h-8 w-8 text-accent-3 mx-auto' />
							<p className='text-2xl font-bold text-foreground'>#0</p>
							<p className='text-sm text-muted-foreground'>Current Rank</p>
						</CardContent>
					</Card>
					<Card className='glass border-white/10 card-hover'>
						<CardContent className='p-6 text-center space-y-2'>
							<Star className='h-8 w-8 text-accent-2 mx-auto' />
							<p className='text-2xl font-bold text-foreground'>0</p>
							<p className='text-sm text-muted-foreground'>Week Streak</p>
						</CardContent>
					</Card>
				</div> */}

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
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/league/create')}>
									<Plus className='h-4 w-4 mr-3' />
									Create New League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/league/join')}>
									<LogIn className='h-4 w-4 mr-3' />
									Join League
								</Button>
								<Button variant='ghost' className='w-full justify-start glass hover:bg-primary/10' onClick={() => router.push('/stats')}>
									<BarChart3 className='h-4 w-4 mr-3' />
									My Stats
								</Button>
							</CardContent>
						</Card>

						{/* Recent Activity */}
						<Card className='glass border-white/10'>
							<CardHeader>
								<CardTitle className='text-lg font-display font-semibold'>Recent Activity</CardTitle>
							</CardHeader>
							<CardContent className='space-y-3'>
								{recentActivity.length > 0 ? (
									recentActivity.map((activity, index) => (
										<div key={index} className='flex items-start gap-3 p-3 rounded-lg bg-card/50 hover:bg-card/80 transition-colors cursor-pointer' onClick={() => activity.leagueId && router.push(`/league/${activity.leagueId}`)}>
											<div className='w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0' />
											<div className='flex-1 min-w-0'>
												<p className='text-sm text-foreground'>{activity.message}</p>
												{activity.leagueName && <p className='text-xs text-muted-foreground truncate'>{activity.leagueName}</p>}
												<p className='text-xs text-muted-foreground mt-1'>{new Date(activity.timestamp).toLocaleDateString()}</p>
											</div>
										</div>
									))
								) : (
									<div className='text-center py-8 text-muted-foreground'>
										<Calendar className='h-8 w-8 mx-auto mb-2' />
										<p className='text-sm'>No recent activity</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
