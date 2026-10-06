'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, RefreshCw, Send, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer, PageHeader, Pill } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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

interface SnapshotOdds {
	id: string;
	home?: { odds?: number };
	away?: { odds?: number };
}

function formatOdds(odds?: number): string {
	if (odds === undefined || odds === null) return 'N/A';
	return odds > 0 ? `+${odds}` : String(odds);
}

export default function ManualPicksAdmin() {
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
					const data: { leagues?: League[] } = await response.json();
					setLeagues(data.leagues || []);
				}
			} catch (err) {
				console.error('Error fetching leagues:', err);
			}
		};

		fetchLeagues();
	}, []);

	// Fetch league members and mode when league is selected
	useEffect(() => {
		const fetchMembers = async () => {
			if (!selectedLeague) return;

			try {
				const [membersResponse, leagueResponse] = await Promise.all([fetch(`/api/league/${selectedLeague}/members`), fetch(`/api/league/${selectedLeague}`)]);
				if (membersResponse.ok) {
					const members: User[] = await membersResponse.json();
					setUsers(members);
				}
				if (leagueResponse.ok) {
					const leagueData: { mode?: string } = await leagueResponse.json();
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
					const data: { games?: Game[] } = await response.json();
					let gamesData = data.games || [];

					// Fetch odds for standard mode
					if (leagueMode === 'standard') {
						try {
							const oddsResponse = await fetch(`/api/odds/snapshot?week=${week}`);
							if (oddsResponse.ok) {
								const oddsData: { odds?: SnapshotOdds[] } = await oddsResponse.json();
								const snapshotOdds = oddsData.odds || [];

								gamesData = gamesData.map(game => {
									const gameOdds = snapshotOdds.find(o => o.id === game.id);
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
		if (selectedGames.includes(gameId)) {
			// Remove game and its team selection
			setSelectedGames(prev => prev.filter(id => id !== gameId));
			setSelectedTeams(prev => {
				const next = { ...prev };
				delete next[gameId];
				return next;
			});
			return;
		}
		// Add game (max 5)
		if (selectedGames.length >= 5) {
			toast.error('You can only select 5 games');
			return;
		}
		setSelectedGames(prev => [...prev, gameId]);
	};

	const handleTeamSelection = (gameId: string, team: string) => {
		setSelectedTeams(prev => ({ ...prev, [gameId]: team }));
	};

	const fail = (msg: string) => {
		setError(msg);
		toast.error(msg);
	};

	const handleSubmit = async () => {
		// Validation
		if (!selectedLeague) return fail('Please select a league');
		if (!selectedUser) return fail('Please select a user');
		if (selectedGames.length !== 5) return fail('Please select exactly 5 games');
		if (Object.keys(selectedTeams).length !== 5) return fail('Please select a team for each game');
		if (leagueMode === 'steve' && (!tfsGame || !tfsScore)) return fail('Please select TFS game and enter TFS score for Steve mode');

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

			const data: { message?: string; error?: string } = await response.json();
			if (response.ok) {
				const msg = data.message || 'Picks submitted successfully!';
				setMessage(msg);
				toast.success(msg);
				// Reset form
				setSelectedGames([]);
				setSelectedTeams({});
				setTfsGame('');
				setTfsScore('');
			} else {
				fail(data.error || 'Failed to submit picks');
			}
		} catch (err) {
			console.error('Error submitting picks:', err);
			fail('An error occurred while submitting picks');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<PageContainer size='narrow'>
			<PageHeader eyebrow='Admin · Picks' title='Manual Picks' description='Enter picks for a user even after games have started' />

			<div className='space-y-6'>
				<Card>
					<CardContent className='grid gap-4 p-5 sm:grid-cols-2 sm:p-6'>
						<div className='space-y-2 sm:col-span-2'>
							<Label>League</Label>
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

						<div className='space-y-2'>
							<Label htmlFor='week'>Week</Label>
							<Input id='week' type='number' inputMode='numeric' min='1' max='18' value={week} onChange={e => setWeek(e.target.value)} placeholder='Week number' className='tabular' />
						</div>

						<div className='space-y-2'>
							<Label>User</Label>
							<Select value={selectedUser} onValueChange={setSelectedUser} disabled={!selectedLeague}>
								<SelectTrigger>
									<SelectValue placeholder={selectedLeague ? 'Choose a user' : 'Select a league first'} />
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
					</CardContent>
				</Card>

				{/* Games Selection */}
				{loading ? (
					<div className='space-y-2'>
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className='h-16 rounded-xl' />
						))}
					</div>
				) : (
					games.length > 0 && (
						<Card>
							<CardContent className='p-4 sm:p-6'>
								<div className='mb-4 flex items-center justify-between gap-3'>
									<h2 className='font-display text-xl font-bold uppercase italic tracking-tight'>Select 5 games</h2>
									<Pill tone={selectedGames.length === 5 ? 'accent' : 'primary'}>
										<span className='tabular'>{selectedGames.length}/5</span> selected
									</Pill>
								</div>
								<div className='space-y-2'>
									{games.map(game => {
										const isSelected = selectedGames.includes(game.id);
										return (
											<div
												key={game.id}
												className={cn(
													'rounded-xl border transition-colors',
													isSelected ? 'border-primary/40 bg-primary/[0.08]' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'
												)}>
												<button type='button' onClick={() => handleGameSelection(game.id)} className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
													{isSelected ? <CheckCircle2 className='h-5 w-5 shrink-0 text-primary' /> : <Circle className='h-5 w-5 shrink-0 text-muted-foreground/50' />}
													<div className='min-w-0 flex-1'>
														<div className='font-semibold text-foreground'>
															{game.away.team} @ {game.home.team}
														</div>
														<div className='mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground'>
															{leagueMode === 'standard' && (game.away.odds || game.home.odds) && (
																<span className='font-mono'>
																	Away {formatOdds(game.away.odds)} · Home {formatOdds(game.home.odds)}
																</span>
															)}
															<span>Status: {game.status}</span>
														</div>
													</div>
												</button>

												{/* Team Selection (only show if game is selected) */}
												{isSelected && (
													<div className='grid grid-cols-2 gap-2 border-t border-white/[0.07] p-3'>
														{[game.away, game.home].map(side => (
															<Button key={side.team} variant={selectedTeams[game.id] === side.team ? 'default' : 'outline'} onClick={() => handleTeamSelection(game.id, side.team)} className='h-auto min-h-10 w-full whitespace-normal py-2'>
																{side.team}
																{leagueMode === 'standard' && side.odds && <span className='font-mono text-xs opacity-80'>({formatOdds(side.odds)})</span>}
															</Button>
														))}
													</div>
												)}
											</div>
										);
									})}
								</div>
							</CardContent>
						</Card>
					)
				)}

				{/* TFS Selection (Steve mode only) */}
				{leagueMode === 'steve' && selectedGames.length > 0 && (
					<Card>
						<CardContent className='grid gap-4 p-5 sm:grid-cols-2 sm:p-6'>
							<div className='space-y-2'>
								<Label>TFS game</Label>
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
							<div className='space-y-2'>
								<Label htmlFor='tfs-score'>TFS score prediction</Label>
								<Input id='tfs-score' type='number' inputMode='numeric' min='0' value={tfsScore} onChange={e => setTfsScore(e.target.value)} placeholder='Predicted total score' className='tabular' />
							</div>
						</CardContent>
					</Card>
				)}

				{/* Messages */}
				{error && (
					<Alert variant='destructive'>
						<XCircle />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{message && (
					<Alert variant='success'>
						<CheckCircle2 />
						<AlertDescription>{message}</AlertDescription>
					</Alert>
				)}

				<Button onClick={handleSubmit} disabled={submitting || selectedGames.length !== 5 || !selectedUser} className='w-full' size='lg'>
					{submitting ? <RefreshCw className='animate-spin' /> : <Send />}
					{submitting ? 'Submitting…' : 'Submit Picks'}
				</Button>
			</div>
		</PageContainer>
	);
}
