'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { PickGameCard } from './PickGameCard';
import { NFLService } from '@/services/nflService';
import { hasGameStarted, hasGameFinished } from '@/services/gameUtils';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import type { Game } from './GameCard';
import { X } from 'lucide-react';

interface UserPicksModalProps {
	userId: string;
	playerName: string;
	week: number;
	leagueId: string;
	onClose: () => void;
}

interface UserPick {
	gameId: string;
	team: string;
	opponent: string;
	isHome: boolean;
	isCorrect?: boolean | null;
	odds?: number;
}

interface SnapshotOdds {
	id: string;
	home?: { odds?: number };
	away?: { odds?: number };
}

export function UserPicksModal({ userId, playerName, week, leagueId, onClose }: UserPicksModalProps) {
	const { data: session } = useSession();
	const [picks, setPicks] = useState<UserPick[]>([]);
	const [tfsGame, setTfsGame] = useState<string>('');
	const [tfsScore, setTfsScore] = useState<number | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [leagueMode, setLeagueMode] = useState<string>('standard');

	// Check if viewing own picks
	const isViewingOwnPicks = session?.user?.id === userId;

	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				setError(null);

				// Fetch league mode
				const leagueResponse = await fetch(`/api/league/${leagueId}`);
				let fetchedLeagueMode = 'standard';
				if (leagueResponse.ok) {
					const leagueData = await leagueResponse.json();
					fetchedLeagueMode = leagueData.mode || 'standard';
					setLeagueMode(fetchedLeagueMode);
				}

				const [weeklyGames, picksResponse] = await Promise.all([NFLService.getWeeklyGames(week), fetch(`/api/picks/user?week=${week}&leagueId=${leagueId}&userId=${userId}`)]);

				if (!picksResponse.ok) {
					throw new Error('Failed to fetch picks');
				}

				const picksData = await picksResponse.json();

				if (picksData) {
					setPicks(picksData.picks || []);
					setTfsGame(picksData.tfsGame || '');
					setTfsScore(picksData.tfsScore || null);
				}

				// Fetch odds for Standard mode leagues
				let gamesWithOdds = weeklyGames;
				if (fetchedLeagueMode === 'standard') {
					try {
						const oddsResponse = await fetch(`/api/odds/snapshot?week=${week}`);
						let snapshotOdds: SnapshotOdds[] = [];
						if (oddsResponse.ok) {
							const data = await oddsResponse.json();
							snapshotOdds = data.odds || [];
						}

						// Match odds to games
						gamesWithOdds = weeklyGames.map(game => {
							const snapshotGameOdds = snapshotOdds.find((o: SnapshotOdds) => o.id === game.id);

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
						console.error('[UserPicksModal] Error fetching odds:', error);
					}
				}

				setGames(gamesWithOdds);
			} catch (err) {
				console.error('Error loading user picks:', err);
				setError('Error loading picks');
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [userId, week, leagueId]);

	const isPickCorrect = (pick: UserPick, game: Game | undefined): boolean | null => {
		if (!game || !hasGameFinished(game)) return null;

		const homeScore = game.home.score;
		const awayScore = game.away.score;

		if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || homeScore === undefined || awayScore === undefined) {
			return null;
		}

		const homeWon = homeScore > awayScore;
		const pickedHome = pick.team === game.home.team;
		return (pickedHome && homeWon) || (!pickedHome && !homeWon);
	};

	const checkGameStatus = (game: Game): 'completed' | 'in_progress' | 'pending' => {
		if (hasGameFinished(game)) return 'completed';
		const status = game.status?.toLowerCase();
		if (status === 'in' || status === 'in_progress') return 'in_progress';
		return 'pending';
	};

	const getGameScore = (game: Game) => {
		const homeScore = typeof game.home.score === 'number' ? game.home.score : undefined;
		const awayScore = typeof game.away.score === 'number' ? game.away.score : undefined;
		return {
			home: homeScore,
			away: awayScore,
			total: homeScore !== undefined && awayScore !== undefined ? homeScore + awayScore : undefined
		};
	};

	if (loading) {
		return (
			<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
				<Card className='w-full max-w-2xl mx-4'>
					<CardContent className='p-6'>
						<div className='flex items-center justify-center'>
							<Spinner />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='fixed inset-0 bg-black/50 flex items-start justify-center z-[100] p-4 pt-24' onClick={onClose}>
			<Card className='w-full max-w-3xl max-h-[calc(90vh-6rem)] flex flex-col bg-card border-primary/20 overflow-hidden' onClick={e => e.stopPropagation()}>
				<CardHeader className='flex flex-row items-center justify-between border-b border-primary/20 sticky top-0 z-10 bg-card'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>
						{playerName}&apos;s Picks - Week {week}
					</CardTitle>
					<Button variant='ghost' size='icon' onClick={onClose} className='h-8 w-8'>
						<X className='h-4 w-4' />
					</Button>
				</CardHeader>
				<CardContent className='p-6 overflow-y-auto flex-1'>
					{error && <div className='mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive'>{error}</div>}

					<div className='space-y-4'>
						{/* Game Picks */}
						<div>
							<h3 className='text-lg font-medium mb-4'>Game Picks</h3>
							{picks.length === 0 ? (
								<div className='text-center text-muted-foreground py-8'>No picks found</div>
							) : (
								<div className='space-y-3'>
									{(() => {
										// Filter picks based on viewing context
										const visiblePicks = picks.filter(p => {
											const g = games.find(g => g.id === p.gameId);
											if (!g) return false;
											// For other users: only show picks for games that have started
											// For own picks: show all picks
											if (!isViewingOwnPicks && !hasGameStarted(g)) return false;
											return true;
										});

										return visiblePicks.map((pick, displayIndex) => {
											const game = games.find(g => g.id === pick.gameId);
											if (!game) return null;

											const gameStatus = checkGameStatus(game);
											const gameFinished = gameStatus === 'completed';
											const gameInProgress = gameStatus === 'in_progress';

											const isCorrect = isPickCorrect(pick, game);

											// Calculate points based on league mode
											let pickPoints = 0;
											if (gameFinished && isCorrect === true) {
												if (leagueMode === 'standard' && pick.odds !== undefined) {
													pickPoints = calculatePointsFromOdds(pick.odds);
												} else {
													pickPoints = 2; // Steve mode or no odds
												}
											}

											// Show scores for finished or in-progress games
											const shouldShowScores = gameFinished || gameInProgress;

											return (
												<PickGameCard
													key={pick.gameId}
													game={game}
													pick={pick}
													pickIndex={displayIndex}
													gameFinished={gameFinished}
													gameInProgress={gameInProgress}
													showScores={shouldShowScores}
													isCorrect={isCorrect}
													pickPoints={pickPoints}
													leagueMode={leagueMode}
													variant="picks"
												/>
											);
										});
									})()}
								</div>
							)}
						</div>

						{/* TFS Prediction - Only show if game has started (for other users) or always (for own picks) */}
						{tfsGame &&
							(() => {
								const tfsGameObj = games.find(g => g.id === tfsGame);
								if (!tfsGameObj) return null;

								const tfsGameStarted = hasGameStarted(tfsGameObj);

								// For other users: only show TFS if game has started
								// For own picks: always show TFS
								if (!isViewingOwnPicks && !tfsGameStarted) {
									return null;
								}

								const tfsGameFinished = hasGameFinished(tfsGameObj);
								const scores = getGameScore(tfsGameObj);

								return (
									<div>
										<h3 className='text-lg font-medium mb-4'>Total Final Score Prediction</h3>
										<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
											<div className='space-y-2'>
												<div className='font-oswald uppercase text-lg text-primary mb-2'>
													{tfsGameObj.away.team} vs {tfsGameObj.home.team}
												</div>
												<div className='flex justify-between items-center bg-primary/10 p-3 rounded-lg'>
													<div>
														<span className='text-primary font-medium'>Predicted: </span>
														<span className='text-lg font-bold'>{tfsScore}</span>
													</div>
													<div>
														<span className='text-primary font-medium'>Actual: </span>
														<span className='text-lg font-bold'>{tfsGameFinished && scores.total !== undefined ? scores.total : tfsGameStarted ? 'In Progress' : 'TBD'}</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								);
							})()}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
