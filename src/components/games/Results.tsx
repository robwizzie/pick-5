'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';
import { NFLService } from '@/services/nflService';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { hasGameFinished } from '@/services/gameUtils';

interface WeeklyPicks {
	picks: Array<{
		gameId: string;
		team: string;
		opponent: string;
		isHome: boolean;
	}>;
	tfsGame: string;
	tfsScore: string;
	submitted: boolean;
}

interface UserPick {
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

interface LeagueMember {
	_id: string;
	name: string;
	image?: string | null;
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
	const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>([]);
	const [selectedUserId, setSelectedUserId] = useState<string>('');

	// Fetch league details and members
	useEffect(() => {
		const fetchLeagueData = async () => {
			if (!leagueId || !session?.user?.id) return;

			try {
				const [leagueResponse, membersResponse] = await Promise.all([
					fetch(`/api/league/${leagueId}`),
					fetch(`/api/league/${leagueId}/members`)
				]);

				if (leagueResponse.ok) {
					const leagueData = await leagueResponse.json();
					setLeagueMode(leagueData.mode || 'standard');
				}

				if (membersResponse.ok) {
					const membersData = await membersResponse.json();
					setLeagueMembers(membersData);
				}

				// Set current user as default
				setSelectedUserId(session.user.id);
			} catch (error) {
				console.error('Error fetching league data:', error);
			}
		};

		fetchLeagueData();
	}, [leagueId, session?.user?.id]);

	useEffect(() => {
		const loadData = async (isPolling = false) => {
			if (sessionStatus === 'loading' || !selectedUserId) return;

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

				// Fetch picks for selected user
				const picksUrl = selectedUserId === session?.user?.id
					? `/api/picks?week=${currentWeek}&leagueId=${leagueId}`
					: `/api/picks/user?week=${currentWeek}&leagueId=${leagueId}&userId=${selectedUserId}`;

				// Pass leagueId to the backend
				const [weeklyGames, picksResponse, leaguePicksResponse] = await Promise.all([
					NFLService.getWeeklyGames(currentWeek),
					fetch(picksUrl, { cache: 'no-store' }),
					fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' })
				]);

				const picksData = await picksResponse.json();
				const leaguePicksData = await leaguePicksResponse.json();

				setGames(weeklyGames);
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
	}, [currentWeek, sessionStatus, leagueId]);

	// Game score calculation utility
	const getGameScore = (game: Game) => ({
		home: typeof game.home.score === 'number' ? game.home.score : undefined,
		away: typeof game.away.score === 'number' ? game.away.score : undefined,
		total: typeof game.home.score === 'number' && typeof game.away.score === 'number' && game.home.score !== undefined && game.away.score !== undefined ? game.home.score + game.away.score : undefined
	});

	// Determine game status - only 'completed' if game has actually finished
	const checkGameStatus = (game: Game): 'completed' | 'in_progress' | 'pending' => {
		return hasGameFinished(game) ? 'completed' : 'pending';
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

	const getPointsColor = (points: number) => {
		if (points > 0) return 'bg-[#22c55e] text-black'; // Green with black text
		if (points < 0) return 'bg-destructive text-white';
		return 'bg-muted text-muted-foreground';
	};

	const getTextColor = (points: number) => {
		if (points > 0) return 'text-[#22c55e]'; // Green
		if (points < 0) return 'text-destructive';
		return 'text-muted-foreground';
	};

	// Memoized results calculation
	const results = useMemo(() => {
		if (!picks || !games.length)
			return {
				gameElements: [],
				totalPoints: 0,
				correctPicks: 0,
				tfsPoints: 0
			};

		let totalPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;

		// Process game picks
		const gameElements = picks.picks.map((pick, index) => {
			const game = games.find(g => g.id === pick.gameId);
			if (!game) return null;

			const scores = getGameScore(game);
			const gameStatus = checkGameStatus(game);
			const isCorrect = checkPickCorrect(pick, game);
			const gameFinished = hasGameFinished(game);

			// Add points for correct picks (only if game is finished)
			if (gameFinished && isCorrect === true) {
				totalPoints += 2;
				correctPicks += 1;
			}

			const badgeStyle = 'absolute px-2 py-1 rounded-full text-xs font-medium border';

			return (
				<div key={pick.gameId} className='relative rounded-lg overflow-hidden border-2 bg-card border-primary/20 pointer-events-none'>
					{/* Badges moved outside GameCard */}
					{gameFinished ? <div className={`${badgeStyle} top-2 right-2 z-10 ${getPointsColor(isCorrect === true ? 2 : 0)}`}>{isCorrect === true ? '+2 pts' : '0 pts'}</div> : <div className={`${badgeStyle} top-2 right-2 z-10 bg-muted text-muted-foreground`}>Pending</div>}
					<div className='absolute top-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full bg-primary text-black text-xs font-medium shadow-md z-10'>{new Date(game.date).toLocaleDateString()}</div>
					<div className={`${badgeStyle} top-2 left-2 z-10 bg-primary text-black`}>Pick {index + 1}</div>
					<div className='mt-8'>
						<GameCard
							game={{
								...game,
								// Only pass scores if game is finished
								away: {
									...game.away,
									score: gameFinished && scores.away !== undefined ? scores.away : undefined
								},
								home: {
									...game.home,
									score: gameFinished && scores.home !== undefined ? scores.home : undefined
								},
								status: gameStatus
							}}
							selected={pick.team}
							showScores={gameFinished}
							disabled={true}
							isCorrect={gameFinished ? isCorrect : null}
							noHover={true}
							leaguePicks={gameFinished ? leaguePicks[pick.gameId] : undefined}
						/>
					</div>
				</div>
			);
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
			gameElements,
			totalPoints,
			correctPicks,
			tfsPoints
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [picks, games]);

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

	if (!picks || !picks.picks.length) {
		return (
			<Card className='bg-card border-primary/20'>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Results</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert variant='destructive' className='mb-4'>
						<AlertDescription>No picks were made for this week.</AlertDescription>
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

	return (
		<Card className='bg-card border-primary/20'>
			<CardHeader>
				<div className='flex items-center justify-between'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Results</CardTitle>
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
					{/* Game Picks */}
					<div>
						<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-4'>Your Picks</h3>
						<div className='space-y-3'>{results.gameElements}</div>
					</div>

					{/* TFS Prediction */}
					<div>
						<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-4'>Total Final Score</h3>
						<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
							<div className='space-y-2 text-foreground'>
								{picks?.tfsGame &&
									(() => {
										const tfsGame = games.find(g => g.id === picks.tfsGame);
										if (!tfsGame) return null;

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

					{/* Weekly Summary */}
					<div className='border-t border-primary/20 pt-6 mt-8'>
						<div className='grid grid-cols-3 gap-4'>
							<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
								<p className='text-primary/80 text-sm font-medium'>Total Points</p>
								<p className={`text-2xl font-bold ${getTextColor(results.totalPoints)}`}>{results.totalPoints}</p>
							</div>
							<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
								<p className='text-primary/80 text-sm font-medium'>Correct Picks</p>
								<p className={`text-2xl font-bold text-primary`}>{results.correctPicks}/5</p>
							</div>
							<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
								<p className='text-primary/80 text-sm font-medium'>TFS Points</p>
								<p className={`text-2xl font-bold ${getTextColor(results.tfsPoints)}`}>{results.tfsPoints}</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
