'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle2 } from 'lucide-react';

interface League {
	_id: string;
	name: string;
	mode: string;
}

interface User {
	_id: string;
	name: string;
	email: string;
}

interface Game {
	id: string;
	away: { team: string; odds?: number };
	home: { team: string; odds?: number };
	status: string;
}

export default function ManualPicksAdmin() {
	const { data: session, status } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');

	// Form state
	const [leagues, setLeagues] = useState<League[]>([]);
	const [selectedLeague, setSelectedLeague] = useState('');
	const [leagueMode, setLeagueMode] = useState('standard');
	const [week, setWeek] = useState('11');
	const [users, setUsers] = useState<User[]>([]);
	const [selectedUser, setSelectedUser] = useState('');
	const [games, setGames] = useState<Game[]>([]);
	const [selectedGames, setSelectedGames] = useState<string[]>([]);
	const [selectedTeams, setSelectedTeams] = useState<{ [gameId: string]: string }>({});
	const [tfsGame, setTfsGame] = useState('');
	const [tfsScore, setTfsScore] = useState('');

	// Fetch leagues on mount
	useEffect(() => {
		const fetchLeagues = async () => {
			try {
				const response = await fetch('/api/league/list');
				if (response.ok) {
					const data = await response.json();
					setLeagues(data.leagues || []);
				}
			} catch (err) {
				console.error('Error fetching leagues:', err);
			}
		};

		if (status === 'authenticated') {
			fetchLeagues();
		}
	}, [status]);

	// Fetch league members when league is selected
	useEffect(() => {
		const fetchMembers = async () => {
			if (!selectedLeague) return;

			try {
				const response = await fetch(`/api/league/${selectedLeague}/members`);
				if (response.ok) {
					const members = await response.json();
					setUsers(members);
				}

				// Get league mode
				const leagueResponse = await fetch(`/api/league/${selectedLeague}`);
				if (leagueResponse.ok) {
					const leagueData = await leagueResponse.json();
					setLeagueMode(leagueData.mode || 'standard');
				}
			} catch (err) {
				console.error('Error fetching members:', err);
			}
		};

		fetchMembers();
	}, [selectedLeague]);

	// Fetch games when week is selected
	useEffect(() => {
		const fetchGames = async () => {
			if (!week) return;

			try {
				setLoading(true);
				const response = await fetch(`/api/games/week/${week}`);
				if (response.ok) {
					const data = await response.json();
					let gamesData = data.games || [];

					// Fetch odds for standard mode
					if (leagueMode === 'standard') {
						try {
							const oddsResponse = await fetch(`/api/odds/snapshot?week=${week}`);
							if (oddsResponse.ok) {
								const oddsData = await oddsResponse.json();
								const snapshotOdds = oddsData.odds || [];

								gamesData = gamesData.map((game: Game) => {
									const gameOdds = snapshotOdds.find((o: any) => o.id === game.id);
									return {
										...game,
										home: { ...game.home, odds: gameOdds?.home?.odds },
										away: { ...game.away, odds: gameOdds?.away?.odds }
									};
								});
							}
						} catch (err) {
							console.error('Error fetching odds:', err);
						}
					}

					setGames(gamesData);
				}
			} catch (err) {
				console.error('Error fetching games:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchGames();
	}, [week, leagueMode]);

	const handleGameSelection = (gameId: string) => {
		setSelectedGames(prev => {
			if (prev.includes(gameId)) {
				// Remove game
				const newGames = prev.filter(id => id !== gameId);
				// Remove team selection for this game
				const newTeams = { ...selectedTeams };
				delete newTeams[gameId];
				setSelectedTeams(newTeams);
				return newGames;
			} else {
				// Add game (max 5)
				if (prev.length >= 5) {
					setError('You can only select 5 games');
					setTimeout(() => setError(''), 3000);
					return prev;
				}
				return [...prev, gameId];
			}
		});
	};

	const handleTeamSelection = (gameId: string, team: string) => {
		setSelectedTeams(prev => ({ ...prev, [gameId]: team }));
	};

	const handleSubmit = async () => {
		// Validation
		if (!selectedLeague) {
			setError('Please select a league');
			return;
		}
		if (!selectedUser) {
			setError('Please select a user');
			return;
		}
		if (selectedGames.length !== 5) {
			setError('Please select exactly 5 games');
			return;
		}
		if (Object.keys(selectedTeams).length !== 5) {
			setError('Please select a team for each game');
			return;
		}
		if (leagueMode === 'steve' && (!tfsGame || !tfsScore)) {
			setError('Please select TFS game and enter TFS score for Steve mode');
			return;
		}

		try {
			setSubmitting(true);
			setError('');
			setMessage('');

			// Build picks array
			const picks = selectedGames.map(gameId => {
				const game = games.find(g => g.id === gameId);
				const selectedTeam = selectedTeams[gameId];
				const isHome = selectedTeam === game?.home.team;

				return {
					gameId,
					team: selectedTeam,
					opponent: isHome ? game?.away.team : game?.home.team,
					isHome,
					odds: isHome ? game?.home.odds : game?.away.odds
				};
			});

			const payload = {
				userId: selectedUser,
				leagueId: selectedLeague,
				week: parseInt(week),
				picks,
				tfsGame: leagueMode === 'steve' ? tfsGame : null,
				tfsScore: leagueMode === 'steve' ? parseInt(tfsScore) : null
			};

			const response = await fetch('/api/admin/manual-picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				const data = await response.json();
				setMessage(data.message || 'Picks submitted successfully!');
				// Reset form
				setSelectedGames([]);
				setSelectedTeams({});
				setTfsGame('');
				setTfsScore('');
			} else {
				const data = await response.json();
				setError(data.error || 'Failed to submit picks');
			}
		} catch (err) {
			console.error('Error submitting picks:', err);
			setError('An error occurred while submitting picks');
		} finally {
			setSubmitting(false);
		}
	};

	if (status === 'loading') {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<Spinner />
			</div>
		);
	}

	if (!session) {
		router.push('/login');
		return null;
	}

	return (
		<div className='container mx-auto px-4 py-8 max-w-5xl'>
			<Card className='bg-card border-primary/20'>
				<CardHeader>
					<CardTitle className='text-2xl font-oswald uppercase tracking-wide text-primary'>Manual Picks Entry</CardTitle>
					<p className='text-sm text-muted-foreground'>Enter picks for a user even after games have started</p>
				</CardHeader>
				<CardContent className='space-y-6'>
					{/* League Selection */}
					<div>
						<label className='text-sm font-medium text-foreground mb-2 block'>Select League</label>
						<Select value={selectedLeague} onValueChange={setSelectedLeague}>
							<SelectTrigger>
								<SelectValue placeholder='Choose a league' />
							</SelectTrigger>
							<SelectContent>
								{leagues.map(league => (
									<SelectItem key={league._id} value={league._id}>
										{league.name} ({league.mode})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Week Selection */}
					<div>
						<label className='text-sm font-medium text-foreground mb-2 block'>Week</label>
						<Input type='number' min='1' max='18' value={week} onChange={e => setWeek(e.target.value)} placeholder='Week number' />
					</div>

					{/* User Selection */}
					{selectedLeague && (
						<div>
							<label className='text-sm font-medium text-foreground mb-2 block'>Select User</label>
							<Select value={selectedUser} onValueChange={setSelectedUser}>
								<SelectTrigger>
									<SelectValue placeholder='Choose a user' />
								</SelectTrigger>
								<SelectContent>
									{users.map(user => (
										<SelectItem key={user._id} value={user._id}>
											{user.name} ({user.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Games Selection */}
					{games.length > 0 && (
						<div>
							<label className='text-sm font-medium text-foreground mb-2 block'>
								Select 5 Games ({selectedGames.length}/5 selected)
							</label>
							<div className='space-y-3'>
								{games.map(game => (
									<Card
										key={game.id}
										className={`cursor-pointer transition-all ${selectedGames.includes(game.id) ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}
										onClick={() => handleGameSelection(game.id)}>
										<CardContent className='p-4'>
											<div className='flex items-center justify-between'>
												<div className='flex-1'>
													<div className='font-semibold text-foreground'>
														{game.away.team} @ {game.home.team}
													</div>
													{leagueMode === 'standard' && (game.away.odds || game.home.odds) && (
														<div className='text-xs text-muted-foreground mt-1'>
															Away: {game.away.odds || 'N/A'} | Home: {game.home.odds || 'N/A'}
														</div>
													)}
													<div className='text-xs text-muted-foreground'>Status: {game.status}</div>
												</div>
												{selectedGames.includes(game.id) && <CheckCircle2 className='h-5 w-5 text-primary' />}
											</div>

											{/* Team Selection (only show if game is selected) */}
											{selectedGames.includes(game.id) && (
												<div className='mt-3 pt-3 border-t border-primary/20' onClick={e => e.stopPropagation()}>
													<div className='text-sm font-medium text-foreground mb-2'>Select Team:</div>
													<div className='grid grid-cols-2 gap-2'>
														<Button
															variant={selectedTeams[game.id] === game.away.team ? 'default' : 'outline'}
															onClick={() => handleTeamSelection(game.id, game.away.team)}
															className='w-full'>
															{game.away.team}
															{leagueMode === 'standard' && game.away.odds && (
																<span className='ml-2 text-xs'>({game.away.odds})</span>
															)}
														</Button>
														<Button
															variant={selectedTeams[game.id] === game.home.team ? 'default' : 'outline'}
															onClick={() => handleTeamSelection(game.id, game.home.team)}
															className='w-full'>
															{game.home.team}
															{leagueMode === 'standard' && game.home.odds && (
																<span className='ml-2 text-xs'>({game.home.odds})</span>
															)}
														</Button>
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					)}

					{/* TFS Selection (Steve mode only) */}
					{leagueMode === 'steve' && selectedGames.length > 0 && (
						<div className='space-y-4'>
							<div>
								<label className='text-sm font-medium text-foreground mb-2 block'>TFS Game</label>
								<Select value={tfsGame} onValueChange={setTfsGame}>
									<SelectTrigger>
										<SelectValue placeholder='Select TFS game' />
									</SelectTrigger>
									<SelectContent>
										{selectedGames.map(gameId => {
											const game = games.find(g => g.id === gameId);
											return (
												<SelectItem key={gameId} value={gameId}>
													{game?.away.team} @ {game?.home.team}
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className='text-sm font-medium text-foreground mb-2 block'>TFS Score Prediction</label>
								<Input type='number' min='0' value={tfsScore} onChange={e => setTfsScore(e.target.value)} placeholder='Enter predicted total score' />
							</div>
						</div>
					)}

					{/* Messages */}
					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{message && (
						<Alert className='border-green-500 bg-green-500/10'>
							<AlertDescription className='text-green-600'>{message}</AlertDescription>
						</Alert>
					)}

					{/* Submit Button */}
					<Button onClick={handleSubmit} disabled={submitting || selectedGames.length !== 5 || !selectedUser} className='w-full' size='lg'>
						{submitting ? 'Submitting...' : 'Submit Picks'}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
