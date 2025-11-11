'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { NFLService } from '@/services/nflService';
import { Crown, Trophy, TrendingUp, Target, Zap, Users, BarChart3, Flame, Award } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface RecapData {
	// User's performance
	userStats: {
		rank: number;
		points: number;
		correct: number;
		total: number;
		tfsPoints?: number;
		rankChange?: number; // Compared to previous week
	};
	// Top performers
	topPerformers: Array<{
		player: string;
		image: string | null;
		points: number;
		correct: number;
	}>;
	// Most popular picks
	popularPicks: Array<{
		team: string;
		opponent: string;
		pickCount: number;
		totalPlayers: number;
		wasCorrect: boolean;
		odds?: number;
	}>;
	// Biggest upsets
	upsets: Array<{
		team: string;
		opponent: string;
		odds: number;
		points: number;
		pickCount: number;
	}>;
	// Perfect week users
	perfectWeek: Array<{
		player: string;
		image: string | null;
		points: number;
	}>;
	// Contrarian picks (picked against consensus and won)
	contrarians: Array<{
		player: string;
		image: string | null;
		team: string;
		opponent: string;
		pickCount: number; // How many picked this team
		totalPlayers: number;
		points: number;
	}>;
	// League stats
	leagueStats: {
		totalPlayers: number;
		avgPoints: number;
		avgCorrect: number;
		accuracy: number;
		highScore: number;
	};
	// Week highlights
	highlights: string[];
}

export function Recap() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session } = useSession();
	const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek - 1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [recapData, setRecapData] = useState<RecapData | null>(null);
	const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
	const [leagueMode, setLeagueMode] = useState<string>('standard');

	// Fetch league mode
	useEffect(() => {
		const fetchLeagueDetails = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const data = await response.json();
					setLeagueMode(data.mode || 'standard');
				}
			} catch (error) {
				console.error('[Recap] Error fetching league details:', error);
			}
		};
		fetchLeagueDetails();
	}, [leagueId]);

	// Determine available weeks (completed weeks only)
	useEffect(() => {
		const determineAvailableWeeks = async () => {
			const weeks: number[] = [];
			for (let w = 1; w < currentWeek; w++) {
				const games = await NFLService.getWeeklyGames(w);
				const allCompleted = games.every(g => {
					const status = g.status?.toLowerCase();
					return status === 'final' || status === 'status_final' || status === 'post';
				});
				if (allCompleted && games.length > 0) {
					weeks.push(w);
				}
			}
			setAvailableWeeks(weeks);
			// Default to most recent completed week
			if (weeks.length > 0) {
				setSelectedWeek(weeks[weeks.length - 1]);
			}
		};
		determineAvailableWeeks();
	}, [currentWeek]);

	// Fetch and calculate recap data
	useEffect(() => {
		const fetchRecap = async () => {
			if (!leagueId || selectedWeek < 1 || !session?.user?.id) {
				return;
			}

			try {
				setLoading(true);
				setError(null);

				// Fetch leaderboard data for selected week
				const response = await fetch(`/api/leaderboard?week=${selectedWeek}&leagueId=${leagueId}`);
				if (!response.ok) throw new Error('Failed to fetch recap data');

				const data = await response.json();
				const { weeklyResults, seasonStats } = data;

				// Fetch game results for the week
				const games = await NFLService.getWeeklyGames(selectedWeek);

				// Also fetch previous week's standings for rank change calculation
				let previousWeekResults: Array<{ userId: string; points: number }> = [];
				if (selectedWeek > 1) {
					try {
						const prevResponse = await fetch(`/api/leaderboard?week=${selectedWeek - 1}&leagueId=${leagueId}`);
						if (prevResponse.ok) {
							const prevData = await prevResponse.json();
							previousWeekResults = prevData.weeklyResults;
						}
					} catch {
						// Previous week data not available
					}
				}

				// Calculate all recap statistics
				const recap = calculateRecapData(weeklyResults, seasonStats, games, previousWeekResults, session.user.id, leagueMode);
				setRecapData(recap);
			} catch (err) {
				console.error('[Recap] Failed to load recap:', err);
				setError('Failed to load weekly recap.');
			} finally {
				setLoading(false);
			}
		};

		fetchRecap();
	}, [selectedWeek, leagueId, session?.user?.id, leagueMode]);

	const calculateRecapData = (
		weeklyResults: Array<{ userId: string; player: string; image: string | null; points: number; correct: number; tfsPoints: number; hasPicks: boolean }>,
		seasonStats: Array<{ player: string; image: string | null; totalPoints: number }>,
		games: Array<{ id: string; status?: string }>,
		previousWeekResults: Array<{ userId: string; points: number }>,
		currentUserId: string,
		mode: string
	): RecapData => {
		// Sort by points
		const sorted = [...weeklyResults].sort((a, b) => b.points - a.points);

		// User's stats
		const userResult = weeklyResults.find(r => r.userId === currentUserId);
		const userRank = sorted.findIndex(r => r.userId === currentUserId) + 1;
		let rankChange = 0;

		if (previousWeekResults.length > 0) {
			const prevSorted = [...previousWeekResults].sort((a, b) => b.points - a.points);
			const prevRank = prevSorted.findIndex(r => r.userId === currentUserId) + 1;
			if (prevRank > 0) {
				rankChange = prevRank - userRank; // Positive = improved
			}
		}

		const userStats = {
			rank: userRank,
			points: userResult?.points || 0,
			correct: userResult?.correct || 0,
			total: 5, // Always 5 picks
			tfsPoints: userResult?.tfsPoints || 0,
			rankChange
		};

		// Top 3 performers
		const topPerformers = sorted.slice(0, 3).map(r => ({
			player: r.player,
			image: r.image,
			points: r.points,
			correct: r.correct
		}));

		// Most popular picks - need to fetch all user picks
		// For now, we'll calculate from available data (this would ideally be done server-side)
		const popularPicks: RecapData['popularPicks'] = [];

		// Perfect week (5/5 in steve mode, or all correct in standard)
		const perfectWeek = sorted
			.filter(r => r.correct === 5)
			.slice(0, 5)
			.map(r => ({
				player: r.player,
				image: r.image,
				points: r.points
			}));

		// Upsets - teams with high odds that won (this would need game data with odds)
		const upsets: RecapData['upsets'] = [];

		// Contrarians - users who picked against popular consensus
		const contrarians: RecapData['contrarians'] = [];

		// League stats
		const totalPlayers = weeklyResults.length;
		const totalPoints = weeklyResults.reduce((sum, r) => sum + r.points, 0);
		const totalCorrect = weeklyResults.reduce((sum, r) => sum + r.correct, 0);
		const totalPicks = totalPlayers * 5;

		const leagueStats = {
			totalPlayers,
			avgPoints: totalPlayers > 0 ? Math.round((totalPoints / totalPlayers) * 10) / 10 : 0,
			avgCorrect: totalPlayers > 0 ? Math.round((totalCorrect / totalPlayers) * 10) / 10 : 0,
			accuracy: totalPicks > 0 ? Math.round((totalCorrect / totalPicks) * 100) : 0,
			highScore: sorted[0]?.points || 0
		};

		// Generate highlights
		const highlights: string[] = [];

		if (perfectWeek.length > 0) {
			if (perfectWeek.length === 1) {
				highlights.push(`🎯 ${perfectWeek[0].player} went perfect with 5/5 correct picks!`);
			} else {
				highlights.push(`🎯 ${perfectWeek.length} players achieved a perfect week!`);
			}
		}

		if (leagueStats.accuracy < 50) {
			highlights.push(`😱 Upset city! League accuracy was only ${leagueStats.accuracy}% this week.`);
		} else if (leagueStats.accuracy > 70) {
			highlights.push(`🔮 The favorites dominated - league accuracy hit ${leagueStats.accuracy}%!`);
		}

		if (sorted[0] && sorted.length > 1) {
			const gap = sorted[0].points - (sorted[1]?.points || 0);
			if (gap >= 10) {
				highlights.push(`👑 ${sorted[0].player} dominated with a ${gap}-point lead!`);
			}
		}

		if (userStats.rankChange > 3) {
			highlights.push(`📈 You climbed ${userStats.rankChange} spots in the standings!`);
		} else if (userStats.rankChange < -3) {
			highlights.push(`📉 Tough week - you dropped ${Math.abs(userStats.rankChange)} spots.`);
		}

		const avgPointsRounded = Math.round(leagueStats.avgPoints);
		if (mode === 'standard') {
			if (avgPointsRounded < 8) {
				highlights.push(`💤 Conservative week - average score was only ${avgPointsRounded} points.`);
			} else if (avgPointsRounded > 15) {
				highlights.push(`🚀 Big upset week! Average score soared to ${avgPointsRounded} points.`);
			}
		}

		return {
			userStats,
			topPerformers,
			popularPicks,
			upsets,
			perfectWeek,
			contrarians,
			leagueStats,
			highlights
		};
	};

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {selectedWeek} Recap</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='flex items-center justify-center py-12'>
						<Spinner />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error || !recapData) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {selectedWeek} Recap</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='text-center py-12'>
						<p className='text-muted-foreground'>{error || 'No recap data available for this week.'}</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className='space-y-6'>
			{/* Week Selector */}
			{availableWeeks.length > 1 && (
				<Card>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-2 flex-wrap'>
							<span className='text-sm text-muted-foreground font-medium'>View Week:</span>
							{availableWeeks.map(week => (
								<button
									key={week}
									onClick={() => setSelectedWeek(week)}
									className={`px-4 py-2 rounded-lg font-semibold transition-all ${
										selectedWeek === week
											? 'bg-primary text-black'
											: 'bg-card border-2 border-primary/20 text-primary hover:border-primary/40'
									}`}
								>
									Week {week}
								</button>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Week Highlights */}
			{recapData.highlights.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<Card className='border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5'>
						<CardHeader>
							<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary flex items-center gap-2'>
								<Flame className='h-5 w-5' />
								Week {selectedWeek} Highlights
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-2'>
								{recapData.highlights.map((highlight, idx) => (
									<motion.p
										key={idx}
										className='text-foreground text-sm md:text-base'
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: idx * 0.1 }}
									>
										{highlight}
									</motion.p>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* Your Performance */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.1 }}
			>
				<Card className='border-2 border-primary/20'>
					<CardHeader>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary flex items-center gap-2'>
							<Target className='h-5 w-5' />
							Your Performance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Trophy className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Rank</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.userStats.rank} duration={0.8} />
								</p>
								{recapData.userStats.rankChange !== undefined && recapData.userStats.rankChange !== 0 && (
									<p className={`text-xs mt-1 font-semibold ${recapData.userStats.rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
										{recapData.userStats.rankChange > 0 ? '↑' : '↓'} {Math.abs(recapData.userStats.rankChange)}
									</p>
								)}
							</div>

							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Zap className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Points</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.userStats.points} duration={0.8} />
								</p>
							</div>

							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Target className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Correct</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.userStats.correct} duration={0.8} />/{recapData.userStats.total}
								</p>
							</div>

							{leagueMode === 'steve' && (
								<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
									<div className='flex items-center justify-center gap-2 mb-2'>
										<Award className='h-4 w-4 text-primary' />
										<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>TFS</p>
									</div>
									<p className='text-3xl font-bold font-mono text-primary'>
										<CountUp end={recapData.userStats.tfsPoints || 0} duration={0.8} />
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Top Performers */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.2 }}
			>
				<Card className='border-2 border-primary/20'>
					<CardHeader>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary flex items-center gap-2'>
							<Crown className='h-5 w-5 text-yellow-400' fill='currentColor' />
							Top Performers
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='space-y-3'>
							{recapData.topPerformers.map((performer, idx) => {
								const getRankStyle = () => {
									if (idx === 0) return 'border-yellow-500/30 bg-yellow-500/5 shadow-[0_0_15px_rgba(234,179,8,0.15)]';
									if (idx === 1) return 'border-gray-400/30 bg-gray-400/5 shadow-[0_0_10px_rgba(156,163,175,0.15)]';
									if (idx === 2) return 'border-orange-500/30 bg-orange-400/5 shadow-[0_0_10px_rgba(249,115,22,0.15)]';
									return 'border-primary/20';
								};

								const getMedalColor = () => {
									if (idx === 0) return 'text-yellow-400';
									if (idx === 1) return 'text-gray-300';
									if (idx === 2) return 'text-orange-400';
									return 'text-primary';
								};

								return (
									<motion.div
										key={idx}
										className={`flex items-center justify-between p-4 rounded-lg border-2 ${getRankStyle()}`}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: 0.3 + idx * 0.1 }}
									>
										<div className='flex items-center gap-3'>
											<div className={`text-2xl font-bold ${getMedalColor()}`}>
												{idx === 0 && '🥇'}
												{idx === 1 && '🥈'}
												{idx === 2 && '🥉'}
											</div>
											<Avatar className='w-10 h-10'>
												<AvatarImage src={performer.image || undefined} alt={performer.player} />
												<AvatarFallback className='bg-primary/20 text-primary font-semibold'>
													{performer.player.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
												</AvatarFallback>
											</Avatar>
											<div>
												<p className='font-semibold text-foreground'>{performer.player}</p>
												<p className='text-xs text-muted-foreground'>{performer.correct}/5 correct</p>
											</div>
										</div>
										<div className='text-right'>
											<p className='text-2xl font-bold font-mono text-primary'>{performer.points}</p>
											<p className='text-xs text-muted-foreground'>points</p>
										</div>
									</motion.div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</motion.div>

			{/* Perfect Week Club */}
			{recapData.perfectWeek.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.3 }}
				>
					<Card className='border-2 border-green-500/30 bg-green-500/5'>
						<CardHeader>
							<CardTitle className='font-oswald text-xl uppercase tracking-wide text-green-400 flex items-center gap-2'>
								<Target className='h-5 w-5' />
								Perfect Week Club (5/5)
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='flex flex-wrap gap-3'>
								{recapData.perfectWeek.map((player, idx) => (
									<motion.div
										key={idx}
										className='flex items-center gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm rounded-full border-2 border-green-500/30'
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
									>
										<Avatar className='w-8 h-8'>
											<AvatarImage src={player.image || undefined} alt={player.player} />
											<AvatarFallback className='bg-green-500/20 text-green-400 font-semibold text-xs'>
												{player.player.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
											</AvatarFallback>
										</Avatar>
										<span className='font-semibold text-foreground text-sm'>{player.player}</span>
										<span className='text-xs text-green-400 font-bold'>({player.points} pts)</span>
									</motion.div>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* League Statistics */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.4 }}
			>
				<Card className='border-2 border-primary/20'>
					<CardHeader>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary flex items-center gap-2'>
							<BarChart3 className='h-5 w-5' />
							League Statistics
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Users className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Players</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.leagueStats.totalPlayers} duration={0.8} />
								</p>
							</div>

							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<TrendingUp className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Avg Points</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.leagueStats.avgPoints} duration={0.8} decimals={1} />
								</p>
							</div>

							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Target className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>Accuracy</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.leagueStats.accuracy} duration={0.8} />%
								</p>
							</div>

							<div className='text-center p-4 bg-card/80 backdrop-blur-sm rounded-lg border-2 border-primary/20'>
								<div className='flex items-center justify-center gap-2 mb-2'>
									<Zap className='h-4 w-4 text-primary' />
									<p className='text-xs text-primary/80 uppercase tracking-wide font-medium'>High Score</p>
								</div>
								<p className='text-3xl font-bold font-mono text-primary'>
									<CountUp end={recapData.leagueStats.highScore} duration={0.8} />
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		</div>
	);
}
