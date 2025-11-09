'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface Game {
	id: string;
	homeTeam: string;
	awayTeam: string;
	status: string;
	date: string;
	homeScore?: number;
	awayScore?: number;
	hasOdds: boolean;
}

interface OddsInput {
	gameId: string;
	homeOdds: string;
	awayOdds: string;
}

export default function BulkFixOddsPage() {
	const [loading, setLoading] = useState(true);
	const [games, setGames] = useState<Game[]>([]);
	const [week, setWeek] = useState<number>(10);
	const [oddsInputs, setOddsInputs] = useState<Record<string, OddsInput>>({});
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<any>(null);

	useEffect(() => {
		loadGames();
	}, [week]);

	const loadGames = async () => {
		setLoading(true);
		try {
			const response = await fetch(`/api/admin/games-missing-odds?week=${week}`);
			const data = await response.json();

			if (data.games) {
				setGames(data.games);

				// Initialize odds inputs for games without odds
				const initialInputs: Record<string, OddsInput> = {};
				data.games.forEach((game: Game) => {
					if (!game.hasOdds) {
						initialInputs[game.id] = {
							gameId: game.id,
							homeOdds: '',
							awayOdds: ''
						};
					}
				});
				setOddsInputs(initialInputs);
			}
		} catch (error) {
			console.error('Error loading games:', error);
		} finally {
			setLoading(false);
		}
	};

	const updateOddsInput = (gameId: string, field: 'homeOdds' | 'awayOdds', value: string) => {
		setOddsInputs(prev => ({
			...prev,
			[gameId]: {
				...prev[gameId],
				[field]: value
			}
		}));
	};

	const handleSubmitAll = async () => {
		setSubmitting(true);
		setResult(null);

		try {
			const oddsToCreate = Object.values(oddsInputs).filter(
				input => input.homeOdds && input.awayOdds
			);

			const results = await Promise.all(
				oddsToCreate.map(async input => {
					const game = games.find(g => g.id === input.gameId);
					if (!game) return null;

					const response = await fetch('/api/admin/create-odds-snapshot', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							gameId: game.id,
							week,
							homeTeam: game.homeTeam,
							awayTeam: game.awayTeam,
							homeOdds: parseInt(input.homeOdds),
							awayOdds: parseInt(input.awayOdds)
						})
					});

					return response.json();
				})
			);

			setResult({
				success: true,
				message: `Created odds snapshots for ${results.filter(r => r?.success).length} games`,
				results
			});

			// Reload games to update status
			await loadGames();
		} catch (error) {
			setResult({
				success: false,
				error: 'Failed to create odds snapshots',
				details: String(error)
			});
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen p-4 pt-8 flex items-center justify-center'>
				<Spinner />
			</div>
		);
	}

	const gamesWithoutOdds = games.filter(g => !g.hasOdds);
	const gamesWithOdds = games.filter(g => g.hasOdds);

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-4xl mx-auto space-y-6'>
				<div className='flex items-center justify-between'>
					<h1 className='text-4xl font-display font-bold gradient-text'>Bulk Fix Missing Odds</h1>
					<div className='flex items-center gap-2'>
						<Label htmlFor='week'>Week:</Label>
						<Input
							id='week'
							type='number'
							value={week}
							onChange={e => setWeek(parseInt(e.target.value))}
							className='w-20'
						/>
					</div>
				</div>

				<Alert>
					<AlertDescription>
						<strong>Summary:</strong> {gamesWithoutOdds.length} games missing odds, {gamesWithOdds.length} games have odds
					</AlertDescription>
				</Alert>

				{gamesWithoutOdds.length > 0 && (
					<Card className='glass border-white/10'>
						<CardHeader>
							<CardTitle>Games Missing Odds</CardTitle>
							<p className='text-sm text-muted-foreground'>Enter pre-game odds for each game below</p>
						</CardHeader>
						<CardContent className='space-y-6'>
							{gamesWithoutOdds.map(game => (
								<div key={game.id} className='border border-white/10 rounded-lg p-4 space-y-3'>
									<div className='flex items-center justify-between'>
										<div>
											<h3 className='font-semibold text-lg'>
												{game.awayTeam} @ {game.homeTeam}
											</h3>
											<p className='text-sm text-muted-foreground'>
												{new Date(game.date).toLocaleString()} • Status: {game.status}
												{game.homeScore !== undefined && ` • Score: ${game.awayTeam} ${game.awayScore} - ${game.homeTeam} ${game.homeScore}`}
											</p>
											<p className='text-xs text-muted-foreground mt-1'>Game ID: {game.id}</p>
										</div>
									</div>

									<div className='grid grid-cols-2 gap-4'>
										<div className='space-y-2'>
											<Label htmlFor={`home-${game.id}`}>
												{game.homeTeam} Odds (Home)
											</Label>
											<Input
												id={`home-${game.id}`}
												placeholder='-150'
												value={oddsInputs[game.id]?.homeOdds || ''}
												onChange={e => updateOddsInput(game.id, 'homeOdds', e.target.value)}
												className='glass'
											/>
										</div>
										<div className='space-y-2'>
											<Label htmlFor={`away-${game.id}`}>
												{game.awayTeam} Odds (Away)
											</Label>
											<Input
												id={`away-${game.id}`}
												placeholder='+130'
												value={oddsInputs[game.id]?.awayOdds || ''}
												onChange={e => updateOddsInput(game.id, 'awayOdds', e.target.value)}
												className='glass'
											/>
										</div>
									</div>
								</div>
							))}

							<Button
								onClick={handleSubmitAll}
								disabled={submitting || Object.values(oddsInputs).every(o => !o.homeOdds || !o.awayOdds)}
								className='w-full'
							>
								{submitting ? 'Creating Odds Snapshots...' : 'Submit All Odds'}
							</Button>

							{result && (
								<div className={`p-4 rounded-lg ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
									<pre className='text-sm whitespace-pre-wrap'>{JSON.stringify(result, null, 2)}</pre>
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{gamesWithOdds.length > 0 && (
					<Card className='glass border-white/10'>
						<CardHeader>
							<CardTitle>Games With Odds ✓</CardTitle>
						</CardHeader>
						<CardContent className='space-y-3'>
							{gamesWithOdds.map(game => (
								<div key={game.id} className='border border-green-500/20 rounded-lg p-3 bg-green-500/5'>
									<h3 className='font-semibold'>
										{game.awayTeam} @ {game.homeTeam}
									</h3>
									<p className='text-sm text-muted-foreground'>
										{new Date(game.date).toLocaleString()} • Status: {game.status}
									</p>
								</div>
							))}
						</CardContent>
					</Card>
				)}

				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle>Quick Reference: Odds to Points</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-2 gap-4 text-sm'>
							<div>
								<h4 className='font-semibold mb-2'>Favorites (Negative)</h4>
								<ul className='space-y-1 text-muted-foreground'>
									<li>-350 to -450 = 1 point</li>
									<li>-200 to -280 = 2 points</li>
									<li>-150 to -180 = 3 points</li>
									<li>-120 to -140 = 4 points</li>
								</ul>
							</div>
							<div>
								<h4 className='font-semibold mb-2'>Underdogs (Positive)</h4>
								<ul className='space-y-1 text-muted-foreground'>
									<li>+100 to +120 = 5 points</li>
									<li>+140 to +180 = 6 points</li>
									<li>+200 to +250 = 7 points</li>
									<li>+280 to +350 = 8 points</li>
									<li>+400+ = 9-10 points</li>
								</ul>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
