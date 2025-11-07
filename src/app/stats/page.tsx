'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Trophy, Target, TrendingUp, Calendar, Award } from 'lucide-react';

interface LeagueStats {
	leagueId: string;
	leagueName: string;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	weeksPlayed: number;
}

interface AllTimeStats {
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	totalLeagues: number;
	totalWeeksPlayed: number;
	avgPointsPerWeek: number;
}

const StatsPage = () => {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [loading, setLoading] = useState(true);
	const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
	const [leagueStats, setLeagueStats] = useState<LeagueStats[]>([]);

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
			return;
		}

		if (status === 'authenticated') {
			fetchStats();
		}
	}, [status, router]);

	const fetchStats = async () => {
		try {
			setLoading(true);

			// Fetch user's leagues
			const leaguesResponse = await fetch('/api/user/leagues');
			if (!leaguesResponse.ok) throw new Error('Failed to fetch leagues');
			const leagues = await leaguesResponse.json();

			// Fetch picks for all leagues
			const leagueStatsData: LeagueStats[] = [];
			let allTimeData = {
				totalPoints: 0,
				correctPicks: 0,
				totalPicks: 0,
				totalTFSPoints: 0,
				totalWeeksPlayed: 0
			};

			for (const league of leagues) {
				try {
					// Fetch season stats for this league
					const seasonResponse = await fetch(`/api/leaderboard?week=1&leagueId=${league._id}`);
					if (seasonResponse.ok) {
						const data = await seasonResponse.json();
						const userStats = data.seasonStats.find((s: any) => s.player === session?.user?.name);

						if (userStats) {
							leagueStatsData.push({
								leagueId: league._id,
								leagueName: league.name,
								totalPoints: userStats.totalPoints,
								correctPicks: userStats.correctPicks,
								totalPicks: userStats.totalPicks,
								totalTFSPoints: userStats.totalTFSPoints,
								winPercentage: userStats.winPercentage,
								weeksPlayed: Math.ceil(userStats.totalPicks / 5)
							});

							allTimeData.totalPoints += userStats.totalPoints;
							allTimeData.correctPicks += userStats.correctPicks;
							allTimeData.totalPicks += userStats.totalPicks;
							allTimeData.totalTFSPoints += userStats.totalTFSPoints;
							allTimeData.totalWeeksPlayed += Math.ceil(userStats.totalPicks / 5);
						}
					}
				} catch (error) {
					console.error('Error fetching stats for league:', league._id, error);
				}
			}

			setLeagueStats(leagueStatsData);
			setAllTimeStats({
				...allTimeData,
				winPercentage: allTimeData.totalPicks > 0 ? (allTimeData.correctPicks / allTimeData.totalPicks) * 100 : 0,
				totalLeagues: leagues.length,
				avgPointsPerWeek: allTimeData.totalWeeksPlayed > 0 ? allTimeData.totalPoints / allTimeData.totalWeeksPlayed : 0
			});
		} catch (error) {
			console.error('Error fetching stats:', error);
		} finally {
			setLoading(false);
		}
	};

	if (status === 'loading' || loading) {
		return (
			<div className='min-h-screen p-4 pt-8 flex items-center justify-center'>
				<Spinner />
			</div>
		);
	}

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-7xl mx-auto space-y-8'>
				{/* Header */}
				<div className='text-center space-y-4 animate-fade-in'>
					<h1 className='text-4xl lg:text-5xl font-display font-bold gradient-text'>My Stats</h1>
					<p className='text-xl text-muted-foreground max-w-2xl mx-auto'>Track your performance across all leagues</p>
				</div>

				{/* All-Time Stats */}
				{allTimeStats && (
					<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
						<Card className='glass border-white/10'>
							<CardContent className='p-6 text-center space-y-2'>
								<Trophy className='h-8 w-8 text-primary mx-auto' />
								<p className='text-3xl font-bold text-foreground'>{allTimeStats.totalPoints}</p>
								<p className='text-sm text-muted-foreground'>Total Points</p>
							</CardContent>
						</Card>
						<Card className='glass border-white/10'>
							<CardContent className='p-6 text-center space-y-2'>
								<Target className='h-8 w-8 text-green-400 mx-auto' />
								<p className='text-3xl font-bold text-foreground'>{Math.round(allTimeStats.winPercentage)}%</p>
								<p className='text-sm text-muted-foreground'>Win Rate</p>
							</CardContent>
						</Card>
						<Card className='glass border-white/10'>
							<CardContent className='p-6 text-center space-y-2'>
								<TrendingUp className='h-8 w-8 text-accent mx-auto' />
								<p className='text-3xl font-bold text-foreground'>{allTimeStats.avgPointsPerWeek.toFixed(1)}</p>
								<p className='text-sm text-muted-foreground'>Avg/Week</p>
							</CardContent>
						</Card>
						<Card className='glass border-white/10'>
							<CardContent className='p-6 text-center space-y-2'>
								<Calendar className='h-8 w-8 text-accent-3 mx-auto' />
								<p className='text-3xl font-bold text-foreground'>{allTimeStats.totalWeeksPlayed}</p>
								<p className='text-sm text-muted-foreground'>Weeks Played</p>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Detailed Stats */}
				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle className='text-2xl font-display font-bold'>Detailed Statistics</CardTitle>
					</CardHeader>
					<CardContent>
						<Tabs defaultValue='alltime'>
							<TabsList className='mb-6'>
								<TabsTrigger value='alltime'>All-Time</TabsTrigger>
								<TabsTrigger value='byleague'>By League</TabsTrigger>
							</TabsList>

							<TabsContent value='alltime'>
								<div className='space-y-4'>
									<div className='grid md:grid-cols-2 gap-4'>
										<div className='p-4 rounded-lg bg-card/50 border border-primary/20'>
											<p className='text-sm text-muted-foreground mb-1'>Correct Picks</p>
											<p className='text-2xl font-bold text-primary'>
												{allTimeStats?.correctPicks} / {allTimeStats?.totalPicks}
											</p>
										</div>
										<div className='p-4 rounded-lg bg-card/50 border border-primary/20'>
											<p className='text-sm text-muted-foreground mb-1'>TFS Bonus Points</p>
											<p className='text-2xl font-bold text-accent'>{allTimeStats?.totalTFSPoints}</p>
										</div>
										<div className='p-4 rounded-lg bg-card/50 border border-primary/20'>
											<p className='text-sm text-muted-foreground mb-1'>Total Leagues</p>
											<p className='text-2xl font-bold text-foreground'>{allTimeStats?.totalLeagues}</p>
										</div>
										<div className='p-4 rounded-lg bg-card/50 border border-primary/20'>
											<p className='text-sm text-muted-foreground mb-1'>Incorrect Picks</p>
											<p className='text-2xl font-bold text-destructive'>{(allTimeStats?.totalPicks || 0) - (allTimeStats?.correctPicks || 0)}</p>
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value='byleague'>
								<div className='space-y-4'>
									{leagueStats.length > 0 ? (
										leagueStats.map(stat => (
											<div key={stat.leagueId} className='p-6 rounded-lg bg-card/50 border border-primary/20 hover:border-primary/40 transition-all cursor-pointer' onClick={() => router.push(`/league/${stat.leagueId}`)}>
												<div className='flex items-start justify-between mb-4'>
													<div>
														<h3 className='text-xl font-semibold text-primary mb-1'>{stat.leagueName}</h3>
														<p className='text-sm text-muted-foreground'>{stat.weeksPlayed} weeks played</p>
													</div>
													<Award className='h-6 w-6 text-primary' />
												</div>
												<div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
													<div>
														<p className='text-xs text-muted-foreground mb-1'>Total Points</p>
														<p className='text-lg font-bold text-foreground'>{stat.totalPoints}</p>
													</div>
													<div>
														<p className='text-xs text-muted-foreground mb-1'>Win Rate</p>
														<p className='text-lg font-bold text-green-400'>{Math.round(stat.winPercentage)}%</p>
													</div>
													<div>
														<p className='text-xs text-muted-foreground mb-1'>Correct</p>
														<p className='text-lg font-bold text-primary'>{stat.correctPicks}</p>
													</div>
													<div>
														<p className='text-xs text-muted-foreground mb-1'>Total Picks</p>
														<p className='text-lg font-bold text-foreground'>{stat.totalPicks}</p>
													</div>
													<div>
														<p className='text-xs text-muted-foreground mb-1'>TFS Points</p>
														<p className='text-lg font-bold text-accent'>{stat.totalTFSPoints}</p>
													</div>
												</div>
											</div>
										))
									) : (
										<div className='text-center py-12 text-muted-foreground'>
											<p>No league stats available yet. Start making picks to see your stats!</p>
										</div>
									)}
								</div>
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default StatsPage;
