'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Info, RefreshCw, Wrench, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer, PageHeader, StatTile } from '@/components/ui/page';

interface FixPickOddsResult {
	success: boolean;
	totalPicksProcessed: number;
	picksUpdated: number;
	picksSkipped: number;
	usersUpdated: number;
	details?: string[];
}

export default function FixPickOddsPage() {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<FixPickOddsResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const fixPickOdds = async () => {
		try {
			setLoading(true);
			setError(null);
			setResult(null);

			const response = await fetch('/api/admin/fix-pick-odds', {
				method: 'POST'
			});

			const data: FixPickOddsResult & { error?: string } = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to fix pick odds');
			}

			setResult(data);
			toast.success(`Fixed ${data.picksUpdated} picks`);
		} catch (err) {
			console.error('Error fixing pick odds:', err);
			const message = err instanceof Error ? err.message : 'An error occurred';
			setError(message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<PageContainer size='narrow'>
			<PageHeader eyebrow='Admin · Odds' title='Fix Pick Odds' description='Retroactively add odds to existing picks and recalculate points' />

			<div className='space-y-6'>
				<Card>
					<CardHeader>
						<CardTitle className='text-xl'>What this does</CardTitle>
					</CardHeader>
					<CardContent className='space-y-5'>
						<ul className='list-inside list-disc space-y-1.5 text-sm text-muted-foreground'>
							<li>Finds all picks in standard mode leagues that don&apos;t have odds</li>
							<li>Looks up the historical odds from the odds snapshot for that week</li>
							<li>Updates each pick with the correct odds based on which team was selected</li>
							<li>Recalculates points for finished games using the same calculatePointsFromOdds function</li>
							<li>Updates total points for each user</li>
						</ul>

						<Alert variant='warning'>
							<Info />
							<AlertDescription>
								<strong>Note:</strong> This uses the odds from the snapshot. If no snapshot exists for a week, those picks will be skipped.
							</AlertDescription>
						</Alert>

						<Button onClick={fixPickOdds} disabled={loading} size='lg' className='w-full'>
							{loading ? <RefreshCw className='animate-spin' /> : <Wrench />}
							{loading ? 'Processing…' : 'Fix Pick Odds'}
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
							<AlertTitle>Success</AlertTitle>
							<AlertDescription>Pick odds have been updated and points recalculated.</AlertDescription>
						</Alert>

						<div className='grid grid-cols-2 gap-3'>
							<StatTile label='Processed' value={result.totalPicksProcessed} tone='primary' sub='Total picks' />
							<StatTile label='Fixed' value={result.picksUpdated} tone='accent' sub='Picks with missing odds' />
							<StatTile label='Skipped' value={result.picksSkipped} tone='muted' sub='Had odds or no snapshot' />
							<StatTile label='Users' value={result.usersUpdated} tone='primary' sub='Totals updated' />
						</div>

						{result.details && result.details.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className='text-xl'>Details</CardTitle>
									<CardDescription>First {result.details.length} entries</CardDescription>
								</CardHeader>
								<CardContent>
									<div className='max-h-96 space-y-1 overflow-y-auto rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 font-mono text-xs text-muted-foreground'>
										{result.details.map((detail, i) => (
											<div key={i}>{detail}</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</div>
		</PageContainer>
	);
}
