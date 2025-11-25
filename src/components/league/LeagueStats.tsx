'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CountUp from 'react-countup';
import Image from 'next/image';

interface LeagueStatsProps {
	leagueId: string;
	userId?: string;
	leagueName: string;
}

interface WeeklyTrend {
	week: number;
	points: number;
}

export default function LeagueStats({ leagueId, userId, leagueName }: LeagueStatsProps) {
	const { data: session } = useSession();
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		rank: 0,
		totalPoints: 0,
		winRate: 0,
		correctPicks: 0,
		totalPicks: 0,
		tfsPoints: 0
	});
	const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
	const [leaderboard, setLeaderboard] = useState<any[]>([]);

	useEffect(() => {
		const fetchStats = async () => {
			try {
				setLoading(true);

				// Fetch leaderboard data
				const response = await fetch(`/api/leaderboard?leagueId=${leagueId}`);
				if (!response.ok) return;

				const data = await response.json();

				// Find current user's data by name (not ID)
				const userName = session?.user?.name;
				const userSeasonStats = data.seasonStats?.find(
					(entry: any) => entry.player === userName
				);

				if (userSeasonStats) {
					// Calculate rank
					const sortedStats = [...data.seasonStats].sort(
						(a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0)
					);
					const userIndex = sortedStats.findIndex(
						(entry: any) => entry.player === userName
					);
					const rank = userIndex !== -1 ? userIndex + 1 : 0;

					const winRate = userSeasonStats.totalPicks > 0
						? Math.round((userSeasonStats.correctPicks / userSeasonStats.totalPicks) * 100)
						: 0;

					setStats({
						rank,
						totalPoints: userSeasonStats.totalPoints || 0,
						winRate,
						correctPicks: userSeasonStats.correctPicks || 0,
						totalPicks: userSeasonStats.totalPicks || 0,
						tfsPoints: userSeasonStats.totalTFSPoints || 0
					});

					// Set top 4 leaderboard
					setLeaderboard(sortedStats.slice(0, 4));
				}

				// Fetch weekly trend data (last 5 weeks)
				const picksResponse = await fetch(`/api/picks/user?leagueId=${leagueId}`);
				if (picksResponse.ok) {
					const picks = await picksResponse.json();

					// Group picks by week and calculate points
					const weeklyData = picks
						.sort((a: any, b: any) => a.week - b.week)
						.slice(-5)
						.map((pick: any) => ({
							week: pick.week,
							points: pick.weeklyPoints || 0
						}));

					setWeeklyTrend(weeklyData);
				}

				setLoading(false);
			} catch (error) {
				console.error('Error fetching league stats:', error);
				setLoading(false);
			}
		};

		if (leagueId && session?.user?.name) {
			fetchStats();
		}
	}, [leagueId, session]);

	if (loading) {
		return (
			<div className='space-y-6'>
				<Card className='glass border-white/10'>
					<CardContent className='p-6'>
						<Spinner />
					</CardContent>
				</Card>
			</div>
		);
	}

	// Calculate max points for chart scaling
	const maxPoints = Math.max(...weeklyTrend.map(w => w.points), 15);

	return (
		<div className='space-y-6'>
			{/* My Rank */}
			<Card className='glass border-white/10'>
				<CardContent className='p-6'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>My Rank</h3>
						<Trophy className='h-5 w-5 text-primary' />
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-5xl font-bold font-mono text-primary'>
							{stats.rank > 0 ? (
								<>
									<CountUp end={stats.rank} duration={0.5} />
									{stats.rank === 1 && '🥇'}
									{stats.rank === 2 && '🥈'}
									{stats.rank === 3 && '🥉'}
								</>
							) : '—'}
						</span>
						{stats.rank <= 3 && stats.rank > 0 && (
							<span className='text-xs text-muted-foreground'>
								{stats.rank === 1 ? 'st' : stats.rank === 2 ? 'nd' : 'rd'}
							</span>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Season Statistics */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='text-lg font-display flex items-center gap-2'>
						<Target className='h-5 w-5 text-primary' />
						Season Statistics
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					{/* Total Points */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Total Points</span>
						<span className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.totalPoints} duration={0.5} />
						</span>
					</div>

					{/* Win % */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Win %</span>
						<span className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.winRate} duration={0.5} />%
						</span>
					</div>

					{/* Correct Picks */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Correct Picks</span>
						<span className='text-xl font-bold font-mono text-foreground'>
							<CountUp end={stats.correctPicks} duration={0.5} />/{stats.totalPicks}
						</span>
					</div>

					{/* TFS Points (if applicable) */}
					{stats.tfsPoints > 0 && (
						<div className='flex items-center justify-between'>
							<span className='text-sm text-muted-foreground'>TFS Points</span>
							<span className='text-xl font-bold font-mono text-purple-400'>
								<CountUp end={stats.tfsPoints} duration={0.5} />
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Weekly Trend */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='text-lg font-display flex items-center gap-2'>
						<TrendingUp className='h-5 w-5 text-primary' />
						Weekly Trend
					</CardTitle>
				</CardHeader>
				<CardContent>
					{weeklyTrend.length > 0 ? (
						<div className='space-y-2'>
							{/* Chart */}
							<div className='h-32 flex items-end gap-2'>
								{weeklyTrend.map((data, index) => {
									const height = (data.points / maxPoints) * 100;
									return (
										<div key={data.week} className='flex-1 flex flex-col items-center gap-1'>
											<div className='relative w-full group'>
												<div
													className='w-full bg-gradient-to-t from-primary to-primary/50 rounded-t transition-all duration-300 hover:from-primary/90 hover:to-primary/70'
													style={{ height: `${height}%`, minHeight: '8px' }}
												>
													{/* Tooltip */}
													<div className='absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none'>
														<div className='bg-card border border-white/20 rounded px-2 py-1 text-xs font-mono font-bold whitespace-nowrap'>
															{data.points} pts
														</div>
													</div>
												</div>
											</div>
											<span className='text-[10px] text-muted-foreground font-medium'>W{data.week}</span>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<p className='text-sm text-muted-foreground text-center py-4'>
							No data yet
						</p>
					)}
				</CardContent>
			</Card>

			{/* Mini Leaderboard */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='text-lg font-display flex items-center gap-2'>
						<Award className='h-5 w-5 text-primary' />
						Mini Leaderboard
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-2'>
					{leaderboard.length > 0 ? (
						leaderboard.map((entry, index) => (
							<div
								key={entry.player}
								className='flex items-center gap-3 p-2 rounded-lg bg-card/50 hover:bg-card/80 transition-colors'
							>
								{/* Rank Badge */}
								<div className='flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs'>
									{index + 1}
								</div>

								{/* Avatar */}
								<div className='relative w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex-shrink-0'>
									{entry.image ? (
										<Image
											src={entry.image}
											alt={entry.player}
											fill
											className='object-cover'
										/>
									) : (
										<div className='w-full h-full flex items-center justify-center text-primary font-semibold text-xs'>
											{entry.player.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
										</div>
									)}
								</div>

								{/* Name */}
								<span className='flex-1 text-sm font-medium text-foreground truncate'>
									{entry.player}
								</span>

								{/* Points */}
								<span className='text-sm font-bold font-mono text-primary'>
									{entry.totalPoints}
								</span>
							</div>
						))
					) : (
						<p className='text-sm text-muted-foreground text-center py-4'>
							No rankings yet
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
