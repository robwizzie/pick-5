'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function FixPickOddsPage() {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	const fixPickOdds = async () => {
		try {
			setLoading(true);
			setError(null);
			setResult(null);

			const response = await fetch('/api/admin/fix-pick-odds', {
				method: 'POST'
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to fix pick odds');
			}

			setResult(data);
		} catch (err: any) {
			console.error('Error fixing pick odds:', err);
			setError(err.message || 'An error occurred');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='space-y-6'>
			<div className='flex items-center gap-4'>
				<Link href='/admin'>
					<Button variant='ghost' size='sm'>
						← Back to Admin
					</Button>
				</Link>
			</div>

			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						<span>🔧</span>
						Retroactively Fix Pick Odds
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-6'>
					<div className='space-y-4'>
						<Alert>
							<AlertDescription>
								<strong>What this does:</strong>
								<ul className='list-disc list-inside mt-2 space-y-1'>
									<li>Finds all picks in standard mode leagues that don&apos;t have odds</li>
									<li>Looks up the historical odds from the odds snapshot for that week</li>
									<li>Updates each pick with the correct odds based on which team was selected</li>
									<li>Recalculates points for finished games using the same calculatePointsFromOdds function</li>
									<li>Updates total points for each user</li>
								</ul>
								<p className='mt-3 text-yellow-600'>
									<strong>Note:</strong> This uses the odds from the snapshot. If no snapshot exists for a week, those picks will be skipped.
								</p>
							</AlertDescription>
						</Alert>

						<Button
							onClick={fixPickOdds}
							disabled={loading}
							className='w-full bg-primary text-black hover:bg-primary/90'
						>
							{loading ? 'Processing...' : 'Fix Pick Odds'}
						</Button>
					</div>

					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{result && (
						<div className='space-y-4'>
							<Alert className='bg-green-500/10 border-green-500/20'>
								<AlertDescription>
									<strong className='text-green-600'>Success!</strong>
									<div className='mt-2 space-y-1'>
										<p>✓ Processed {result.totalPicksProcessed} total picks</p>
										<p>✓ Fixed {result.picksUpdated} picks with missing odds</p>
										<p>✓ Skipped {result.picksSkipped} picks (already had odds or no snapshot available)</p>
										<p>✓ Updated {result.usersUpdated} user totals</p>
									</div>
								</AlertDescription>
							</Alert>

							{result.details && result.details.length > 0 && (
								<Card className='glass border-white/10'>
									<CardHeader>
										<CardTitle className='text-lg'>Details</CardTitle>
									</CardHeader>
									<CardContent>
										<div className='space-y-2 text-sm font-mono'>
											{result.details.map((detail: string, i: number) => (
												<div key={i} className='text-muted-foreground'>
													{detail}
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
