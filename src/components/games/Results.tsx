'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { PickGameCard } from './PickGameCard';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';
import { NFLService } from '@/services/nflService';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { hasGameFinished, hasGameStarted } from '@/services/gameUtils';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface WeeklyPicks {
	picks: Array<{
		gameId: string;
		team: string;
		opponent: string;
		isHome: boolean;
		odds?: number;
	}>;
	tfsGame: string;
	tfsScore: string;
	submitted: boolean;
}

interface UserPick {
	_id: string;
	userId: string;
	name: string;
	image: string | null;
}

interface LeaguePicksData {
	[gameId: string]: {
		away: UserPick[];
		home: UserPick[];
	};
}

export function Results() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session, status: sessionStatus } = useSession();
	const [picks, setPicks] = useState<WeeklyPicks | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [leaguePicks, setLeaguePicks] = useState<LeaguePicksData>({});
	const [leagueMode, setLeagueMode] = useState<string>('standard');
	const [leagueMembers, setLeagueMembers] = useState<UserPick[]>([]);
	const [selectedUserId, setSelectedUserId] = useState<string>('');

	// Fetch league mode
	useEffect(() => {
		const fetchLeagueMode = async () => {
			if (!leagueId) return;

			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const leagueData = await response.json();
					setLeagueMode(leagueData.mode || 'standard');
				}
			} catch (error) {
				console.error('Error fetching league mode:', error);
			}
		};

		fetchLeagueMode();
	}, [leagueId]);

	// Fetch league members
	useEffect(() => {
		const fetchLeagueMembers = async () => {
			if (!leagueId) return;

			try {
				const response = await fetch(`/api/league/${leagueId}/members`);
				if (response.ok) {
					const members = await response.json();
					setLeagueMembers(members);
					// Set current user as default selected
					if (session?.user?.id && !selectedUserId) {
						setSelectedUserId(session.user.id);
					}
				}
			} catch (error) {
				console.error('Error fetching league members:', error);
			}
		};

		if (session?.user) {
			fetchLeagueMembers();
		}
	}, [leagueId, session?.user, selectedUserId]);

	useEffect(() => {
		const loadData = async (isPolling = false) => {
			if (sessionStatus === 'loading') return;
			if (!selectedUserId) return; // Wait for user selection

			try {
				if (!leagueId) {
					console.error('[Results] Missing leagueId');
					setError('League ID is missing.');
					return;
				}

				// Show updating indicator for polling updates (not initial load)
				if (isPolling) {
					setIsUpdating(true);
				} else {
					setLoading(true);
				}

				// Handle "All Games" view differently
				if (selectedUserId === 'all-games') {
					const [weeklyGames, leaguePicksResponse] = await Promise.all([
						NFLService.getWeeklyGames(currentWeek),
						fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' })
					]);

					const leaguePicksData = await leaguePicksResponse.json();

					// Fetch odds for Standard mode leagues
					let gamesWithOdds = weeklyGames;
					if (leagueMode === 'standard') {
						try {
							const oddsResponse = await fetch(`/api/odds/snapshot?week=${currentWeek}`);
							let snapshotOdds = [];
							if (oddsResponse.ok) {
								const data = await oddsResponse.json();
								snapshotOdds = data.odds || [];
							}

							gamesWithOdds = weeklyGames.map(game => {
								const snapshotGameOdds = snapshotOdds.find((o: any) => o.id === game.id);
								const homeOdds = snapshotGameOdds?.home?.odds;
								const awayOdds = snapshotGameOdds?.away?.odds;

								if (homeOdds || awayOdds) {
									return {
										...game,
										home: { ...game.home, odds: homeOdds },
										away: { ...game.away, odds: awayOdds }
									};
								}
								return game;
							});
						} catch (error) {
							console.error('[Results] Error fetching odds:', error);
						}
					}

					setGames(gamesWithOdds);
					setPicks(null); // No specific user picks
					setLeaguePicks(leaguePicksData);
					setLastUpdated(new Date());
					setLoading(false);
					setIsUpdating(false);
					return;
				}

				// Pass leagueId and userId to the backend
				const [weeklyGames, picksResponse, leaguePicksResponse] = await Promise.all([
					NFLService.getWeeklyGames(currentWeek),
					fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}&userId=${selectedUserId}`, { cache: 'no-store' }),
					fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' })
				]);

				const picksData = await picksResponse.json();
				const leaguePicksData = await leaguePicksResponse.json();

				// Fetch odds for Standard mode leagues (same logic as WeeklyPicks)
				let gamesWithOdds = weeklyGames;
				if (leagueMode === 'standard') {
					try {
						// Fetch odds from centralized snapshot
						const oddsResponse = await fetch(`/api/odds/snapshot?week=${currentWeek}`);
						let snapshotOdds = [];
						if (oddsResponse.ok) {
							const data = await oddsResponse.json();
							snapshotOdds = data.odds || [];
						}

						// Match odds to games
						gamesWithOdds = weeklyGames.map(game => {
							const snapshotGameOdds = snapshotOdds.find((o: any) => o.id === game.id);

							const homeOdds = snapshotGameOdds?.home?.odds;
							const awayOdds = snapshotGameOdds?.away?.odds;

							if (homeOdds || awayOdds) {
								return {
									...game,
									home: { ...game.home, odds: homeOdds },
									away: { ...game.away, odds: awayOdds }
								};
							}
							return game;
						});
					} catch (error) {
						console.error('[Results] Error fetching odds:', error);
					}
				}

				setGames(gamesWithOdds);
				setPicks(picksData);
				setLeaguePicks(leaguePicksData);
				setLastUpdated(new Date());

				// Trigger refresh events for leaderboard and season stats
				// The /api/picks endpoint recalculates scores, so we need to notify other components
				if (isPolling) {
					console.log('[Results] Auto-refresh: Triggering leaderboard and stats updates');
				}
				window.dispatchEvent(new Event('refreshLeaderboard'));
				window.dispatchEvent(new Event('refreshSeasonStats'));
			} catch (err) {
				console.error('[Results] Error loading results:', err);
				setError('Error loading results');
			} finally {
				setLoading(false);
				setIsUpdating(false);
			}
		};

		loadData(false); // Initial load

		// Use smart polling interval based on game schedule
		// 2 minutes during games, 5 minutes outside game windows
		const pollingInterval = NFLService.getPollingInterval();
		console.log(`[Results] Using ${pollingInterval / 1000 / 60} minute polling interval`);

		const pollInterval = setInterval(() => {
			console.log('[Results] 🔄 Auto-refreshing scores...');
			loadData(true); // Polling update
		}, pollingInterval);

		return () => clearInterval(pollInterval);
	}, [currentWeek, sessionStatus, leagueId, selectedUserId]);

	// Game score calculation utility
	const getGameScore = (game: Game) => ({
		home: typeof game.home.score === 'number' ? game.home.score : undefined,
		away: typeof game.away.score === 'number' ? game.away.score : undefined,
		total: typeof game.home.score === 'number' && typeof game.away.score === 'number' && game.home.score !== undefined && game.away.score !== undefined ? game.home.score + game.away.score : undefined
	});

	// Determine game status - check for in_progress, completed, or pending
	const checkGameStatus = (game: Game): 'completed' | 'in_progress' | 'pending' => {
		if (hasGameFinished(game)) return 'completed';
		const status = game.status?.toLowerCase();
		if (status === 'in' || status === 'in_progress') return 'in_progress';
		return 'pending';
	};

	// Check if a pick is correct - only returns true/false if game is finished
	const checkPickCorrect = (pick: WeeklyPicks['picks'][0], game: Game): boolean | null => {
		if (!hasGameFinished(game)) {
			return null;
		}

		const homeScore = game.home.score;
		const awayScore = game.away.score;

		if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore === undefined || awayScore === undefined) {
			return null;
		}

		const homeWon = homeScore > awayScore;
		const pickedHome = pick.team === game.home.team;
		return (pickedHome && homeWon) || (!pickedHome && !homeWon);
	};

	// Calculate TFS (Total Final Score) points
	const getTFSPoints = (predictedScore: number, actualScore: number) => {
		const difference = Math.abs(predictedScore - actualScore);
		if (difference === 0) return 5;
		if (difference <= 3) return 4;
		if (difference <= 5) return 3;
		if (difference <= 7) return 2;
		if (difference <= 10) return 1;
		return 0;
	};

	const getTextColor = (points: number) => {
		if (points > 0) return 'text-green-500';
		if (points < 0) return 'text-red-500';
		return 'text-muted-foreground';
	};

	// Memoized results calculation
	const results = useMemo(() => {
		if (!picks || !games.length)
			return {
				liveGames: [],
				upcomingGames: [],
				pastGames: [],
				totalPoints: 0,
				correctPicks: 0,
				tfsPoints: 0
			};

		let totalPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;

		// Process game picks and organize by status
		const allGameElements = picks.picks.map((pick, index) => {
			const game = games.find(g => g.id === pick.gameId);
			if (!game) return null;

			// If viewing another user's picks, hide games that haven't started (to prevent pick stealing)
			const isViewingOtherUser = selectedUserId !== session?.user?.id;
			if (isViewingOtherUser && !hasGameStarted(game)) {
				return null;
			}

			const gameStatus = checkGameStatus(game);
			const isCorrect = checkPickCorrect(pick, game);
			const gameFinished = hasGameFinished(game);
			const gameInProgress = gameStatus === 'in_progress';

			//  Calculate points based on league mode
			let pickPoints = 0;
			if (gameFinished && isCorrect === true) {
				if (leagueMode === 'standard' && pick.odds !== undefined) {
					pickPoints = calculatePointsFromOdds(pick.odds);
				} else {
					pickPoints = 2; // Steve mode default
				}
				totalPoints += pickPoints;
				correctPicks += 1;
			}

			// Show scores for both finished games AND in-progress games
			const shouldShowScores = gameFinished || gameInProgress;

			return (
				<PickGameCard
					key={pick.gameId}
					game={game}
					pick={pick}
					pickIndex={index}
					gameFinished={gameFinished}
					gameInProgress={gameInProgress}
					showScores={shouldShowScores}
					isCorrect={isCorrect}
					pickPoints={pickPoints}
					leaguePicks={leaguePicks[pick.gameId]}
					leagueMode={leagueMode}
					variant="results"
				/>
			);
		}).filter(Boolean);

		// Organize games by status
		const liveGames = allGameElements.filter((element: any) => {
			if (!element) return false;
			const game = games.find(g => g.id === element.key);
			if (!game) return false;
			const status = game.status?.toLowerCase();
			return status === 'in' || status === 'in_progress';
		});

		const upcomingGames = allGameElements.filter((element: any) => {
			if (!element) return false;
			const game = games.find(g => g.id === element.key);
			if (!game) return false;
			const status = game.status?.toLowerCase();
			return status === 'pre' || status === 'scheduled' || !status;
		});

		const pastGames = allGameElements.filter((element: any) => {
			if (!element) return false;
			const game = games.find(g => g.id === element.key);
			if (!game) return false;
			const status = game.status?.toLowerCase();
			return status === 'post' || status === 'final';
		});

		// Calculate TFS points (only if game is finished)
		if (picks.tfsGame) {
			const tfsGame = games.find(g => g.id === picks.tfsGame);
			if (tfsGame && hasGameFinished(tfsGame)) {
				const scores = getGameScore(tfsGame);
				if (scores.total !== undefined) {
					const predictedScore = parseInt(picks.tfsScore);
					tfsPoints = getTFSPoints(predictedScore, scores.total);
					totalPoints += tfsPoints;
				}
			}
		}

		return {
			liveGames,
			upcomingGames,
			pastGames,
			totalPoints,
			correctPicks,
			tfsPoints
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [picks, games, selectedUserId, session?.user?.id]);

	if (sessionStatus === 'loading' || loading) {
		return (
			<Card>
				<CardContent className='p-6'>
					<div className='flex items-center justify-center'>
						<Spinner />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!session) {
		return (
			<Card>
				<CardContent className='p-6'>
					<Alert>
						<AlertDescription>Please sign in to view results</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	// Helper function to format time ago
	const getTimeAgo = (date: Date | null) => {
		if (!date) return '';
		const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	};

	// Handle "All Games" view
	if (selectedUserId === 'all-games') {
		// Organize games by status
		const liveGames = games.filter(g => {
			const status = g.status?.toLowerCase();
			return status === 'in' || status === 'in_progress';
		});

		const upcomingGames = games.filter(g => {
			const status = g.status?.toLowerCase();
			return status === 'pre' || status === 'scheduled' || !status;
		});

		const finalGames = games.filter(g => {
			const status = g.status?.toLowerCase();
			return status === 'post' || status === 'final';
		});

		return (
			<Card className='bg-card border-primary/20'>
				<CardHeader>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4'>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} - All Games</CardTitle>
						<Select value={selectedUserId} onValueChange={setSelectedUserId}>
							<SelectTrigger className='w-full sm:w-[200px]'>
								<SelectValue placeholder='Select user' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all-games' className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
									<div className='flex items-center gap-2'>
										<span className='font-semibold text-primary'>All Games</span>
									</div>
								</SelectItem>
								{leagueMembers.map(member => (
									<SelectItem key={member._id} value={member._id} className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
										<div className='flex items-center gap-2'>
											<Avatar className='w-5 h-5'>
												<AvatarImage src={member.image || undefined} alt={member.name} />
												<AvatarFallback className='text-[10px]'>{member.name.charAt(0)}</AvatarFallback>
											</Avatar>
											<span>{member.name}</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className='flex items-center justify-between'>
						<div></div>
						<div className='flex items-center gap-2'>
							{isUpdating && (
								<div className='flex items-center gap-1 text-xs text-primary/80'>
									<div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
									<span>Updating...</span>
								</div>
							)}
							{!isUpdating && lastUpdated && (
								<div className='flex items-center gap-1 text-xs text-muted-foreground'>
									<div className='h-2 w-2 rounded-full bg-green-500' />
									<span>Live • {getTimeAgo(lastUpdated)}</span>
								</div>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className='space-y-6'>
						{/* Live Games */}
						{liveGames.length > 0 && (
							<div>
								<div className='flex items-center gap-2 mb-3'>
									<div className='h-2 w-2 rounded-full bg-green-500 animate-pulse' />
									<h4 className='text-md font-semibold text-green-400 uppercase tracking-wide'>Live Games</h4>
								</div>
								<div className='space-y-3'>
									{liveGames.map((game, index) => (
										<motion.div
											key={game.id}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											<GameCard
												game={game}
												showScores={true}
												disabled={true}
												noHover={true}
												leaguePicks={leaguePicks[game.id]}
												leagueMode={leagueMode}
											/>
										</motion.div>
									))}
								</div>
							</div>
						)}

						{/* Upcoming Games */}
						{upcomingGames.length > 0 && (
							<div>
								<h4 className='text-md font-semibold text-primary uppercase tracking-wide mb-3'>Upcoming Games</h4>
								<div className='space-y-3'>
									{upcomingGames.map((game, index) => (
										<motion.div
											key={game.id}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											<GameCard
												game={game}
												showScores={false}
												disabled={true}
												noHover={true}
												leaguePicks={leaguePicks[game.id]}
												leagueMode={leagueMode}
											/>
										</motion.div>
									))}
								</div>
							</div>
						)}

						{/* Final Games */}
						{finalGames.length > 0 && (
							<div>
								<h4 className='text-md font-semibold text-muted-foreground uppercase tracking-wide mb-3'>Final</h4>
								<div className='space-y-3'>
									{finalGames.map((game, index) => (
										<motion.div
											key={game.id}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											<GameCard
												game={game}
												showScores={true}
												disabled={true}
												noHover={true}
												leaguePicks={leaguePicks[game.id]}
												leagueMode={leagueMode}
											/>
										</motion.div>
									))}
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!picks || !picks.picks.length) {
		return (
			<Card className='bg-card border-primary/20'>
				<CardHeader>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4'>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Results</CardTitle>
						<Select value={selectedUserId} onValueChange={setSelectedUserId}>
							<SelectTrigger className='w-full sm:w-[200px]'>
								<SelectValue placeholder='Select user' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='all-games' className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
									<div className='flex items-center gap-2'>
										<span className='font-semibold text-primary'>All Games</span>
									</div>
								</SelectItem>
								{leagueMembers.map(member => (
									<SelectItem key={member._id} value={member._id} className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
										<div className='flex items-center gap-2'>
											<Avatar className='w-5 h-5'>
												<AvatarImage src={member.image || undefined} alt={member.name} />
												<AvatarFallback className='text-[10px]'>{member.name.charAt(0)}</AvatarFallback>
											</Avatar>
											<span>{member.name}</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
				<CardContent>
					<Alert variant='destructive' className='mb-4'>
						<AlertDescription>
							{selectedUserId === session?.user?.id
								? 'No picks were made for this week.'
								: `${leagueMembers.find(m => m._id === selectedUserId)?.name || 'This user'} has not made picks for this week.`}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className='bg-card border-primary/20'>
			<CardHeader>
				<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Results</CardTitle>
					<Select value={selectedUserId} onValueChange={setSelectedUserId}>
						<SelectTrigger className='w-full sm:w-[200px]'>
							<SelectValue placeholder='Select user' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all-games' className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
								<div className='flex items-center gap-2'>
									<span className='font-semibold text-primary'>All Games</span>
								</div>
							</SelectItem>
							{leagueMembers.map(member => (
								<SelectItem key={member._id} value={member._id} className='focus:bg-primary/20 focus:text-primary data-[state=checked]:bg-primary/20 my-1'>
									<div className='flex items-center gap-2'>
										<Avatar className='w-5 h-5'>
											<AvatarImage src={member.image || undefined} alt={member.name} />
											<AvatarFallback className='text-[10px]'>{member.name.charAt(0)}</AvatarFallback>
										</Avatar>
										<span>{member.name}</span>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className='flex items-center justify-between'>
					<div></div>
					<div className='flex items-center gap-2'>
						{isUpdating && (
							<div className='flex items-center gap-1 text-xs text-primary/80'>
								<div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
								<span>Updating...</span>
							</div>
						)}
						{!isUpdating && lastUpdated && (
							<div className='flex items-center gap-1 text-xs text-muted-foreground'>
								<div className='h-2 w-2 rounded-full bg-green-500' />
								<span>Live • {getTimeAgo(lastUpdated)}</span>
							</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{error && (
					<Alert variant='destructive' className='mb-4 border-destructive/50 bg-destructive/10'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className='space-y-6'>
					{/* Game Picks organized by status */}
					<div>
						<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-4'>
							{selectedUserId === session?.user?.id ? 'Your Picks' : `${leagueMembers.find(m => m._id === selectedUserId)?.name}'s Picks`}
						</h3>

						{/* Live Games */}
						{results.liveGames.length > 0 && (
							<div className='mb-6'>
								<div className='flex items-center gap-2 mb-3'>
									<div className='h-2 w-2 rounded-full bg-green-500 animate-pulse' />
									<h4 className='text-md font-semibold text-green-400 uppercase tracking-wide'>Live Games</h4>
								</div>
								<div className='space-y-3'>
									{results.liveGames.map((game: any, index: number) => (
										<motion.div
											key={game.key || index}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											{game}
										</motion.div>
									))}
								</div>
							</div>
						)}

						{/* Upcoming Games */}
						{results.upcomingGames.length > 0 && (
							<div className='mb-6'>
								<h4 className='text-md font-semibold text-primary uppercase tracking-wide mb-3'>Upcoming Games</h4>
								<div className='space-y-3'>
									{results.upcomingGames.map((game: any, index: number) => (
										<motion.div
											key={game.key || index}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											{game}
										</motion.div>
									))}
								</div>
							</div>
						)}

						{/* Past Games */}
						{results.pastGames.length > 0 && (
							<div className='mb-6'>
								<h4 className='text-md font-semibold text-muted-foreground uppercase tracking-wide mb-3'>Final</h4>
								<div className='space-y-3'>
									{results.pastGames.map((game: any, index: number) => (
										<motion.div
											key={game.key || index}
											initial={{ opacity: 0, y: 10 }}
											whileInView={{ opacity: 1, y: 0 }}
											viewport={{ once: true, margin: "-50px" }}
											transition={{ duration: 0.3, delay: index * 0.05 }}
										>
											{game}
										</motion.div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* TFS Prediction - Only for Steve mode */}
					{leagueMode === 'steve' && (
					<div>
						<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-4'>Total Final Score</h3>
						<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
							<div className='space-y-2 text-foreground'>
								{picks?.tfsGame &&
									(() => {
										const tfsGame = games.find(g => g.id === picks.tfsGame);
										if (!tfsGame) return null;

										// If viewing another user's picks and game hasn't started, don't show TFS
										const isViewingOtherUser = selectedUserId !== session?.user?.id;
										if (isViewingOtherUser && !hasGameStarted(tfsGame)) {
											return null;
										}

										const tfsGameFinished = hasGameFinished(tfsGame);
										const scores = getGameScore(tfsGame);

										return (
											<>
												<div className='font-oswald uppercase text-lg text-primary mb-2'>
													{tfsGame.away.team} vs {tfsGame.home.team}
												</div>
												<div className='flex justify-between items-center bg-primary/10 p-3 rounded-lg'>
													<div>
														<span className='text-primary font-medium'>Your Guess: </span>
														<span className='text-lg font-bold'>{picks.tfsScore}</span>
													</div>
													<div>
														<span className='text-primary font-medium'>Actual: </span>
														<span className='text-lg font-bold'>{tfsGameFinished && scores.total !== undefined ? scores.total : 'TBD'}</span>
													</div>
													<div>
														<span className='text-primary font-medium'>Bonus: </span>
														<span className={`text-lg font-bold ${getTextColor(results.tfsPoints)}`}>{tfsGameFinished ? `+${results.tfsPoints}` : 'TBD'}</span>
													</div>
												</div>
											</>
										);
									})()}
							</div>
						</div>
					</div>
					)}

					{/* Weekly Summary */}
					<motion.div
						className='border-t border-primary/20 pt-6 mt-8'
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.4 }}
					>
						<div className={`grid gap-4 ${leagueMode === 'steve' ? 'grid-cols-3' : 'grid-cols-2'}`}>
							<motion.div
								className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
								whileHover={{ scale: 1.02 }}
							>
								<p className='text-primary/80 text-sm font-medium'>Total Points</p>
								<p className={`text-2xl font-bold font-mono ${getTextColor(results.totalPoints)}`}>
									<CountUp end={results.totalPoints} duration={1} preserveValue />
								</p>
							</motion.div>
							<motion.div
								className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
								whileHover={{ scale: 1.02 }}
							>
								<p className='text-primary/80 text-sm font-medium'>Correct Picks</p>
								<p className={`text-2xl font-bold font-mono text-primary`}>
									<CountUp end={results.correctPicks} duration={1} preserveValue />/5
								</p>
							</motion.div>
							{leagueMode === 'steve' && (
								<motion.div
									className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
									whileHover={{ scale: 1.02 }}
								>
									<p className='text-primary/80 text-sm font-medium'>TFS Points</p>
									<p className={`text-2xl font-bold font-mono ${getTextColor(results.tfsPoints)}`}>
										<CountUp end={results.tfsPoints} duration={1} preserveValue />
									</p>
								</motion.div>
							)}
						</div>
					</motion.div>
				</div>
			</CardContent>
		</Card>
	);
}
