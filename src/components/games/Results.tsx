'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';
import { NFLService } from '@/services/nflService';
import { useStats } from '@/contexts/StatsContext';

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

export function Results({ currentWeek }: { currentWeek: number }) {
	const { data: session, status: sessionStatus } = useSession();
	const { refreshStats } = useStats();
	const [picks, setPicks] = useState<WeeklyPicks | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			if (sessionStatus === 'loading') return;

			try {
				setLoading(true);
				const [weeklyGames, picksResponse] = await Promise.all([NFLService.getWeeklyGames(currentWeek), fetch(`/api/picks?week=${currentWeek}`)]);

				const picksData = await picksResponse.json();
				setGames(weeklyGames);
				setPicks(picksData);
			} catch (err) {
				setError('Error loading results');
				console.error('Error:', err);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [currentWeek, sessionStatus]);

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

			if (isCorrect) {
				totalPoints += 2;
				correctPicks++;
			}

			return (
				<div
					key={pick.gameId}
					className={`relative rounded-lg overflow-hidden shadow-sm transition-all
       ${gameStatus === 'completed' ? (isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : 'bg-gray-50 border border-gray-200'}`}>
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
					<div
						className={`absolute top-2 right-2 px-3 py-1.5 rounded-full text-sm font-medium
       ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
						{isCorrect ? '+2 pts' : '0 pts'}
					</div>
					<div
						className='absolute top-2 left-2 px-3 py-1.5 rounded-full 
       bg-gray-100 text-gray-600 text-sm font-medium'>
						Pick {index + 1}
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
						<span className='text-gray-500'>Loading results...</span>
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

	return (
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

				<div className='space-y-6'>
					{/* Game Picks */}
					<div>
						<h3 className='text-lg font-medium mb-4'>Your Picks</h3>
						<div className='space-y-3'>{results.gameElements}</div>
					</div>

					{/* TFS Prediction */}
					<div>
						<h3 className='text-lg font-medium mb-4'>Total Final Score</h3>
						{renderTFSPrediction()}
					</div>

					{/* Weekly Summary */}
					<div className='border-t border-gray-200 pt-6 mt-8'>
						<div className='grid grid-cols-3 gap-4'>
							<div className='bg-gray-50 rounded-lg p-4 text-center'>
								<p className='text-gray-500 text-sm'>Total Points</p>
								<p className='text-2xl font-bold'>{results.totalPoints}</p>
							</div>
							<div className='bg-gray-50 rounded-lg p-4 text-center'>
								<p className='text-gray-500 text-sm'>Correct Picks</p>
								<p className='text-2xl font-bold'>{results.correctPicks}/5</p>
							</div>
							<div className='bg-gray-50 rounded-lg p-4 text-center'>
								<p className='text-gray-500 text-sm'>TFS Points</p>
								<p className='text-2xl font-bold'>+{results.tfsPoints}</p>
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
