'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function FixOddsPage() {
	const [gameId, setGameId] = useState('401772636');
	const [week, setWeek] = useState('10');
	const [homeTeam, setHomeTeam] = useState('Indianapolis Colts');
	const [awayTeam, setAwayTeam] = useState('Atlanta Falcons');
	const [homeOdds, setHomeOdds] = useState('-350');
	const [awayOdds, setAwayOdds] = useState('350');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setResult(null);

		try {
			const payload = {
				gameId,
				week: parseInt(week),
				homeTeam,
				awayTeam,
				homeOdds: parseInt(homeOdds),
				awayOdds: parseInt(awayOdds)
			};

			// Step 1: Update existing picks
			const picksResponse = await fetch('/api/admin/fix-game-odds', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const picksData = await picksResponse.json();

			// Step 2: Create/update odds snapshot so everyone sees correct odds
			const snapshotResponse = await fetch('/api/admin/create-odds-snapshot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const snapshotData = await snapshotResponse.json();

			// Combine results
			setResult({
				success: picksData.success && snapshotData.success,
				picksUpdated: picksData,
				snapshotCreated: snapshotData
			});
		} catch (error) {
			setResult({ error: 'Failed to update odds', details: String(error) });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-2xl mx-auto space-y-8'>
				<h1 className='text-4xl font-display font-bold gradient-text text-center'>Fix Game Odds</h1>

				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle>Update Pre-Game Odds</CardTitle>
						<p className='text-sm text-muted-foreground mt-2'>
							This will update odds for existing user picks AND create an odds snapshot so everyone sees the correct odds.
						</p>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='gameId'>Game ID (from ESPN)</Label>
								<Input
									id='gameId'
									value={gameId}
									onChange={e => setGameId(e.target.value)}
									placeholder='e.g., 401671760'
									required
									className='glass'
								/>
								<p className='text-xs text-muted-foreground'>
									Find the game ID by looking at the ESPN URL or checking the network requests
								</p>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='week'>Week Number</Label>
								<Input
									id='week'
									type='number'
									value={week}
									onChange={e => setWeek(e.target.value)}
									required
									className='glass'
								/>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='homeTeam'>Home Team (Full Name)</Label>
								<Input
									id='homeTeam'
									value={homeTeam}
									onChange={e => setHomeTeam(e.target.value)}
									placeholder='e.g., Indianapolis Colts'
									required
									className='glass'
								/>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='awayTeam'>Away Team (Full Name)</Label>
								<Input
									id='awayTeam'
									value={awayTeam}
									onChange={e => setAwayTeam(e.target.value)}
									placeholder='e.g., Atlanta Falcons'
									required
									className='glass'
								/>
							</div>

							<div className='grid grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label htmlFor='homeOdds'>Home Team Odds</Label>
									<Input
										id='homeOdds'
										value={homeOdds}
										onChange={e => setHomeOdds(e.target.value)}
										placeholder='-350 (favorite)'
										required
										className='glass'
									/>
									<p className='text-xs text-muted-foreground'>
										Negative for favorites (e.g., -350 = 1 pt)
									</p>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='awayOdds'>Away Team Odds</Label>
									<Input
										id='awayOdds'
										value={awayOdds}
										onChange={e => setAwayOdds(e.target.value)}
										placeholder='350 (underdog)'
										required
										className='glass'
									/>
									<p className='text-xs text-muted-foreground'>
										Positive for underdogs (e.g., +350 = 8 pts)
									</p>
								</div>
							</div>

							<Button type='submit' disabled={loading} className='w-full'>
								{loading ? 'Updating...' : 'Fix Odds for This Game'}
							</Button>
						</form>

						{result && (
							<div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
								<pre className='text-sm whitespace-pre-wrap'>{JSON.stringify(result, null, 2)}</pre>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle>How to Find Game ID</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div>
							<h3 className='font-semibold mb-2'>Method 1: From ESPN URL</h3>
							<p className='text-sm text-muted-foreground'>
								Go to ESPN.com, find the game, and look at the URL:
								<br />
								<code className='text-xs bg-black/20 px-2 py-1 rounded mt-1 inline-block'>
									espn.com/nfl/game/_/gameId/<strong>401671760</strong>/...
								</code>
							</p>
						</div>

						<div>
							<h3 className='font-semibold mb-2'>Method 2: From Network Requests</h3>
							<p className='text-sm text-muted-foreground'>
								1. Go to the league page and open browser DevTools (F12)
								<br />
								2. Go to Network tab
								<br />
								3. Look for requests to ESPN API
								<br />
								4. Find the game ID in the response
							</p>
						</div>

						<div>
							<h3 className='font-semibold mb-2'>Point Values Reference</h3>
							<ul className='text-sm text-muted-foreground space-y-1'>
								<li>• 1 point ≈ -350 to -450 odds (heavy favorite)</li>
								<li>• 2 points ≈ -200 to -280 odds</li>
								<li>• 3 points ≈ -150 to -180 odds</li>
								<li>• 4 points ≈ -120 to -140 odds</li>
								<li>• 5 points ≈ EVEN to +120 odds</li>
								<li>• 6 points ≈ +140 to +180 odds</li>
								<li>• 7 points ≈ +200 to +250 odds</li>
								<li>• 8 points ≈ +280 to +350 odds</li>
								<li>• 9-10 points ≈ +400+ odds (big underdog)</li>
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
