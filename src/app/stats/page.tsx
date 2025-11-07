'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Trophy, Target, TrendingUp, Flame, Star, Award, Zap, Crown, Medal, Shield, Rocket, Crosshair, Calendar, Sparkles, Users } from 'lucide-react';

interface LeagueStats {
	leagueId: string;
	leagueName: string;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	weeksPlayed: number;
	bestWeekPoints: number;
	currentStreak: number;
	bestStreak: number;
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
	bestWeekPoints: number;
	bestWeekNumber: number;
	perfectWeeks: number;
	currentStreak: number;
	bestStreak: number;
	totalWins: number;
	totalLosses: number;
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
				totalWeeksPlayed: 0,
				bestWeekPoints: 0,
				bestWeekNumber: 0,
				perfectWeeks: 0,
				currentStreak: 0,
				bestStreak: 0,
				totalWins: 0,
				totalLosses: 0
			};

			// Track all weeks across all leagues for proper streak and perfect week calculation
			interface WeekData {
				week: number;
				leagueId: string;
				correctPicks: number;
				totalPicks: number;
				weeklyPoints: number;
				isPerfectWeek: boolean;
				allGamesFinished: boolean;
			}
			const allWeeks: WeekData[] = [];
			const perfectWeeksSet = new Set<string>(); // Track unique perfect weeks to avoid double-counting

			for (const league of leagues) {
				try {
					// Fetch all picks for this league
					const picksResponse = await fetch(`/api/picks/user?leagueId=${league._id}`);
					if (picksResponse.ok) {
						const picks = await picksResponse.json();
						console.log('[Stats] Picks response for league', league.name, ':', picks);

						let leagueTotalPoints = 0;
						let leagueCorrectPicks = 0;
						let leagueTotalPicks = 0;
						let leagueTotalTFSPoints = 0;
						let leagueBestWeekPoints = 0;

						picks.forEach((pick: any) => {
							console.log('[Stats] Processing pick for week', pick.week, ':', pick);
							// Check if all games in this week are finished (all picks have isCorrect defined)
							const allGamesFinished = pick.picks.every((p: any) => p.isCorrect !== undefined && p.isCorrect !== null);
							const totalPicksInWeek = pick.picks.length;
							const correctInWeek = pick.correctPicks || 0;

							console.log('[Stats] Week', pick.week, '- Games finished:', allGamesFinished, 'Total picks:', totalPicksInWeek, 'Correct:', correctInWeek);

							// Count finished games for stats
							if (allGamesFinished && totalPicksInWeek > 0) {
								leagueTotalPoints += pick.weeklyPoints || 0;
								leagueCorrectPicks += correctInWeek;
								leagueTotalPicks += totalPicksInWeek;
								leagueTotalTFSPoints += pick.tfsPoints || 0;
								leagueBestWeekPoints = Math.max(leagueBestWeekPoints, pick.weeklyPoints || 0);

								// Check for perfect week (all 5 picks correct and all games finished)
								const isPerfectWeek = totalPicksInWeek === 5 && correctInWeek === 5 && allGamesFinished;

								// Add to allWeeks for streak calculation
								allWeeks.push({
									week: pick.week,
									leagueId: league._id,
									correctPicks: correctInWeek,
									totalPicks: totalPicksInWeek,
									weeklyPoints: pick.weeklyPoints || 0,
									isPerfectWeek,
									allGamesFinished
								});

								// Track unique perfect weeks (same week across multiple leagues counts as one)
								if (isPerfectWeek) {
									perfectWeeksSet.add(`week-${pick.week}`);
								}

								if (pick.weeklyPoints === leagueBestWeekPoints && pick.weeklyPoints > allTimeData.bestWeekPoints) {
									allTimeData.bestWeekPoints = pick.weeklyPoints;
									allTimeData.bestWeekNumber = pick.week;
								}
							}
						});

						const weeksPlayed = picks.filter((p: any) => p.picks.every((pick: any) => pick.isCorrect !== undefined && pick.isCorrect !== null)).length;

						leagueStatsData.push({
							leagueId: league._id,
							leagueName: league.name,
							totalPoints: leagueTotalPoints,
							correctPicks: leagueCorrectPicks,
							totalPicks: leagueTotalPicks,
							totalTFSPoints: leagueTotalTFSPoints,
							winPercentage: leagueTotalPicks > 0 ? (leagueCorrectPicks / leagueTotalPicks) * 100 : 0,
							weeksPlayed,
							bestWeekPoints: leagueBestWeekPoints,
							currentStreak: 0,
							bestStreak: 0
						});

						allTimeData.totalPoints += leagueTotalPoints;
						allTimeData.correctPicks += leagueCorrectPicks;
						allTimeData.totalPicks += leagueTotalPicks;
						allTimeData.totalTFSPoints += leagueTotalTFSPoints;
						allTimeData.totalWeeksPlayed += weeksPlayed;
						allTimeData.totalWins += leagueCorrectPicks;
						allTimeData.totalLosses += leagueTotalPicks - leagueCorrectPicks;
					}
				} catch (error) {
					console.error('Error fetching stats for league:', league._id, error);
				}
			}

			// Calculate perfect weeks (unique weeks only)
			allTimeData.perfectWeeks = perfectWeeksSet.size;

			// Calculate streaks based on consecutive weeks
			// Group by week number and sum correct picks across all leagues for that week
			const weekMap = new Map<number, { correct: number; total: number }>();
			allWeeks.forEach(w => {
				const existing = weekMap.get(w.week) || { correct: 0, total: 0 };
				weekMap.set(w.week, {
					correct: existing.correct + w.correctPicks,
					total: existing.total + w.totalPicks
				});
			});

			// Sort weeks and calculate streaks
			const sortedWeeks = Array.from(weekMap.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([week, data]) => ({ week, ...data }));

			let currentStreak = 0;
			let bestStreak = 0;
			let tempStreak = 0;

			// Calculate best streak (any consecutive weeks with 60%+ win rate)
			for (let i = 0; i < sortedWeeks.length; i++) {
				const winRate = sortedWeeks[i].total > 0 ? sortedWeeks[i].correct / sortedWeeks[i].total : 0;
				if (winRate >= 0.6) {
					tempStreak++;
					bestStreak = Math.max(bestStreak, tempStreak);
				} else {
					tempStreak = 0;
				}
			}

			// Calculate current streak (from most recent week backwards)
			for (let i = sortedWeeks.length - 1; i >= 0; i--) {
				const winRate = sortedWeeks[i].total > 0 ? sortedWeeks[i].correct / sortedWeeks[i].total : 0;
				if (winRate >= 0.6) {
					currentStreak++;
				} else {
					break;
				}
			}

			allTimeData.currentStreak = currentStreak;
			allTimeData.bestStreak = bestStreak;

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

	// Achievement badges
	const getAchievements = () => {
		if (!allTimeStats) return [];
		const achievements = [];

		// Perfect Week - Get 5/5 picks correct in a week
		if (allTimeStats.perfectWeeks > 0) {
			achievements.push({ icon: Crown, label: 'Perfect Week', value: `${allTimeStats.perfectWeeks}x`, color: 'text-yellow-400' });
		}

		// Century Club - Reach 100 total points
		if (allTimeStats.totalPoints >= 100) {
			achievements.push({ icon: Trophy, label: 'Century Club', value: '100+ pts', color: 'text-primary' });
		}

		// Points Machine - Reach 200 total points
		if (allTimeStats.totalPoints >= 200) {
			achievements.push({ icon: Rocket, label: 'Points Machine', value: '200+ pts', color: 'text-pink-400' });
		}

		// Elite Picker - 60%+ win rate
		if (allTimeStats.winPercentage >= 60) {
			achievements.push({ icon: Star, label: 'Elite Picker', value: `${Math.round(allTimeStats.winPercentage)}%`, color: 'text-accent' });
		}

		// Sharpshooter - 80%+ win rate
		if (allTimeStats.winPercentage >= 80) {
			achievements.push({ icon: Crosshair, label: 'Sharpshooter', value: `${Math.round(allTimeStats.winPercentage)}%`, color: 'text-red-400' });
		}

		// Hot Streak - 5+ week winning streak
		if (allTimeStats.bestStreak >= 5) {
			achievements.push({ icon: Flame, label: 'Hot Streak', value: `${allTimeStats.bestStreak}`, color: 'text-orange-400' });
		}

		// Unstoppable - 10+ week winning streak
		if (allTimeStats.bestStreak >= 10) {
			achievements.push({ icon: Sparkles, label: 'Unstoppable', value: `${allTimeStats.bestStreak}`, color: 'text-yellow-300' });
		}

		// TFS Master - 20+ TFS bonus points
		if (allTimeStats.totalTFSPoints >= 20) {
			achievements.push({ icon: Zap, label: 'TFS Master', value: `${allTimeStats.totalTFSPoints}`, color: 'text-purple-400' });
		}

		// TFS Expert - 50+ TFS bonus points
		if (allTimeStats.totalTFSPoints >= 50) {
			achievements.push({ icon: Zap, label: 'TFS Expert', value: `${allTimeStats.totalTFSPoints}`, color: 'text-purple-300' });
		}

		// League Warrior - Join 3+ leagues
		if (allTimeStats.totalLeagues >= 3) {
			achievements.push({ icon: Users, label: 'League Warrior', value: `${allTimeStats.totalLeagues}`, color: 'text-blue-400' });
		}

		// Consistency King - Play 10+ weeks
		if (allTimeStats.totalWeeksPlayed >= 10) {
			achievements.push({ icon: Calendar, label: 'Consistency King', value: `${allTimeStats.totalWeeksPlayed} wks`, color: 'text-green-400' });
		}

		// Marathon Runner - Play 15+ weeks
		if (allTimeStats.totalWeeksPlayed >= 15) {
			achievements.push({ icon: Medal, label: 'Marathon Runner', value: `${allTimeStats.totalWeeksPlayed} wks`, color: 'text-teal-400' });
		}

		// Champion - 100+ correct picks
		if (allTimeStats.correctPicks >= 100) {
			achievements.push({ icon: Shield, label: 'Champion', value: `${allTimeStats.correctPicks}`, color: 'text-amber-400' });
		}

		// On Fire - Current streak of 3+ weeks
		if (allTimeStats.currentStreak >= 3) {
			achievements.push({ icon: Flame, label: 'On Fire', value: `${allTimeStats.currentStreak} now`, color: 'text-orange-500' });
		}

		return achievements;
	};

	const achievements = getAchievements();

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-7xl mx-auto space-y-8'>
				{/* Header */}
				<div className='text-center space-y-4 animate-fade-in'>
					<h1 className='text-4xl lg:text-5xl font-display font-bold gradient-text'>Your Performance</h1>
					<p className='text-xl text-muted-foreground max-w-2xl mx-auto'>Tracking your picks, wins, and domination</p>
				</div>

				{/* Achievements Banner */}
				{achievements.length > 0 && (
					<Card className='glass border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5'>
						<CardContent className='p-6'>
							<h3 className='text-lg font-semibold mb-4 flex items-center gap-2'>
								<Award className='h-5 w-5 text-primary' />
								<span>Achievements Unlocked</span>
							</h3>
							<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
								{achievements.map((achievement, i) => (
									<div key={i} className='text-center p-3 rounded-lg bg-card/50 border border-white/10 hover:border-primary/50 transition-all'>
										<achievement.icon className={`h-8 w-8 mx-auto mb-2 ${achievement.color}`} />
										<p className='text-xs font-semibold text-foreground'>{achievement.label}</p>
										<p className='text-sm font-bold text-primary'>{achievement.value}</p>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* Key Stats Grid */}
				{allTimeStats && (
					<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
						<Card className='glass border-white/10 hover:border-primary/50 transition-all'>
							<CardContent className='p-6 text-center space-y-2'>
								<div className='relative'>
									<Trophy className='h-10 w-10 text-yellow-400 mx-auto' />
									<Flame className='h-4 w-4 text-orange-400 absolute top-0 right-1/3 animate-pulse' />
								</div>
								<p className='text-4xl font-bold text-foreground'>{allTimeStats.totalPoints}</p>
								<p className='text-sm text-muted-foreground'>Total Points</p>
							</CardContent>
						</Card>

						<Card className='glass border-white/10 hover:border-green-500/50 transition-all'>
							<CardContent className='p-6 text-center space-y-2'>
								<Target className='h-10 w-10 text-green-400 mx-auto' />
								<p className='text-4xl font-bold text-green-400'>{Math.round(allTimeStats.winPercentage)}%</p>
								<p className='text-sm text-muted-foreground'>Win Rate</p>
								<div className='w-full bg-muted/30 rounded-full h-2 mt-2'>
									<div className='bg-green-400 h-2 rounded-full transition-all' style={{ width: `${allTimeStats.winPercentage}%` }} />
								</div>
							</CardContent>
						</Card>

						<Card className='glass border-white/10 hover:border-accent/50 transition-all'>
							<CardContent className='p-6 text-center space-y-2'>
								<TrendingUp className='h-10 w-10 text-accent mx-auto' />
								<p className='text-4xl font-bold text-foreground'>{allTimeStats.avgPointsPerWeek.toFixed(1)}</p>
								<p className='text-sm text-muted-foreground'>Avg/Week</p>
							</CardContent>
						</Card>

						<Card className='glass border-white/10 hover:border-purple-500/50 transition-all'>
							<CardContent className='p-6 text-center space-y-2'>
								<Zap className='h-10 w-10 text-purple-400 mx-auto' />
								<p className='text-4xl font-bold text-purple-400'>{allTimeStats.totalTFSPoints}</p>
								<p className='text-sm text-muted-foreground'>TFS Bonus</p>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Main Stats Breakdown */}
				<div className='grid lg:grid-cols-2 gap-6'>
					{/* Record Card */}
					<Card className='glass border-white/10'>
						<CardHeader>
							<CardTitle className='text-2xl font-display font-bold flex items-center gap-2'>
								<Trophy className='h-6 w-6 text-primary' />
								Your Record
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-4'>
							{allTimeStats && (
								<>
									<div className='flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-transparent border-l-4 border-green-500'>
										<span className='text-muted-foreground'>Correct Picks</span>
										<span className='text-3xl font-bold text-green-400'>{allTimeStats.correctPicks}</span>
									</div>
									<div className='flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-transparent border-l-4 border-red-500'>
										<span className='text-muted-foreground'>Incorrect Picks</span>
										<span className='text-3xl font-bold text-red-400'>{allTimeStats.totalPicks - allTimeStats.correctPicks}</span>
									</div>
									<div className='flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-primary'>
										<span className='text-muted-foreground'>Total Games Picked</span>
										<span className='text-3xl font-bold text-primary'>{allTimeStats.totalPicks}</span>
									</div>
									<div className='flex justify-between items-center p-4 rounded-lg bg-gradient-to-r from-accent/10 to-transparent border-l-4 border-accent'>
										<span className='text-muted-foreground'>Weeks Played</span>
										<span className='text-3xl font-bold text-accent'>{allTimeStats.totalWeeksPlayed}</span>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					{/* Performance Card */}
					<Card className='glass border-white/10'>
						<CardHeader>
							<CardTitle className='text-2xl font-display font-bold flex items-center gap-2'>
								<Flame className='h-6 w-6 text-orange-400' />
								Performance
							</CardTitle>
						</CardHeader>
						<CardContent className='space-y-4'>
							{allTimeStats && (
								<>
									<div className='p-4 rounded-lg bg-card/50 border border-white/10'>
										<div className='flex justify-between items-center mb-2'>
											<span className='text-sm text-muted-foreground'>Win Rate</span>
											<span className='text-2xl font-bold text-green-400'>{Math.round(allTimeStats.winPercentage)}%</span>
										</div>
										<div className='w-full bg-muted/30 rounded-full h-3'>
											<div className='bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all' style={{ width: `${allTimeStats.winPercentage}%` }} />
										</div>
									</div>

									{allTimeStats.perfectWeeks > 0 && (
										<div className='p-4 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50'>
											<div className='flex items-center justify-between'>
												<div className='flex items-center gap-2'>
													<Crown className='h-5 w-5 text-yellow-400' />
													<span className='text-foreground font-semibold'>Perfect Weeks</span>
												</div>
												<span className='text-2xl font-bold text-yellow-400'>{allTimeStats.perfectWeeks}</span>
											</div>
											<p className='text-xs text-muted-foreground mt-1'>All 5 picks correct!</p>
										</div>
									)}

									<div className='grid grid-cols-2 gap-4'>
										<div className='p-4 rounded-lg bg-card/50 border border-white/10 text-center'>
											<p className='text-xs text-muted-foreground mb-1'>Current Streak</p>
											<p className='text-3xl font-bold text-primary'>{allTimeStats.currentStreak}</p>
										</div>
										<div className='p-4 rounded-lg bg-card/50 border border-white/10 text-center'>
											<p className='text-xs text-muted-foreground mb-1'>Best Streak</p>
											<p className='text-3xl font-bold text-accent'>{allTimeStats.bestStreak}</p>
										</div>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</div>

				{/* League Breakdown */}
				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle className='text-2xl font-display font-bold'>League Performance</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							{leagueStats.length > 0 ? (
								leagueStats.map((stat, index) => (
									<div key={stat.leagueId} className='p-6 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/20 hover:border-primary/40 transition-all cursor-pointer group' onClick={() => router.push(`/league/${stat.leagueId}`)}>
										<div className='flex items-start justify-between mb-4'>
											<div className='flex items-center gap-3'>
												<div className='w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg'>
													#{index + 1}
												</div>
												<div>
													<h3 className='text-xl font-semibold text-primary group-hover:text-accent transition-colors'>{stat.leagueName}</h3>
													<p className='text-sm text-muted-foreground'>{stat.weeksPlayed} weeks • {stat.totalPicks} picks</p>
												</div>
											</div>
											<Award className='h-6 w-6 text-primary group-hover:text-accent transition-colors' />
										</div>

										<div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
											<div className='text-center p-3 rounded-lg bg-card/30'>
												<p className='text-xs text-muted-foreground mb-1'>Points</p>
												<p className='text-2xl font-bold text-foreground'>{stat.totalPoints}</p>
											</div>
											<div className='text-center p-3 rounded-lg bg-card/30'>
												<p className='text-xs text-muted-foreground mb-1'>Win %</p>
												<p className='text-2xl font-bold text-green-400'>{Math.round(stat.winPercentage)}%</p>
											</div>
											<div className='text-center p-3 rounded-lg bg-card/30'>
												<p className='text-xs text-muted-foreground mb-1'>Correct</p>
												<p className='text-2xl font-bold text-primary'>{stat.correctPicks}</p>
											</div>
											<div className='text-center p-3 rounded-lg bg-card/30'>
												<p className='text-xs text-muted-foreground mb-1'>Incorrect</p>
												<p className='text-2xl font-bold text-red-400'>{stat.totalPicks - stat.correctPicks}</p>
											</div>
											<div className='text-center p-3 rounded-lg bg-card/30'>
												<p className='text-xs text-muted-foreground mb-1'>TFS</p>
												<p className='text-2xl font-bold text-accent'>{stat.totalTFSPoints}</p>
											</div>
										</div>

										{/* Win rate bar */}
										<div className='mt-4'>
											<div className='w-full bg-muted/30 rounded-full h-2'>
												<div className='bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all' style={{ width: `${stat.winPercentage}%` }} />
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
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default StatsPage;
