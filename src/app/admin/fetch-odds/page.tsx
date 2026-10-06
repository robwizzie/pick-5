'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Info, Radio, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer, PageHeader } from '@/components/ui/page';

interface OddsFetchResult {
	success: boolean;
	week?: number;
	season?: number;
	totalGames?: number;
	snapshotsCreated?: number;
	snapshotsUpdated?: number;
	snapshotsSkipped?: number;
	timestamp?: string;
	error?: string;
}

interface TriggerOddsFetchResponse {
	success?: boolean;
	message?: string;
	result?: OddsFetchResult;
	error?: string;
	details?: string;
}

export default function FetchOddsPage() {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<OddsFetchResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [weekInput, setWeekInput] = useState<string>('');

	const handleFetchOdds = async () => {
		setLoading(true);
		setError(null);
		setResult(null);

		try {
			const body = weekInput ? { week: parseInt(weekInput) } : {};
			const response = await fetch('/api/admin/trigger-odds-fetch', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			const data: TriggerOddsFetchResponse = await response.json();

			if (!response.ok) {
				const message = data.error || 'Failed to fetch odds';
				setError(message);
				toast.error(message);
			} else {
				setResult(data.result ?? null);
				toast.success('Odds fetched successfully');
			}
		} catch (err) {
			console.error('Error triggering odds fetch:', err);
			setError('An unexpected error occurred');
			toast.error('An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	};

	const rows: { label: string; value: React.ReactNode; className?: string }[] = result
		? [
				{ label: 'Week', value: result.week },
				{ label: 'Season', value: result.season },
				{ label: 'Games found', value: result.totalGames },
				{ label: 'New snapshots', value: result.snapshotsCreated, className: 'text-accent' },
				{ label: 'Updated snapshots', value: result.snapshotsUpdated, className: 'text-primary' },
				{ label: 'Skipped (started)', value: result.snapshotsSkipped, className: 'text-warning' },
				{ label: 'Timestamp', value: result.timestamp ? new Date(result.timestamp).toLocaleString() : '—', className: 'text-xs' }
			]
		: [];

	return (
		<PageContainer size='narrow'>
			<PageHeader eyebrow='Admin · Odds' title='Fetch Odds' description='Manually trigger an odds fetch from The Odds API and store it in the database' />

			<div className='space-y-6'>
				<Card>
					<CardContent className='space-y-5 p-5 sm:p-6'>
						<Alert variant='info'>
							<Info />
							<AlertDescription>
								This will fetch current odds from The Odds API and store them in the database. Use this to manually update odds before games start or when there are major line movements.
							</AlertDescription>
						</Alert>

						<div className='space-y-2'>
							<Label htmlFor='week-input'>Week (optional)</Label>
							<Input
								id='week-input'
								type='number'
								inputMode='numeric'
								min='1'
								max='18'
								placeholder='Leave empty for current week'
								value={weekInput}
								onChange={e => setWeekInput(e.target.value)}
								disabled={loading}
								className='tabular'
							/>
							<p className='text-xs text-muted-foreground'>Enter a specific week number (1-18) or leave empty to fetch odds for the current week</p>
						</div>

						<Button onClick={handleFetchOdds} disabled={loading} size='lg' className='w-full'>
							{loading ? <RefreshCw className='animate-spin' /> : <Radio />}
							{loading ? 'Fetching odds…' : weekInput ? `Fetch Odds for Week ${weekInput}` : 'Fetch Odds for Current Week'}
						</Button>
					</CardContent>
				</Card>

				{error && (
					<Alert variant='destructive'>
						<XCircle />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{result && (
					<div className='space-y-4 animate-fade-in'>
						<Alert variant='success'>
							<CheckCircle2 />
							<AlertTitle>Odds fetched successfully</AlertTitle>
						</Alert>

						<Card>
							<CardContent className='p-5 sm:p-6'>
								<dl className='divide-y divide-white/[0.06]'>
									{rows.map(row => (
										<div key={row.label} className='flex items-center justify-between gap-4 py-2.5 text-sm'>
											<dt className='text-muted-foreground'>{row.label}</dt>
											<dd className={`tabular font-semibold ${row.className ?? ''}`}>{row.value ?? '—'}</dd>
										</div>
									))}
								</dl>
							</CardContent>
						</Card>
					</div>
				)}
			</div>
		</PageContainer>
	);
}
