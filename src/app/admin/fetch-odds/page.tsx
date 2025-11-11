'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

export default function FetchOddsPage() {
	const { data: session, status } = useSession();
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);
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

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || 'Failed to fetch odds');
			} else {
				setResult(data.result);
			}
		} catch (err) {
			console.error('Error triggering odds fetch:', err);
			setError('An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	};

	if (status === 'loading') {
		return (
			<div className='container mx-auto p-4'>
				<Card>
					<CardContent className='p-6'>
						<Spinner />
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!session) {
		return (
			<div className='container mx-auto p-4'>
				<Card>
					<CardContent className='p-6'>
						<Alert>
							<AlertDescription>Please sign in to access this page</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='container mx-auto p-4 max-w-2xl'>
			<Card>
				<CardHeader>
					<CardTitle>Manually Fetch Odds</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<Alert>
						<AlertDescription>
							This will fetch current odds from The Odds API and store them in the database. Use this to manually update odds before games start or when there are major line movements.
						</AlertDescription>
					</Alert>

					<div className='space-y-2'>
						<label htmlFor='week-input' className='text-sm font-medium'>
							Week (optional)
						</label>
						<Input
							id='week-input'
							type='number'
							min='1'
							max='18'
							placeholder='Leave empty for current week'
							value={weekInput}
							onChange={e => setWeekInput(e.target.value)}
							disabled={loading}
						/>
						<p className='text-xs text-muted-foreground'>Enter a specific week number (1-18) or leave empty to fetch odds for the current week</p>
					</div>

					<Button onClick={handleFetchOdds} disabled={loading} className='w-full bg-primary text-black hover:bg-primary/90'>
						{loading ? 'Fetching Odds...' : weekInput ? `Fetch Odds for Week ${weekInput}` : 'Fetch Odds for Current Week'}
					</Button>

					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{result && (
						<div className='space-y-4'>
							<Alert>
								<AlertDescription className='text-green-600 font-medium'>✓ Odds fetched successfully!</AlertDescription>
							</Alert>

							<Card className='bg-muted/50'>
								<CardContent className='p-4'>
									<div className='space-y-2 text-sm'>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Week:</span>
											<span className='font-medium'>{result.week}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Season:</span>
											<span className='font-medium'>{result.season}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Games Found:</span>
											<span className='font-medium'>{result.totalGames}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>New Snapshots:</span>
											<span className='font-medium text-green-600'>{result.snapshotsCreated}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Updated Snapshots:</span>
											<span className='font-medium text-blue-600'>{result.snapshotsUpdated}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Skipped (started):</span>
											<span className='font-medium text-orange-600'>{result.snapshotsSkipped}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-muted-foreground'>Timestamp:</span>
											<span className='font-medium text-xs'>{new Date(result.timestamp).toLocaleString()}</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
