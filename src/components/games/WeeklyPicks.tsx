// src/components/games/WeeklyPicks.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GameCard } from './GameCard';
import { NFLService } from '@/services/nflService';

interface WeeklyPicksProps {
	currentWeek: number;
}

interface Pick {
	gameId: string;
	team: string;
	opponent: string;
	isHome: boolean;
}

export function WeeklyPicks({ currentWeek }: WeeklyPicksProps) {
	const [games, setGames] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [picks, setPicks] = useState<Pick[]>([]);
	const [tfsGame, setTFSGame] = useState('');
	const [tfsScore, setTFSScore] = useState('');
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		loadWeeklyGames();
	}, [currentWeek]);

	const loadWeeklyGames = async () => {
		try {
			setLoading(true);
			const weeklyGames = await NFLService.getWeeklyGames(currentWeek);
			setGames(weeklyGames);
		} catch (error) {
			console.error('Error loading games:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleTeamSelect = (gameId: string, selectedTeam: string, opponent: string, isHome: boolean) => {
		if (picks.length >= 5 && !picks.find(p => p.gameId === gameId)) {
			alert('You can only select 5 games');
			return;
		}

		setPicks(current => {
			const existing = current.findIndex(p => p.gameId === gameId);
			if (existing !== -1) {
				const newPicks = [...current];
				newPicks[existing] = { gameId, team: selectedTeam, opponent, isHome };
				return newPicks;
			}
			return [...current, { gameId, team: selectedTeam, opponent, isHome }];
		});
	};

	const handleSubmit = async () => {
		if (picks.length !== 5) {
			alert('Please select exactly 5 games');
			return;
		}

		if (!tfsGame || !tfsScore) {
			alert('Please select a TFS game and enter a predicted score');
			return;
		}

		// Save to localStorage
		localStorage.setItem(
			`week${currentWeek}picks`,
			JSON.stringify({
				picks,
				tfsGame,
				tfsScore,
				submitted: true
			})
		);
		setSubmitted(true);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Week {currentWeek} Picks</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<Alert>
						<AlertDescription>Loading games...</AlertDescription>
					</Alert>
				) : (
					<div className='space-y-4'>
						{games.map(game => (
							<GameCard
								key={game.id}
								game={{
									id: game.id,
									home: game.home,
									away: game.away,
									date: game.date,
									status: game.status
								}}
								selected={picks.find(p => p.gameId === game.id)?.team}
								onSelect={handleTeamSelect}
								disabled={submitted || (picks.length >= 5 && !picks.find(p => p.gameId === game.id))}
							/>
						))}

						<div className='mt-6 space-y-4'>
							<div>
								<h3 className='text-lg font-medium mb-2'>Total Final Score Prediction</h3>
								<select className='w-full p-2 border rounded mb-2' value={tfsGame} onChange={e => setTFSGame(e.target.value)} disabled={submitted}>
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
								<Input type='number' placeholder='Predicted Total Score' value={tfsScore} onChange={e => setTFSScore(e.target.value)} disabled={submitted} />
							</div>

							<Button className='w-full' onClick={handleSubmit} disabled={submitted || picks.length !== 5 || !tfsGame || !tfsScore}>
								{submitted ? 'Picks Submitted' : 'Submit Picks'}
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
