'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Info, RefreshCw, Send, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer, PageHeader, Pill } from '@/components/ui/page';
import { calculatePointsFromOdds, formatOdds } from '@/utils/oddsUtils';

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

interface SnapshotResponse {
	success?: boolean;
	message?: string;
	error?: string;
	details?: string;
}

interface BulkResult {
	success: boolean;
	message?: string;
	error?: string;
	details?: string;
	results?: (SnapshotResponse | null)[];
}

export default function BulkFixOddsPage() {
	const [loading, setLoading] = useState(true);
	const [games, setGames] = useState<Game[]>([]);
	const [week, setWeek] = useState<number>(10);
	const [oddsInputs, setOddsInputs] = useState<Record<string, OddsInput>>({});
	const [submitting, setSubmitting] = useState(false);
	const [result, setResult] = useState<BulkResult | null>(null);

	const loadGames = useCallback(async () => {
		if (!Number.isFinite(week)) return;
		setLoading(true);
		try {
			const response = await fetch(`/api/admin/games-missing-odds?week=${week}`);
			const data: { games?: Game[] } = await response.json();

			if (data.games) {
				setGames(data.games);

				// Initialize odds inputs for games without odds
				const initialInputs: Record<string, OddsInput> = {};
				data.games.forEach(game => {
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
			toast.error('Failed to load games');
		} finally {
			setLoading(false);
		}
	}, [week]);

	useEffect(() => {
		loadGames();
	}, [loadGames]);

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
			const oddsToCreate = Object.values(oddsInputs).filter(input => input.homeOdds && input.awayOdds);

			const results = await Promise.all(
				oddsToCreate.map(async (input): Promise<SnapshotResponse | null> => {
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

			const created = results.filter(r => r?.success).length;
			setResult({
				success: true,
				message: `Created odds snapshots for ${created} games`,
				results
			});
			toast.success(`Created odds snapshots for ${created} games`);

			// Reload games to update status
			await loadGames();
		} catch (error) {
			setResult({
				success: false,
				error: 'Failed to create odds snapshots',
				details: String(error)
			});
			toast.error('Failed to create odds snapshots');
		} finally {
			setSubmitting(false);
		}
	};

	const gamesWithoutOdds = games.filter(g => !g.hasOdds);
	const gamesWithOdds = games.filter(g => g.hasOdds);

	return (
		<PageContainer size='narrow'>
			<PageHeader
				eyebrow='Admin · Odds'
				title='Bulk Fix Odds'
				description='Add pre-game odds for every game missing them in a week'
				actions={
					<div className='flex items-center gap-2'>
						<Label htmlFor='week' className='eyebrow'>
							Week
						</Label>
						<Input id='week' type='number' inputMode='numeric' value={Number.isFinite(week) ? week : ''} onChange={e => setWeek(parseInt(e.target.value))} className='tabular h-10 w-20' />
					</div>
				}
			/>

			{loading ? (
				<div className='space-y-4'>
					<Skeleton className='h-12 rounded-xl' />
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className='h-40 rounded-2xl' />
					))}
				</div>
			) : (
				<div className='space-y-6'>
					<div className='flex flex-wrap items-center gap-2'>
						<Pill tone={gamesWithoutOdds.length > 0 ? 'warning' : 'muted'}>
							<span className='tabular'>{gamesWithoutOdds.length}</span> missing odds
						</Pill>
						<Pill tone='accent'>
							<span className='tabular'>{gamesWithOdds.length}</span> have odds
						</Pill>
					</div>

					{gamesWithoutOdds.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className='text-xl'>Games missing odds</CardTitle>
								<CardDescription>Enter pre-game odds for each game below</CardDescription>
							</CardHeader>
							<CardContent className='space-y-4'>
								{gamesWithoutOdds.map(game => (
									<div key={game.id} className='space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4'>
										<div>
											<h3 className='font-semibold'>
												{game.awayTeam} @ {game.homeTeam}
											</h3>
											<p className='mt-0.5 text-sm text-muted-foreground'>
												{new Date(game.date).toLocaleString()} • Status: {game.status}
												{game.homeScore !== undefined && (
													<span className='tabular'>{` • Score: ${game.awayTeam} ${game.awayScore} - ${game.homeTeam} ${game.homeScore}`}</span>
												)}
											</p>
											<p className='mt-1 font-mono text-xs text-muted-foreground'>Game ID: {game.id}</p>
										</div>

										<div className='grid grid-cols-2 gap-3'>
											<div className='space-y-2'>
												<Label htmlFor={`home-${game.id}`}>{game.homeTeam} (Home)</Label>
												<Input
													id={`home-${game.id}`}
													placeholder='-150'
													value={oddsInputs[game.id]?.homeOdds || ''}
													onChange={e => updateOddsInput(game.id, 'homeOdds', e.target.value)}
													className='font-mono'
												/>
											</div>
											<div className='space-y-2'>
												<Label htmlFor={`away-${game.id}`}>{game.awayTeam} (Away)</Label>
												<Input
													id={`away-${game.id}`}
													placeholder='+130'
													value={oddsInputs[game.id]?.awayOdds || ''}
													onChange={e => updateOddsInput(game.id, 'awayOdds', e.target.value)}
													className='font-mono'
												/>
											</div>
										</div>
									</div>
								))}

								<Button onClick={handleSubmitAll} disabled={submitting || Object.values(oddsInputs).every(o => !o.homeOdds || !o.awayOdds)} size='lg' className='w-full'>
									{submitting ? <RefreshCw className='animate-spin' /> : <Send />}
									{submitting ? 'Creating odds snapshots…' : 'Submit All Odds'}
								</Button>
							</CardContent>
						</Card>
					)}

					{result && (
						<Alert variant={result.success ? 'success' : 'destructive'} className='animate-fade-in'>
							{result.success ? <CheckCircle2 /> : <XCircle />}
							<AlertTitle>{result.success ? result.message : result.error}</AlertTitle>
							<AlertDescription>
								{result.details && <p>{result.details}</p>}
								<details className='pt-1 text-foreground'>
									<summary className='cursor-pointer text-xs text-muted-foreground'>Raw response</summary>
									<pre className='mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 font-mono text-xs'>{JSON.stringify(result, null, 2)}</pre>
								</details>
							</AlertDescription>
						</Alert>
					)}

					{gamesWithoutOdds.length === 0 && gamesWithOdds.length === 0 && (
						<Alert variant='info'>
							<Info />
							<AlertDescription>No games found for week {week}.</AlertDescription>
						</Alert>
					)}

					{gamesWithOdds.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className='text-xl'>Games with odds</CardTitle>
							</CardHeader>
							<CardContent className='space-y-2'>
								{gamesWithOdds.map(game => (
									<div key={game.id} className='flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/[0.05] px-3 py-2.5'>
										<CheckCircle2 className='h-4 w-4 shrink-0 text-accent' />
										<div className='min-w-0'>
											<p className='font-semibold'>
												{game.awayTeam} @ {game.homeTeam}
											</p>
											<p className='text-xs text-muted-foreground'>
												{new Date(game.date).toLocaleString()} • Status: {game.status}
											</p>
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<CardTitle className='text-xl'>Quick reference: odds to points</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='grid grid-cols-1 gap-4 text-sm tabular sm:grid-cols-2'>
								{[
									{ title: 'Favorites (negative)', lines: [-400, -300, -200, -150, -110] },
									{ title: 'Underdogs (positive)', lines: [100, 150, 200, 300, 400, 500, 1000] }
								].map(group => (
									<div key={group.title}>
										<h4 className='eyebrow mb-2'>{group.title}</h4>
										<ul className='space-y-1 text-muted-foreground'>
											{group.lines.map(odds => (
												<li key={odds}>
													{formatOdds(odds)} = {calculatePointsFromOdds(odds)} pts
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</PageContainer>
	);
}
