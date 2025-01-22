import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';
import { NFLService } from '@/services/nflService';
import { StatsService } from '@/services/statsService';
import { SeasonStats } from './SeasonStats';

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

interface ResultsProps {
	currentWeek: number;
}

export function Results({ currentWeek }: ResultsProps) {
	const [picks, setPicks] = useState<WeeklyPicks | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load data when current week changes
	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				const savedPicks = localStorage.getItem(`week${currentWeek}picks`);
				setPicks(savedPicks ? JSON.parse(savedPicks) : null);

				const weeklyGames = await NFLService.getWeeklyGames(currentWeek);
				setGames(weeklyGames);
			} catch (err) {
				setError('Error loading results. Please try again.');
				console.error('Error:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [currentWeek]);

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

	// Memoized results calculation
	const results = useMemo(() => {
		if (!picks || !games.length) {
			return {
				gameElements: [],
				totalPoints: 0,
				correctPicks: 0,
				tfsPoints: 0,
				seasonStats: null
			};
		}

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

			if (isCorrect) {
				totalPoints += 2;
				correctPicks++;
			}

			return (
				<div key={pick.gameId} className={`relative ${gameStatus === 'completed' ? (isCorrect ? 'bg-green-50' : 'bg-red-50') : ''}`}>
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
					/>
					<div className='absolute top-2 right-2 px-2 py-1 rounded text-sm font-medium'>
						<span className={isCorrect ? 'text-green-600' : 'text-red-600'}>{isCorrect ? '+2 pts' : '0 pts'}</span>
					</div>
					<div className='absolute top-2 left-2 px-2 py-1 rounded text-sm font-medium text-gray-600'>Pick {index + 1}</div>
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

		// Update season stats
		const weeklyStats = {
			correctPicks,
			totalPicks: picks.picks.length,
			tfsPoints, // Explicitly track TFS points
			weeklyPoints: totalPoints
		};

		const seasonStats = StatsService.updateWeekStats(currentWeek, weeklyStats);

		return {
			gameElements,
			totalPoints,
			correctPicks,
			tfsPoints, // Return TFS points separately
			seasonStats
		};
	}, [picks, games, currentWeek]);

	// Render TFS prediction details
	const renderTFSPrediction = () => {
		if (!picks?.tfsGame) return null;

		const game = games.find(g => g.id === picks.tfsGame);
		if (!game) return null;

		const scores = getGameScore(game);
		const predictedScore = parseInt(picks.tfsScore);
		const gameStatus = checkGameStatus(game);
		const tfsPoints = gameStatus === 'completed' ? getTFSPoints(predictedScore, scores.total) : 0;

		return (
			<div className='p-4 rounded-lg bg-gray-50 border border-gray-200'>
				<div className='space-y-2'>
					<p className='font-medium'>
						{game.away.team} vs {game.home.team}
					</p>
					<p>Your Prediction: {predictedScore} points</p>
					<p>Actual Total: {scores.total} points</p>
					<p className={`font-medium ${tfsPoints > 0 ? 'text-green-600' : 'text-red-600'}`}>TFS Points: +{tfsPoints}</p>
				</div>
			</div>
		);
	};

	return (
		<div className='space-y-6'>
			<Card>
				<CardHeader>
					<CardTitle>Week {currentWeek} Results</CardTitle>
				</CardHeader>
				<CardContent>
					{error && (
						<Alert className='mb-4' variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{loading ? (
						<p>Loading...</p>
					) : (
						<>
							<div className='space-y-6'>
								{/* Game Picks */}
								<div>
									<h3 className='text-lg font-medium mb-4'>Your Picks</h3>
									<div className='space-y-3'>{results.gameElements}</div>
								</div>

								{/* TFS Prediction */}
								<div>
									<h3 className='text-lg font-medium mb-4'>Total Final Score Prediction</h3>
									{renderTFSPrediction()}
								</div>

								{/* Weekly Summary */}
								<div className='border-t pt-4'>
									<div className='flex justify-between items-center text-lg font-medium'>
										<span>Total Weekly Points:</span>
										<span>{results.totalPoints} pts</span>
									</div>
									<div className='flex justify-between items-center text-sm text-gray-600 mt-1'>
										<span>Correct Picks:</span>
										<span>{results.correctPicks}/5</span>
									</div>
									<div className='flex justify-between items-center text-sm text-gray-600 mt-1'>
										<span>TFS Points:</span>
										<span>+{results.tfsPoints}</span>
									</div>
								</div>
							</div>

							{/* Season Stats */}
							{results.seasonStats && <SeasonStats totalPoints={results.seasonStats.totalPoints} weeklyScores={Object.fromEntries(Object.entries(results.seasonStats.weeklyStats).map(([week, stats]) => [week, stats.weeklyPoints]))} correctPicks={results.seasonStats.correctPicks} totalPicks={results.seasonStats.totalPicks} tfsPoints={results.seasonStats.totalTFSPoints} />}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
