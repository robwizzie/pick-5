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
import { Crown, Trophy, TrendingUp, Target, Zap, Users, BarChart3, Flame, Award, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';

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
	// Biggest upsets with full game data
	upsets: Array<{
		gameId: string;
		game: Game;
		team: string;
		opponent: string;
		odds: number;
		points: number;
		pickCount: number;
		correctPickers: Array<{ userId: string; name: string; image: string | null }>;
		leaguePicks: {
			away: Array<{ userId: string; name: string; image: string | null }>;
			home: Array<{ userId: string; name: string; image: string | null }>;
		};
	}>;
	// Most picked correct games
	mostPickedCorrect: Array<{
		gameId: string;
		game: Game;
		winningTeam: string;
		losingTeam: string;
		pickCount: number;
		totalPicks: number;
		pickers: Array<{ userId: string; name: string; image: string | null }>;
		leaguePicks: {
			away: Array<{ userId: string; name: string; image: string | null }>;
			home: Array<{ userId: string; name: string; image: string | null }>;
		};
	}>;
	// Most picked incorrect games
	mostPickedIncorrect: Array<{
		gameId: string;
		game: Game;
		losingTeam: string;
		winningTeam: string;
		pickCount: number;
		totalPicks: number;
		pickers: Array<{ userId: string; name: string; image: string | null }>;
		leaguePicks: {
			away: Array<{ userId: string; name: string; image: string | null }>;
			home: Array<{ userId: string; name: string; image: string | null }>;
		};
	}>;
	// Perfect week users
	perfectWeek: Array<{
		player: string;
		image: string | null;
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

// Helper function to check if recap is available for a week
export async function isRecapAvailable(week: number, leagueId: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/recap?week=${week}&leagueId=${leagueId}`, { cache: 'no-store' });
		if (!response.ok) return false;
		const data = await response.json();
		return data.hasPicks && data.weekCompleted;
	} catch {
		return false;
	}
}

export function Recap() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session } = useSession();
	const [selectedWeek, setSelectedWeek] = useState<number>(0); // Will be set to most recent available week
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
				const response = await fetch(`/api/league/${leagueId}`, { cache: 'no-store' });
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

	// Determine available weeks (weeks with completed games AND user picks)
	useEffect(() => {
		const determineAvailableWeeks = async () => {
			if (!leagueId) return;
			const weeks: number[] = [];
			// Check weeks up to and including current week (since current week might be completed)
			for (let w = 1; w <= currentWeek; w++) {
				// Check if recap is available (has picks and is completed)
				const available = await isRecapAvailable(w, leagueId);
				if (available) {
					weeks.push(w);
				}
			}
			setAvailableWeeks(weeks);
			// Default to current week from context (not most recent completed week)
			// Only fall back to most recent if current week doesn't have recap
			if (weeks.includes(currentWeek)) {
				setSelectedWeek(currentWeek);
			} else if (weeks.length > 0) {
				setSelectedWeek(weeks[weeks.length - 1]);
			} else {
				setSelectedWeek(0); // No weeks available
			}
		};
		determineAvailableWeeks();
	}, [currentWeek, leagueId]);

	// Fetch and calculate recap data
	useEffect(() => {
		const fetchRecap = async () => {
			if (!leagueId || selectedWeek < 1 || !session?.user?.id) {
				return;
			}

			try {
				setLoading(true);
				setError(null);

				// Fetch both leaderboard data and recap analytics in parallel
				const [leaderboardResponse, recapResponse] = await Promise.all([
					fetch(`/api/leaderboard?week=${selectedWeek}&leagueId=${leagueId}`, { cache: 'no-store' }),
					fetch(`/api/recap?week=${selectedWeek}&leagueId=${leagueId}`, { cache: 'no-store' })
				]);

				if (!leaderboardResponse.ok || !recapResponse.ok) {
					throw new Error('Failed to fetch recap data');
				}

				const leaderboardData = await leaderboardResponse.json();
				const recapAnalytics = await recapResponse.json();

				// Check if recap is available
				if (!recapAnalytics.hasPicks || !recapAnalytics.weekCompleted) {
					setError('Recap not available for this week yet.');
					return;
				}

				const { weeklyResults } = leaderboardData;

				// Also fetch previous week's standings for rank change calculation
				let previousWeekResults: Array<{ userId: string; points: number }> = [];
				if (selectedWeek > 1) {
					try {
						const prevResponse = await fetch(`/api/leaderboard?week=${selectedWeek - 1}&leagueId=${leagueId}`, { cache: 'no-store' });
						if (prevResponse.ok) {
							const prevData = await prevResponse.json();
							previousWeekResults = prevData.weeklyResults;
						}
					} catch {
						// Previous week data not available
					}
				}

				// Calculate all recap statistics
				const recap = calculateRecapData(
					weeklyResults,
					previousWeekResults,
					recapAnalytics,
					session.user.id,
					leagueMode
				);
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
		previousWeekResults: Array<{ userId: string; points: number }>,
		recapAnalytics: {
			upsets: RecapData['upsets'];
			mostPickedCorrect: RecapData['mostPickedCorrect'];
			mostPickedIncorrect: RecapData['mostPickedIncorrect'];
		},
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

		// Perfect week (5/5 correct picks)
		const perfectWeek = sorted
			.filter(r => r.correct === 5)
			.slice(0, 5)
			.map(r => ({
				player: r.player,
				image: r.image,
				points: r.points
			}));

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
			upsets: recapAnalytics.upsets,
			mostPickedCorrect: recapAnalytics.mostPickedCorrect,
			mostPickedIncorrect: recapAnalytics.mostPickedIncorrect,
			perfectWeek,
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
						<div className='flex flex-col sm:flex-row sm:items-center gap-3'>
							<span className='text-sm text-muted-foreground font-medium'>View Week:</span>
							<div className='flex items-center gap-2 flex-wrap'>
								{availableWeeks.map(week => {
									const getWeekLabel = () => {
										if (week === currentWeek) return 'Current Week';
										if (week === currentWeek - 1) return 'Last Week';
										if (week === currentWeek + 1) return 'Next Week';
										return null;
									};
									const weekLabel = getWeekLabel();

									return (
										<button
											key={week}
											onClick={() => setSelectedWeek(week)}
											className={`px-4 py-2 rounded-lg font-semibold transition-all ${
												selectedWeek === week
													? 'bg-primary text-black'
													: 'bg-card border-2 border-primary/20 text-primary hover:border-primary/40'
											}`}
										>
											<div className='flex flex-col items-center gap-0.5'>
												<span>Week {week}</span>
												{weekLabel && (
													<span className='text-[10px] text-muted-foreground font-normal'>{weekLabel}</span>
												)}
											</div>
										</button>
									);
								})}
							</div>
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

			{/* Craziest Upsets */}
			{recapData.upsets && recapData.upsets.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.4 }}
				>
					<Card className='border-2 border-orange-500/30 bg-orange-500/5'>
						<CardHeader>
							<CardTitle className='font-oswald text-xl uppercase tracking-wide text-orange-400 flex items-center gap-2'>
								<Flame className='h-5 w-5' />
								Craziest Upsets
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-6'>
								{recapData.upsets.slice(0, 3).map((upset, idx) => (
									<motion.div
										key={upset.gameId}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: 0.5 + idx * 0.1 }}
										className='space-y-3'
									>
										<div className='flex items-center justify-between mb-2'>
											<div>
												<p className='text-sm font-semibold text-foreground'>
													<span className='text-orange-400'>{upset.team}</span> beat {upset.opponent}
												</p>
												<p className='text-xs text-muted-foreground'>
													+{upset.odds} odds • Worth {upset.points} pts
												</p>
											</div>
											{upset.correctPickers.length > 0 && (
												<div className='text-right'>
													<p className='text-xs text-muted-foreground'>Called by:</p>
													<div className='flex items-center gap-1 justify-end mt-1'>
														{upset.correctPickers.slice(0, 3).map((picker, i) => (
															<Avatar key={picker.userId} className='w-6 h-6 border-2 border-card' style={{ zIndex: 3 - i }}>
																<AvatarImage src={picker.image || undefined} alt={picker.name} />
																<AvatarFallback className='bg-orange-500/20 text-orange-400 text-[10px] font-semibold'>
																	{picker.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
																</AvatarFallback>
															</Avatar>
														))}
														{upset.correctPickers.length > 3 && (
															<span className='text-xs text-orange-400 ml-1'>+{upset.correctPickers.length - 3}</span>
														)}
													</div>
												</div>
											)}
										</div>
										<GameCard
											game={upset.game}
											showScores={true}
											disabled={true}
											noHover={true}
											leagueMode={leagueMode}
											leaguePicks={upset.leaguePicks}
										/>
									</motion.div>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* Most Picked Correct (Standard Mode Only) */}
			{leagueMode === 'standard' && recapData.mostPickedCorrect && recapData.mostPickedCorrect.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.5 }}
				>
					<Card className='border-2 border-green-500/30 bg-green-500/5'>
						<CardHeader>
							<CardTitle className='font-oswald text-xl uppercase tracking-wide text-green-400 flex items-center gap-2'>
								<ThumbsUp className='h-5 w-5' />
								Most Picked Correctly
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-6'>
								{recapData.mostPickedCorrect.slice(0, 2).map((pick, idx) => (
									<motion.div
										key={pick.gameId}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: 0.6 + idx * 0.1 }}
										className='space-y-3'
									>
										<div className='flex items-center justify-between mb-2'>
											<div>
												<p className='text-sm font-semibold text-foreground'>
													<span className='text-green-400'>{pick.winningTeam}</span> beat {pick.losingTeam}
												</p>
												<p className='text-xs text-muted-foreground'>
													{pick.pickCount} of {pick.totalPicks} players picked correctly
												</p>
											</div>
										</div>
										<GameCard
											game={pick.game}
											showScores={true}
											disabled={true}
											noHover={true}
											leagueMode={leagueMode}
											leaguePicks={pick.leaguePicks}
										/>
									</motion.div>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>
			)}

			{/* Most Picked Incorrectly (Standard Mode Only) */}
			{leagueMode === 'standard' && recapData.mostPickedIncorrect && recapData.mostPickedIncorrect.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.6 }}
				>
					<Card className='border-2 border-red-500/30 bg-red-500/5'>
						<CardHeader>
							<CardTitle className='font-oswald text-xl uppercase tracking-wide text-red-400 flex items-center gap-2'>
								<ThumbsDown className='h-5 w-5' />
								Most Picked Incorrectly
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-6'>
								{recapData.mostPickedIncorrect.slice(0, 2).map((pick, idx) => (
									<motion.div
										key={pick.gameId}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.3, delay: 0.7 + idx * 0.1 }}
										className='space-y-3'
									>
										<div className='flex items-center justify-between mb-2'>
											<div>
												<p className='text-sm font-semibold text-foreground'>
													{pick.pickCount} players picked <span className='text-red-400'>{pick.losingTeam}</span>
												</p>
												<p className='text-xs text-muted-foreground'>
													But {pick.winningTeam} won
												</p>
											</div>
										</div>
										<GameCard
											game={pick.game}
											showScores={true}
											disabled={true}
											noHover={true}
											leagueMode={leagueMode}
											leaguePicks={pick.leaguePicks}
										/>
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
