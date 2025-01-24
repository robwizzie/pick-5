'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameCard } from './GameCard';
import { NFLService } from '@/services/nflService';
import { StatsService } from '@/services/statsService';
import { useStats } from '@/contexts/StatsContext';

interface WeeklyPicksProps {
	currentWeek: number;
}

export function WeeklyPicks({ currentWeek }: WeeklyPicksProps) {
	const { data: session, status: sessionStatus } = useSession();
	const { refreshStats } = useStats();
	const [games, setGames] = useState([]);
	const [picks, setPicks] = useState<any[]>([]);
	const [tfsGame, setTfsGame] = useState('');
	const [tfsScore, setTfsScore] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		loadWeeklyGames();
		loadExistingPicks();
	}, [currentWeek, session?.user]);

	const loadWeeklyGames = async () => {
		if (sessionStatus === 'loading') return;

		try {
			setLoading(true);
			const weeklyGames = await NFLService.getWeeklyGames(currentWeek);
			setGames(weeklyGames);
		} catch (error) {
			console.error('Error loading weekly games:', error);
			setGames([]);
			setError('Error loading games');
		} finally {
			setLoading(false);
		}
	};

	const loadExistingPicks = async () => {
		if (!session?.user || sessionStatus === 'loading') return;

		try {
			const response = await fetch(`/api/picks?week=${currentWeek}`);
			const data = await response.json();

			if (data) {
				setPicks(data.picks || []);
				setTfsGame(data.tfsGame || '');
				setTfsScore(data.tfsScore?.toString() || '');
				setSubmitted(true);
			} else {
				setPicks([]);
				setTfsGame('');
				setTfsScore('');
				setSubmitted(false);
			}
		} catch (error) {
			console.error('Error loading picks:', error);
		}
	};

	const handleTeamSelect = (gameId: string, selectedTeam: string, opponent: string, isHome: boolean) => {
		if (!session) {
			setError('Please sign in to make picks');
			return;
		}

		setPicks(current => {
			const existing = current.findIndex(p => p.gameId === gameId);
			// If clicking already selected team, remove it
			if (existing !== -1 && current[existing].team === selectedTeam) {
				return current.filter((_, i) => i !== existing);
			}
			// Otherwise update/add pick
			if (existing !== -1) {
				const newPicks = [...current];
				newPicks[existing] = { gameId, team: selectedTeam, opponent, isHome };
				return newPicks;
			}
			if (current.length >= 5) {
				setError('You can only select 5 games');
				return current;
			}
			return [...current, { gameId, team: selectedTeam, opponent, isHome }];
		});
	};

	const handleSubmit = async () => {
		if (!session) {
			setError('Please sign in to submit picks');
			return;
		}

		if (picks.length !== 5) {
			setError('Please select exactly 5 games');
			return;
		}

		if (!tfsGame || isNaN(parseInt(tfsScore))) {
			setError('Please select a TFS game and enter a valid predicted score');
			return;
		}

		try {
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week: currentWeek, picks, tfsGame, tfsScore: parseInt(tfsScore) })
			});

			if (response.ok) {
				const result = await response.json();
				await StatsService.updateMongoStats(
					session.user.id,
					{
						weeklyPoints: result.weeklyPoints,
						correctPicks: result.correctPicks,
						totalPicks: picks.length,
						tfsPoints: result.tfsPoints
					},
					currentWeek
				);
				await refreshStats();
				setSubmitted(true);
				await Promise.all([loadWeeklyGames(), loadExistingPicks()]);
			} else {
				throw new Error('Failed to submit picks');
			}
		} catch (error) {
			console.error('Error submitting picks:', error);
			setError(error.message);
		}
	};

	if (sessionStatus === 'loading' || loading) {
		return (
			<Card>
				<CardContent className='p-6'>
					<div className='flex items-center justify-center'>
						<span className='text-gray-500'>Loading...</span>
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
						<AlertDescription>Please sign in to make picks</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Week {currentWeek} Picks</CardTitle>
			</CardHeader>
			<CardContent>
				{error && (
					<Alert className='mb-4' variant='destructive'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className='space-y-4'>
					{submitted ? (
						<div>
							<h3 className='text-lg font-medium mb-4'>Your Picks</h3>
							<div className='space-y-3'>
								{picks.map((pick, index) => {
									const game = games.find(g => g.id === pick.gameId);
									return (
										<div key={pick.gameId} className='relative rounded-lg overflow-hidden shadow-sm bg-gray-50 border border-gray-200'>
											<GameCard game={game} selected={pick.team} showScores={false} disabled={true} />
											<div className='absolute top-2 left-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium'>Pick {index + 1}</div>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<div>
							<h3 className='text-lg font-medium mb-4'>Select 5 Games ({picks.length}/5)</h3>
							<div className='space-y-3'>
								{games.map(game => (
									<div key={game.id} className={`relative rounded-lg overflow-hidden shadow-sm transition-all ${picks.find(p => p.gameId === game.id) ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
										<GameCard game={game} selected={picks.find(p => p.gameId === game.id)?.team} onSelect={handleTeamSelect} disabled={picks.length >= 5 && !picks.find(p => p.gameId === game.id)} />
									</div>
								))}
							</div>

							{picks.length === 5 && (
								<div className='mt-6 space-y-4'>
									<div>
										<h3 className='text-lg font-medium mb-2'>Total Final Score Prediction</h3>
										<select className='w-full p-2 border rounded mb-2' value={tfsGame} onChange={e => setTfsGame(e.target.value)}>
											<option value=''>Select Game</option>
											{picks.map(pick => {
												const game = games.find(g => g.id === pick.gameId);
												return (
													<option key={pick.gameId} value={pick.gameId}>
														{game?.away.team} @ {game?.home.team}
													</option>
												);
											})}
										</select>
										<Input type='number' placeholder='Predicted Total Score' value={tfsScore} onChange={e => setTfsScore(e.target.value)} />
									</div>

									<Button className='w-full' onClick={handleSubmit} disabled={!tfsGame || !tfsScore}>
										Submit Picks
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
