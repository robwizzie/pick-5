'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { GameCard } from './GameCard';
import { NFLService } from '@/services/nflService';
import { useStats } from '@/contexts/StatsContext';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import type { Game } from './GameCard';

export function WeeklyPicks() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session, status: sessionStatus } = useSession();
	const { refreshStats } = useStats();
	const [games, setGames] = useState<Game[]>([]);
	const [picks, setPicks] = useState<{ gameId: string; team: string; opponent: string; isHome: boolean }[]>([]);
	const [tfsGame, setTfsGame] = useState('');
	const [tfsScore, setTfsScore] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		console.log('[WeeklyPicks] currentWeek changed:', currentWeek);
		loadWeeklyGames();
		loadExistingPicks();
	}, [currentWeek, session?.user]);

	const loadWeeklyGames = async () => {
		if (sessionStatus === 'loading') return;

		try {
			setLoading(true);
			console.log('[WeeklyPicks] Fetching games for week:', currentWeek);
			const weeklyGames = await NFLService.getWeeklyGames(currentWeek);
			console.log('[WeeklyPicks] Games fetched:', weeklyGames);
			setGames(weeklyGames);
		} catch (error) {
			console.error('[WeeklyPicks] Error loading weekly games:', error);
			setGames([]);
			setError('Error loading games');
		} finally {
			setLoading(false);
		}
	};

	const loadExistingPicks = async () => {
		if (sessionStatus !== 'authenticated' || !leagueId) return;

		try {
			console.log('[WeeklyPicks] Fetching picks for week:', currentWeek, 'and leagueId:', leagueId);

			const response = await fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}`);
			const data = await response.json();
			console.log('[WeeklyPicks] Picks fetched:', data);

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
			console.error('[WeeklyPicks] Error loading picks:', error);
			setError('Error loading picks');
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

		if (!leagueId) {
			setError('League ID is missing');
			return;
		}

		try {
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week: currentWeek, picks, tfsGame, tfsScore: parseInt(tfsScore), leagueId })
			});

			if (response.ok) {
				await refreshStats();
				setSubmitted(true);
				await Promise.all([loadWeeklyGames(), loadExistingPicks()]);
			} else {
				const { error } = await response.json();
				setError(error || 'Failed to submit picks');
			}
		} catch (err) {
			console.error('Error submitting picks:', err);
			setError('An unexpected error occurred');
		}
	};

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
						<AlertDescription>Please sign in to make picks</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Week {currentWeek} Picks</CardTitle>
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
										<div key={pick.gameId} className='relative rounded-lg overflow-hidden bg-card border-2 border-primary/20'>
											<div className='absolute px-2 py-1 rounded-full text-xs font-medium top-2 left-2 z-10 bg-primary text-black'>Pick {index + 1}</div>
											{game && <div className='absolute px-2 py-1 top-2 right-2 rounded-full text-xs font-medium text-xs font-medium bg-primary text-black shadow-md z-10'>{new Date(game.date).toLocaleDateString()}</div>}
											<div className='mt-8'>
												<GameCard game={game} selected={pick.team} showScores={false} disabled={true} />{' '}
											</div>
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
									<div key={game.id} className={`relative rounded-lg overflow-hidden bg-card border-2 ${picks.find(p => p.gameId === game.id) ? 'border-primary' : 'border-primary/20'}`}>
										<GameCard game={game} selected={picks.find(p => p.gameId === game.id)?.team} onSelect={handleTeamSelect} disabled={picks.length >= 5 && !picks.find(p => p.gameId === game.id)} />
									</div>
								))}
							</div>

							{picks.length === 5 && (
								<div className='mt-6 space-y-4'>
									<div>
										<h3 className='text-lg font-medium mb-2'>Total Final Score Prediction</h3>
										<select className='w-full p-2 rounded mb-2 bg-card border-2 border-primary/20 text-foreground' value={tfsGame} onChange={e => setTfsGame(e.target.value)}>
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
										<Input type='number' placeholder='Predicted Total Score' value={tfsScore} onChange={e => setTfsScore(e.target.value)} className='bg-card border-2 border-primary/20' />
									</div>

									<Button className='w-full bg-primary text-black hover:bg-primary/90 font-medium' onClick={handleSubmit} disabled={!tfsGame || !tfsScore}>
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
