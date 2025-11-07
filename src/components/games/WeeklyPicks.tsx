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
import { calculatePointsFromOdds, formatOdds, getOddsColorClass } from '@/utils/oddsUtils';
import type { Game } from './GameCard';

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
	const [leaguePicks, setLeaguePicks] = useState<LeaguePicksData>({});
	const [leagueMode, setLeagueMode] = useState<string>('standard');
	const [tfsError, setTfsError] = useState<string | null>(null);

	// Fetch league details to get the mode
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
				console.error('[WeeklyPicks] Error fetching league details:', error);
			}
		};
		fetchLeagueDetails();
	}, [leagueId]);

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
			loadLeaguePicks();
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

			// Fetch odds for Standard mode leagues
			if (leagueMode === 'standard') {
				try {
					const oddsResponse = await fetch('/api/odds/nfl');
					if (oddsResponse.ok) {
						const oddsData = await oddsResponse.json();

						// Match odds to games and attach them
						const gamesWithOdds = weeklyGames.map(game => {
							const gameOdds = oddsData.find((o: any) =>
								o.home_team === game.home.team || o.away_team === game.away.team
							);

							if (gameOdds) {
								return {
									...game,
									home: { ...game.home, odds: gameOdds.home?.odds },
									away: { ...game.away, odds: gameOdds.away?.odds }
								};
							}
							return game;
						});

						setGames(gamesWithOdds);
					} else {
						console.error('[WeeklyPicks] Failed to fetch odds');
						setGames(weeklyGames);
					}
				} catch (oddsError) {
					console.error('[WeeklyPicks] Error fetching odds:', oddsError);
					setGames(weeklyGames);
				}
			} else {
				setGames(weeklyGames);
			}
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

	const loadLeaguePicks = async () => {
		if (!leagueId) return;

		try {
			const response = await fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' });
			if (response.ok) {
				const data = await response.json();
				setLeaguePicks(data);
			}
		} catch (error) {
			console.error('[WeeklyPicks] Error loading league picks:', error);
		}
	};

	const validateTfsScore = (value: string): string | null => {
		if (!value || value.trim() === '') {
			return 'Total Final Score is required';
		}

		const numValue = parseInt(value);

		if (isNaN(numValue)) {
			return 'Please enter a valid number';
		}

		if (numValue < 0) {
			return 'Score cannot be negative';
		}

		if (numValue > 200) {
			return 'Score seems unrealistically high (max 200)';
		}

		if (!Number.isInteger(parseFloat(value))) {
			return 'Score must be a whole number';
		}

		return null;
	};

	const handleTfsScoreChange = (value: string) => {
		setTfsScore(value);
		if (value) {
			const error = validateTfsScore(value);
			setTfsError(error);
		} else {
			setTfsError(null);
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
		// For Steve mode, require TFS. For Standard mode, don't require it
		const isSteveMode = leagueMode === 'steve';
		const hasRequiredFields = isSteveMode
			? picks.length === 5 && tfsGame && !isNaN(parseInt(tfsScore))
			: picks.length === 5;

		if (!session || !leagueId || !hasRequiredFields) {
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
			const requestBody: any = {
				week: currentWeek,
				picks,
				leagueId
			};

			// Only include TFS for Steve mode
			if (leagueMode === 'steve') {
				requestBody.tfsGame = tfsGame;
				requestBody.tfsScore = parseInt(tfsScore);
			}

			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
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
		// For Steve mode, require TFS. For Standard mode, don't require it
		const isSteveMode = leagueMode === 'steve';
		const hasRequiredFields = isSteveMode
			? picks.length === 5 && tfsGame && tfsScore && !isNaN(parseInt(tfsScore))
			: picks.length === 5;

		// Don't auto-save on initial load or if incomplete
		if (initialLoadRef.current || !hasExistingPicks || !hasRequiredFields || isSaving) {
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

		// TFS validation only for Steve mode
		if (leagueMode === 'steve') {
			if (!tfsGame) {
				setError('Please select a TFS game');
				return;
			}

			const tfsValidationError = validateTfsScore(tfsScore);
			if (tfsValidationError) {
				setError(tfsValidationError);
				setTfsError(tfsValidationError);
				return;
			}
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
			const requestBody: any = {
				week: currentWeek,
				picks,
				leagueId
			};

			// Only include TFS for Steve mode
			if (leagueMode === 'steve') {
				requestBody.tfsGame = tfsGame;
				requestBody.tfsScore = parseInt(tfsScore);
			}

			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
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
									const gameCompleted = game && typeof game.home.score === 'number' && typeof game.away.score === 'number';
									return (
										<div key={pick.gameId} className='relative rounded-lg overflow-hidden bg-card border-2 border-primary/20'>
											<div className='absolute px-2 py-1 rounded-full text-xs font-medium top-2 left-2 z-10 bg-primary text-black'>Pick {index + 1}</div>
											{game && <div className='absolute px-2 py-1 top-2 right-2 rounded-full text-xs font-medium bg-primary text-black shadow-md z-10'>{new Date(game.date).toLocaleDateString()}</div>}
											<div className='mt-8'>
												<GameCard game={game} selected={pick.team} showScores={true} disabled={true} isCorrect={isCorrect} leaguePicks={gameCompleted ? leaguePicks[pick.gameId] : undefined} leagueMode={leagueMode} />
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
									const gameCompleted = game && typeof game.home.score === 'number' && typeof game.away.score === 'number';

									// Allow editing if game has not started, even if already picked
									// If game has started, do not allow selection (unless it is not picked)
									const canSelect = !gameStarted;

									return (
										<div key={game.id} className={`relative rounded-lg overflow-hidden bg-card border-2 ${isPicked ? 'border-primary' : 'border-primary/20'}`}>
											<GameCard game={game} selected={isPicked?.team} onSelect={handleTeamSelect} disabled={!canSelect || (picks.length >= 5 && !isPicked)} showScores={gameStarted} leaguePicks={gameCompleted ? leaguePicks[game.id] : undefined} leagueMode={leagueMode} />
										</div>
									);
								})}
							</div>

							{picks.length === 5 && leagueMode === 'steve' && (
								<div className='mt-6 space-y-4'>
									<div>
										<h3 className='text-lg font-medium mb-2'>Total Final Score Prediction</h3>
										<p className='text-sm text-muted-foreground mb-3'>Select one of your picked games and predict the combined final score of both teams</p>
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
										<div className='space-y-1'>
											<Input type='number' placeholder='Predicted Total Score (e.g., 45)' value={tfsScore} onChange={e => handleTfsScoreChange(e.target.value)} className={`bg-card border-2 ${tfsError ? 'border-red-500' : 'border-primary/20'}`} />
											{tfsError && <p className='text-sm text-red-500'>{tfsError}</p>}
											{tfsScore && !tfsError && (
												<div className='p-3 rounded-lg bg-primary/10 border border-primary/20 mt-2'>
													<p className='text-sm text-foreground'>
														<strong>Potential TFS Points:</strong>
													</p>
													<ul className='text-xs text-muted-foreground mt-1 space-y-1'>
														<li>• Exact score: <span className='text-primary font-semibold'>5 points</span></li>
														<li>• Within 1-3: <span className='text-primary font-semibold'>4 points</span></li>
														<li>• Within 4-5: <span className='text-primary font-semibold'>3 points</span></li>
														<li>• Within 6-7: <span className='text-primary font-semibold'>2 points</span></li>
														<li>• Within 8-10: <span className='text-primary font-semibold'>1 point</span></li>
													</ul>
												</div>
											)}
										</div>
									</div>

									{/* Point Summary */}
									<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
										<h4 className='text-sm font-semibold text-foreground mb-2'>Potential Weekly Score</h4>
										<div className='space-y-2 text-sm'>
											<div className='flex justify-between'>
												<span className='text-muted-foreground'>5 Game Picks (2 pts each):</span>
												<span className='font-semibold text-primary'>Up to 10 points</span>
											</div>
											<div className='flex justify-between'>
												<span className='text-muted-foreground'>TFS Bonus:</span>
												<span className='font-semibold text-primary'>Up to 5 points</span>
											</div>
											<div className='border-t border-primary/20 pt-2 flex justify-between'>
												<span className='font-semibold text-foreground'>Maximum Total:</span>
												<span className='font-bold text-primary text-lg'>15 points</span>
											</div>
										</div>
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
										disabled={!tfsGame || !tfsScore || !!tfsError || isSaving}>
										{isSaving ? 'Saving...' : hasExistingPicks ? 'Update Picks' : 'Submit Picks'}
									</Button>
								</div>
							)}

							{/* Standard Mode Submit Button */}
							{picks.length === 5 && leagueMode === 'standard' && (
								<div className='mt-6 space-y-4'>
									{/* Point Preview for Standard Mode */}
									<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
										<h4 className='text-sm font-semibold text-foreground mb-3'>Your Potential Score</h4>
										<div className='space-y-2 text-sm mb-3'>
											{picks.map((pick, index) => {
												const game = games.find(g => g.id === pick.gameId);
												const team = pick.isHome ? game?.home : game?.away;
												const points = team?.odds ? calculatePointsFromOdds(team.odds) : 0;
												return (
													<div key={pick.gameId} className='flex justify-between items-center'>
														<span className='text-muted-foreground'>
															Pick {index + 1}: {pick.team}
															{team?.odds && <span className={`ml-2 ${getOddsColorClass(team.odds)}`}>({formatOdds(team.odds)})</span>}
														</span>
														<span className='font-semibold text-primary'>{points} pts</span>
													</div>
												);
											})}
										</div>
										<div className='border-t border-primary/20 pt-2 flex justify-between'>
											<span className='font-semibold text-foreground'>Total if all win:</span>
											<span className='font-bold text-primary text-lg'>
												{picks.reduce((total, pick) => {
													const game = games.find(g => g.id === pick.gameId);
													const team = pick.isHome ? game?.home : game?.away;
													return total + (team?.odds ? calculatePointsFromOdds(team.odds) : 0);
												}, 0)} pts
											</span>
										</div>
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
										disabled={isSaving}>
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
