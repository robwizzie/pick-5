'use client';

import { useState, useEffect, useRef } from 'react';
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
import { hasGameStarted, haveAllPickedGamesStarted } from '@/services/gameUtils';
import { Toast } from '@/components/ui/toast';
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
	const [hasExistingPicks, setHasExistingPicks] = useState(false);
	const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const initialLoadRef = useRef(true);
	const lastSavedRef = useRef<{ picks: typeof picks; tfsGame: string; tfsScore: string } | null>(null);

	useEffect(() => {
		console.log('[WeeklyPicks] currentWeek changed:', currentWeek);
		initialLoadRef.current = true; // Reset for new week
		lastSavedRef.current = null; // Reset last saved for new week
		loadWeeklyGames();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeek, session?.user]);

	// Load picks after games are loaded so we can check game status
	useEffect(() => {
		if (games.length > 0 && sessionStatus === 'authenticated') {
			loadExistingPicks();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [games, sessionStatus]);

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
				const loadedPicks = data.picks || [];
				const loadedTfsGame = data.tfsGame || '';
				const loadedTfsScore = data.tfsScore?.toString() || '';

				setPicks(loadedPicks);
				setTfsGame(loadedTfsGame);
				setTfsScore(loadedTfsScore);
				setHasExistingPicks(true);

				// Update last saved ref to match loaded data
				lastSavedRef.current = { picks: [...loadedPicks], tfsGame: loadedTfsGame, tfsScore: loadedTfsScore };

				// Only set submitted to true if all picked games have started
				// This allows editing until games start
				const allGamesStarted = haveAllPickedGamesStarted(loadedPicks, games);
				setSubmitted(allGamesStarted);
			} else {
				setPicks([]);
				setTfsGame('');
				setTfsScore('');
				setSubmitted(false);
				setHasExistingPicks(false);
				lastSavedRef.current = null;
			}

			// Mark initial load as complete after a short delay
			setTimeout(() => {
				initialLoadRef.current = false;
			}, 500);
		} catch (error) {
			console.error('[WeeklyPicks] Error loading picks:', error);
			setError('Error loading picks');
		}
	};

	// Helper to check if a pick is correct (for display purposes)
	const isPickCorrect = (pick: { gameId: string; team: string }, game: Game | undefined): boolean | null => {
		if (!game) return null;
		// Only show correct/incorrect if game is completed (has scores)
		const hasScores = typeof game.home.score === 'number' && typeof game.away.score === 'number';
		if (!hasScores) return null;

		const homeWon = game.home.score! > game.away.score!;
		const pickedHome = pick.team === game.home.team;
		return (pickedHome && homeWon) || (!pickedHome && !homeWon);
	};

	const autoSave = async (isUpdate: boolean = false) => {
		if (!session || !leagueId || picks.length !== 5 || !tfsGame || isNaN(parseInt(tfsScore))) {
			return; // Don't save if incomplete
		}

		// Check if picks have actually changed
		const currentState = JSON.stringify({ picks, tfsGame, tfsScore });
		if (lastSavedRef.current) {
			const lastSavedState = JSON.stringify({ picks: lastSavedRef.current.picks, tfsGame: lastSavedRef.current.tfsGame, tfsScore: lastSavedRef.current.tfsScore });
			if (currentState === lastSavedState) {
				return; // No changes, skip save
			}
		}

		try {
			setIsSaving(true);
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week: currentWeek, picks, tfsGame, tfsScore: parseInt(tfsScore), leagueId })
			});

			if (response.ok) {
				setHasExistingPicks(true);
				setToast({ message: isUpdate ? 'Picks updated successfully!' : 'Picks saved!', type: 'success' });

				// Update last saved ref to prevent loop
				lastSavedRef.current = { picks: [...picks], tfsGame, tfsScore };

				// Dispatch refresh events (don't reload picks to avoid triggering loop)
				const leaderboardEvent = new CustomEvent('refreshLeaderboard');
				const statsEvent = new CustomEvent('refreshSeasonStats');
				window.dispatchEvent(leaderboardEvent);
				window.dispatchEvent(statsEvent);
			} else {
				const { error } = await response.json();
				setToast({ message: error || 'Failed to save picks', type: 'error' });
			}
		} catch (err) {
			console.error('Error auto-saving picks:', err);
			setToast({ message: 'Error saving picks', type: 'error' });
		} finally {
			setIsSaving(false);
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

	// Auto-save when picks, TFS game, or score changes (only if we have existing picks)
	useEffect(() => {
		// Don't auto-save on initial load or if incomplete
		if (initialLoadRef.current || !hasExistingPicks || picks.length !== 5 || !tfsGame || !tfsScore || isNaN(parseInt(tfsScore)) || isSaving) {
			return;
		}

		// Clear any pending auto-save
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		// Debounce auto-save
		saveTimeoutRef.current = setTimeout(() => {
			autoSave(true); // Pass true to indicate this is an update
		}, 1000); // 1 second debounce

		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [picks, tfsGame, tfsScore, hasExistingPicks]);

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

		// Clear any pending auto-save
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		try {
			setIsSaving(true);
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week: currentWeek, picks, tfsGame, tfsScore: parseInt(tfsScore), leagueId })
			});

			if (response.ok) {
				setHasExistingPicks(true);
				setToast({ message: hasExistingPicks ? 'Picks updated successfully!' : 'Picks submitted successfully!', type: 'success' });

				// Update last saved ref to prevent duplicate saves
				lastSavedRef.current = { picks: [...picks], tfsGame, tfsScore };

				// Reload games and picks to check if all games have started
				await loadWeeklyGames();
				await loadExistingPicks();

				// Dispatch refresh events
				const leaderboardEvent = new CustomEvent('refreshLeaderboard');
				const statsEvent = new CustomEvent('refreshSeasonStats');
				window.dispatchEvent(leaderboardEvent);
				window.dispatchEvent(statsEvent);
			} else {
				const { error } = await response.json();
				setError(error || 'Failed to submit picks');
				setToast({ message: error || 'Failed to submit picks', type: 'error' });
			}
		} catch (err) {
			console.error('Error submitting picks:', err);
			setError('An unexpected error occurred');
			setToast({ message: 'An unexpected error occurred', type: 'error' });
		} finally {
			setIsSaving(false);
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
									const isCorrect = isPickCorrect(pick, game);
									return (
										<div key={pick.gameId} className='relative rounded-lg overflow-hidden bg-card border-2 border-primary/20'>
											<div className='absolute px-2 py-1 rounded-full text-xs font-medium top-2 left-2 z-10 bg-primary text-black'>Pick {index + 1}</div>
											{game && <div className='absolute px-2 py-1 top-2 right-2 rounded-full text-xs font-medium bg-primary text-black shadow-md z-10'>{new Date(game.date).toLocaleDateString()}</div>}
											<div className='mt-8'>
												<GameCard game={game} selected={pick.team} showScores={true} disabled={true} isCorrect={isCorrect} />
											</div>
										</div>
									);
								})}
							</div>
							{!haveAllPickedGamesStarted(picks, games) && (
								<div className='mt-4'>
									<Alert className='mb-4'>
										<AlertDescription>Some games haven&apos;t started yet. You can still edit your picks.</AlertDescription>
									</Alert>
									<Button
										className='w-full bg-primary text-black hover:bg-primary/90 font-medium'
										onClick={() => {
											setSubmitted(false);
											setError(null);
										}}>
										Edit Picks
									</Button>
								</div>
							)}
						</div>
					) : (
						<div>
							<h3 className='text-lg font-medium mb-4'>Select 5 Games ({picks.length}/5)</h3>
							<div className='space-y-3'>
								{games.map(game => {
									const isPicked = picks.find(p => p.gameId === game.id);
									const gameStarted = hasGameStarted(game);

									// Allow editing if game has not started, even if already picked
									// If game has started, do not allow selection (unless it is not picked)
									const canSelect = !gameStarted;

									return (
										<div key={game.id} className={`relative rounded-lg overflow-hidden bg-card border-2 ${isPicked ? 'border-primary' : 'border-primary/20'}`}>
											<GameCard game={game} selected={isPicked?.team} onSelect={handleTeamSelect} disabled={!canSelect || (picks.length >= 5 && !isPicked)} showScores={gameStarted} />
										</div>
									);
								})}
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

									<Button
										className='w-full bg-primary text-black hover:bg-primary/90 font-medium'
										onClick={async () => {
											await handleSubmit();
											// Trigger Leaderboard and Stats refresh
											const leaderboardEvent = new CustomEvent('refreshLeaderboard');
											window.dispatchEvent(leaderboardEvent);
											await refreshStats();
										}}
										disabled={!tfsGame || !tfsScore || isSaving}>
										{isSaving ? 'Saving...' : hasExistingPicks ? 'Update Picks' : 'Submit Picks'}
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			</CardContent>
			{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
		</Card>
	);
}
