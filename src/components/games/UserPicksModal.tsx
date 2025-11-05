'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { GameCard } from './GameCard';
import { NFLService } from '@/services/nflService';
import { hasGameStarted, hasGameFinished } from '@/services/gameUtils';
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
}

export function UserPicksModal({ userId, playerName, week, leagueId, onClose }: UserPicksModalProps) {
	const [picks, setPicks] = useState<UserPick[]>([]);
	const [tfsGame, setTfsGame] = useState<string>('');
	const [tfsScore, setTfsScore] = useState<number | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				setError(null);

				const [weeklyGames, picksResponse] = await Promise.all([
					NFLService.getWeeklyGames(week),
					fetch(`/api/picks/user?week=${week}&leagueId=${leagueId}&userId=${userId}`)
				]);

				if (!picksResponse.ok) {
					throw new Error('Failed to fetch picks');
				}

				const picksData = await picksResponse.json();

				if (picksData) {
					setPicks(picksData.picks || []);
					setTfsGame(picksData.tfsGame || '');
					setTfsScore(picksData.tfsScore || null);
				}

				setGames(weeklyGames);
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
		<div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4' onClick={onClose}>
			<Card className='w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-primary/20' onClick={e => e.stopPropagation()}>
				<CardHeader className='flex flex-row items-center justify-between border-b border-primary/20'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>
						{playerName}&apos;s Picks - Week {week}
					</CardTitle>
					<Button variant='ghost' size='icon' onClick={onClose} className='h-8 w-8'>
						<X className='h-4 w-4' />
					</Button>
				</CardHeader>
				<CardContent className='p-6'>
					{error && (
						<div className='mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive'>
							{error}
						</div>
					)}

					<div className='space-y-4'>
						{/* Game Picks - Only show games that have started */}
						<div>
							<h3 className='text-lg font-medium mb-4'>Game Picks</h3>
							<div className='space-y-3'>
								{picks.map((pick, index) => {
									const game = games.find(g => g.id === pick.gameId);
									if (!game) return null;

									const gameStarted = hasGameStarted(game);
									const gameFinished = hasGameFinished(game);
									const isCorrect = isPickCorrect(pick, game);
									const scores = getGameScore(game);

									// Only show picks for games that have started
									if (!gameStarted) {
										return (
											<div key={pick.gameId} className='relative rounded-lg overflow-hidden bg-card border-2 border-primary/20 opacity-50'>
												<div className='absolute px-2 py-1 rounded-full text-xs font-medium top-2 left-2 z-10 bg-primary text-black'>
													Pick {index + 1}
												</div>
												<div className='absolute px-2 py-1 top-2 right-2 rounded-full text-xs font-medium bg-muted text-muted-foreground z-10'>
													Not Started
												</div>
												<div className='mt-8'>
													<GameCard game={game} selected={pick.team} showScores={false} disabled={true} isCorrect={null} noHover={true} />
												</div>
											</div>
										);
									}

									return (
										<div key={pick.gameId} className='relative rounded-lg overflow-hidden bg-card border-2 border-primary/20'>
											<div className='absolute px-2 py-1 rounded-full text-xs font-medium top-2 left-2 z-10 bg-primary text-black'>
												Pick {index + 1}
											</div>
											{gameFinished && (
												<div className={`absolute px-2 py-1 rounded-full text-xs font-medium top-2 right-2 z-10 ${
													isCorrect === true ? 'bg-green-500 text-black' : isCorrect === false ? 'bg-red-500 text-black' : 'bg-muted text-muted-foreground'
												}`}>
													{isCorrect === true ? '+2 pts' : isCorrect === false ? '0 pts' : 'Pending'}
												</div>
											)}
											<div className='mt-8'>
												<GameCard
													game={{
														...game,
														away: { ...game.away, score: scores.away },
														home: { ...game.home, score: scores.home }
													}}
													selected={pick.team}
													showScores={gameFinished}
													disabled={true}
													isCorrect={isCorrect}
													noHover={true}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* TFS Prediction */}
						{tfsGame && (
							<div>
								<h3 className='text-lg font-medium mb-4'>Total Final Score Prediction</h3>
								<div className='p-4 rounded-lg bg-card border-2 border-primary/20'>
									{(() => {
										const tfsGameObj = games.find(g => g.id === tfsGame);
										if (!tfsGameObj) return null;

										const tfsGameStarted = hasGameStarted(tfsGameObj);
										const tfsGameFinished = hasGameFinished(tfsGameObj);
										const scores = getGameScore(tfsGameObj);

										return (
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
														<span className='text-lg font-bold'>
															{tfsGameFinished && scores.total !== undefined ? scores.total : tfsGameStarted ? 'In Progress' : 'TBD'}
														</span>
													</div>
												</div>
											</div>
										);
									})()}
								</div>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

