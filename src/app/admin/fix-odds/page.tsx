'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Crosshair, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer, PageHeader } from '@/components/ui/page';

interface ApiResult {
	success?: boolean;
	message?: string;
	error?: string;
	details?: unknown;
}

interface FixOddsResult {
	success: boolean;
	picksUpdated?: ApiResult;
	snapshotCreated?: ApiResult;
	error?: string;
	details?: string;
}

const POINT_VALUES = [
	'1 point ≈ -350 to -450 odds (heavy favorite)',
	'2 points ≈ -200 to -280 odds',
	'3 points ≈ -150 to -180 odds',
	'4 points ≈ -120 to -140 odds',
	'5 points ≈ EVEN to +120 odds',
	'6 points ≈ +140 to +180 odds',
	'7 points ≈ +200 to +250 odds',
	'8 points ≈ +280 to +350 odds',
	'9-10 points ≈ +400+ odds (big underdog)'
];

export default function FixOddsPage() {
	const [gameId, setGameId] = useState('401772636');
	const [week, setWeek] = useState('10');
	const [homeTeam, setHomeTeam] = useState('Indianapolis Colts');
	const [awayTeam, setAwayTeam] = useState('Atlanta Falcons');
	const [homeOdds, setHomeOdds] = useState('-350');
	const [awayOdds, setAwayOdds] = useState('350');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<FixOddsResult | null>(null);

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
			const picksData: ApiResult = await picksResponse.json();

			// Step 2: Create/update odds snapshot so everyone sees correct odds
			const snapshotResponse = await fetch('/api/admin/create-odds-snapshot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const snapshotData: ApiResult = await snapshotResponse.json();

			const success = Boolean(picksData.success && snapshotData.success);
			setResult({ success, picksUpdated: picksData, snapshotCreated: snapshotData });
			if (success) toast.success('Odds updated for this game');
			else toast.error(picksData.error || snapshotData.error || 'Failed to update odds');
		} catch (error) {
			setResult({ success: false, error: 'Failed to update odds', details: String(error) });
			toast.error('Failed to update odds');
		} finally {
			setLoading(false);
		}
	};

	const steps: { label: string; data?: ApiResult }[] = result
		? [
				{ label: 'Update picks', data: result.picksUpdated },
				{ label: 'Odds snapshot', data: result.snapshotCreated }
			]
		: [];

	return (
		<PageContainer size='narrow'>
			<PageHeader eyebrow='Admin · Odds' title='Fix Game Odds' description='Update pre-game odds for a single game' />

			<div className='space-y-6'>
				<Card>
					<CardHeader>
						<CardTitle className='text-xl'>Update pre-game odds</CardTitle>
						<CardDescription>This will update odds for existing user picks AND create an odds snapshot so everyone sees the correct odds.</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className='space-y-4'>
							<div className='space-y-2'>
								<Label htmlFor='gameId'>Game ID (from ESPN)</Label>
								<Input id='gameId' value={gameId} onChange={e => setGameId(e.target.value)} placeholder='e.g., 401671760' required className='font-mono' />
								<p className='text-xs text-muted-foreground'>Find the game ID by looking at the ESPN URL or checking the network requests</p>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='week'>Week number</Label>
								<Input id='week' type='number' inputMode='numeric' value={week} onChange={e => setWeek(e.target.value)} required className='tabular' />
							</div>

							<div className='grid gap-4 sm:grid-cols-2'>
								<div className='space-y-2'>
									<Label htmlFor='homeTeam'>Home team (full name)</Label>
									<Input id='homeTeam' value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder='e.g., Indianapolis Colts' required />
								</div>
								<div className='space-y-2'>
									<Label htmlFor='awayTeam'>Away team (full name)</Label>
									<Input id='awayTeam' value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder='e.g., Atlanta Falcons' required />
								</div>
							</div>

							<div className='grid grid-cols-2 gap-4'>
								<div className='space-y-2'>
									<Label htmlFor='homeOdds'>Home odds</Label>
									<Input id='homeOdds' value={homeOdds} onChange={e => setHomeOdds(e.target.value)} placeholder='-350 (favorite)' required className='font-mono' />
									<p className='text-xs text-muted-foreground'>Negative for favorites (e.g., -350 = 1 pt)</p>
								</div>
								<div className='space-y-2'>
									<Label htmlFor='awayOdds'>Away odds</Label>
									<Input id='awayOdds' value={awayOdds} onChange={e => setAwayOdds(e.target.value)} placeholder='350 (underdog)' required className='font-mono' />
									<p className='text-xs text-muted-foreground'>Positive for underdogs (e.g., +350 = 7 pts)</p>
								</div>
							</div>

							<Button type='submit' disabled={loading} size='lg' className='w-full'>
								{loading ? <RefreshCw className='animate-spin' /> : <Crosshair />}
								{loading ? 'Updating…' : 'Fix Odds for This Game'}
							</Button>
						</form>

						{result && (
							<Alert variant={result.success ? 'success' : 'destructive'} className='mt-6 animate-fade-in'>
								{result.success ? <CheckCircle2 /> : <XCircle />}
								<AlertTitle>{result.success ? 'Odds updated' : result.error || 'Some steps failed'}</AlertTitle>
								<AlertDescription className='space-y-2'>
									{result.details && <p>{result.details}</p>}
									{steps.map(step => (
										<div key={step.label} className='flex items-start justify-between gap-3 text-foreground'>
											<span className='text-muted-foreground'>{step.label}</span>
											<span className={step.data?.success ? 'text-accent' : 'text-destructive'}>{step.data?.message || step.data?.error || '—'}</span>
										</div>
									))}
									<details className='pt-1 text-foreground'>
										<summary className='cursor-pointer text-xs text-muted-foreground'>Raw response</summary>
										<pre className='mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 font-mono text-xs'>{JSON.stringify(result, null, 2)}</pre>
									</details>
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className='text-xl'>How to find the game ID</CardTitle>
					</CardHeader>
					<CardContent className='space-y-5 text-sm'>
						<div>
							<h3 className='mb-1.5 font-semibold'>Method 1: From the ESPN URL</h3>
							<p className='text-muted-foreground'>Go to ESPN.com, find the game, and look at the URL:</p>
							<code className='mt-2 inline-block break-all rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 font-mono text-xs'>
								espn.com/nfl/game/_/gameId/<strong className='text-primary'>401671760</strong>/...
							</code>
						</div>

						<div>
							<h3 className='mb-1.5 font-semibold'>Method 2: From network requests</h3>
							<ol className='list-inside list-decimal space-y-1 text-muted-foreground'>
								<li>Go to the league page and open browser DevTools (F12)</li>
								<li>Go to the Network tab</li>
								<li>Look for requests to the ESPN API</li>
								<li>Find the game ID in the response</li>
							</ol>
						</div>

						<div>
							<h3 className='mb-1.5 font-semibold'>Point values reference</h3>
							<ul className='space-y-1 text-muted-foreground tabular'>
								{POINT_VALUES.map(v => (
									<li key={v}>{v}</li>
								))}
							</ul>
						</div>
					</CardContent>
				</Card>
			</div>
		</PageContainer>
	);
}
