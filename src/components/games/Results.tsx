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

export function Results() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session, status: sessionStatus } = useSession();
	const [picks, setPicks] = useState<WeeklyPicks | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			if (sessionStatus === 'loading') return;

			try {
				if (!leagueId) {
					console.error('[Results] Missing leagueId');
					setError('League ID is missing.');
					return;
				}

				setLoading(true);

				// Pass leagueId to the backend
				const [weeklyGames, picksResponse] = await Promise.all([NFLService.getWeeklyGames(currentWeek), fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}`)]);

				const picksData = await picksResponse.json();

				setGames(weeklyGames);
				setPicks(picksData);
			} catch (err) {
				console.error('[Results] Error loading results:', err);
				setError('Error loading results');
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [currentWeek, sessionStatus, leagueId]);

	// Game score calculation utility
	const getGameScore = (game: Game) => ({
		home: typeof game.home.score === 'number' ? game.home.score : 0,
		away: typeof game.away.score === 'number' ? game.away.score : 0,
		total: typeof game.home.score === 'number' && typeof game.away.score === 'number' ? game.home.score + game.away.score : 0
	});

	// Determine game status
	const checkGameStatus = (game: Game): 'completed' | 'in_progress' | 'pending' => (typeof game.home.score === 'number' && typeof game.away.score === 'number' ? 'completed' : 'pending');

	// Check if a pick is correct
	const checkPickCorrect = (pick: WeeklyPicks['picks'][0], game: Game) => {
		const scores = getGameScore(game);
		const gameStatus = checkGameStatus(game);

		if (gameStatus === 'completed') {
			const homeWon = scores.home > scores.away;
			const pickedHome = pick.team === game.home.team;
			return (pickedHome && homeWon) || (!pickedHome && !homeWon);
		}
		return null;
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

			// Add points for correct picks
			if (isCorrect) {
				totalPoints += 2;
				correctPicks += 1;
			}

			const badgeStyle = 'absolute px-2 py-1 rounded-full text-xs font-medium border';

			return (
				<div key={pick.gameId} className='relative rounded-lg overflow-hidden border-2 bg-card border-primary/20 pointer-events-none'>
					{/* Badges moved outside GameCard */}
					<div className={`${badgeStyle} top-2 right-2 z-10 ${getPointsColor(isCorrect ? 2 : 0)}`}>{isCorrect ? '+2 pts' : '0 pts'}</div>
					<div className='absolute top-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full bg-primary text-black text-xs font-medium shadow-md z-10'>{new Date(game.date).toLocaleDateString()}</div>
					<div className={`${badgeStyle} top-2 left-2 z-10 bg-primary text-black`}>Pick {index + 1}</div>
					<div className='mt-8'>
						<GameCard
							game={{
								...game,
								away: { ...game.away, score: scores.away },
								home: { ...game.home, score: scores.home },
								status: gameStatus
							}}
							selected={pick.team}
							showScores={true}
							disabled={true}
							isCorrect={isCorrect}
							noHover={true}
						/>
					</div>
				</div>
			);
		});

		// Calculate TFS points
		if (picks.tfsGame) {
			const tfsGame = games.find(g => g.id === picks.tfsGame);
			if (tfsGame && checkGameStatus(tfsGame) === 'completed') {
				const scores = getGameScore(tfsGame);
				const predictedScore = parseInt(picks.tfsScore);
				tfsPoints = getTFSPoints(predictedScore, scores.total);
				totalPoints += tfsPoints;
			}
		}

		return {
			gameElements,
			totalPoints,
			correctPicks,
			tfsPoints
		};
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

	return (
		<Card className='bg-card border-primary/20'>
			<CardHeader>
				<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Results</CardTitle>
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
								{picks?.tfsGame && games.find(g => g.id === picks.tfsGame) && (
									<>
										<div className='font-oswald uppercase text-lg text-primary mb-2'>
											{games.find(g => g.id === picks.tfsGame)?.away.team} vs {games.find(g => g.id === picks.tfsGame)?.home.team}
										</div>
										<div className='flex justify-between items-center bg-primary/10 p-3 rounded-lg'>
											<div>
												<span className='text-primary font-medium'>Your Guess: </span>
												<span className='text-lg font-bold'>{picks.tfsScore}</span>
											</div>
											<div>
												<span className='text-primary font-medium'>Actual: </span>
												<span className='text-lg font-bold'>{getGameScore(games.find(g => g.id === picks.tfsGame)!).total}</span>
											</div>
											<div>
												<span className='text-primary font-medium'>Bonus: </span>
												<span className={`text-lg font-bold ${getTextColor(results.tfsPoints)}`}>+{results.tfsPoints}</span>
											</div>
										</div>
									</>
								)}
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
