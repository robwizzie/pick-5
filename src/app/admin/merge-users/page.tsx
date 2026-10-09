'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Eye, GitMerge, RefreshCw, TriangleAlert, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageContainer, PageHeader, StatTile } from '@/components/ui/page';

interface UserSummary {
	id: string;
	name: string | null;
	email: string;
}

interface MergeResponse {
	dryRun: boolean;
	merged?: boolean;
	from: UserSummary;
	keep: UserSummary;
	counts: Record<string, number>;
	picksBySeason: Record<string, number>;
	conflicts: string[];
	error?: string;
}

const COUNT_LABELS: Record<string, string> = {
	picks: 'Picks',
	survivorPicks: 'Survivor picks',
	leaguesJoined: 'Leagues joined',
	leaguesAlreadyShared: 'Leagues already shared',
	leaguesCreated: 'Leagues created',
	seasonHistories: 'Archived seasons',
	messages: 'Feed messages',
	nudges: 'Nudges',
	pushSubscriptions: 'Push devices',
	gameNotifications: 'Sent notifications',
	notificationMarkers: 'Reminder markers'
};

export default function MergeUsersPage() {
	const [fromUserId, setFromUserId] = useState('');
	const [keepUserId, setKeepUserId] = useState('');
	const [loading, setLoading] = useState<'preview' | 'merge' | null>(null);
	const [result, setResult] = useState<MergeResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const run = async (dryRun: boolean) => {
		try {
			setLoading(dryRun ? 'preview' : 'merge');
			setError(null);
			const response = await fetch('/api/admin/merge-users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fromUserId, keepUserId, dryRun })
			});
			const data: MergeResponse = await response.json();
			if (!response.ok) throw new Error(data.error || 'Merge failed');
			setResult(data);
			if (!dryRun) toast.success(`Merged ${data.from.name ?? data.from.email} into ${data.keep.name ?? data.keep.email}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'An error occurred';
			setError(message);
			toast.error(message);
		} finally {
			setLoading(null);
		}
	};

	// Merging is only offered for the exact pair that was just previewed, without conflicts
	const previewMatches = result?.dryRun && result.from.id === fromUserId.trim() && result.keep.id === keepUserId.trim();
	const canMerge = previewMatches && result.conflicts.length === 0 && loading === null;

	return (
		<PageContainer size='narrow'>
			<PageHeader eyebrow='Admin · Users' title='Merge Accounts' description='Fold a duplicate account into the one a player keeps, without losing any picks or history' />

			<div className='space-y-6'>
				<Card>
					<CardHeader>
						<CardTitle className='text-xl'>Accounts</CardTitle>
						<CardDescription>
							Everything on the duplicate (picks from every season, leagues, archived standings, feed, nudges, push devices) moves to the kept account, then the duplicate is deleted. The kept account&apos;s name, email and
							settings stay as they are.
						</CardDescription>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-2'>
							<Label htmlFor='from'>Duplicate user ID (will be deleted)</Label>
							<Input id='from' value={fromUserId} onChange={e => setFromUserId(e.target.value)} placeholder='e.g. 690c0241f73e83a635667a38' className='font-mono' />
						</div>
						<div className='space-y-2'>
							<Label htmlFor='keep'>User ID to keep</Label>
							<Input id='keep' value={keepUserId} onChange={e => setKeepUserId(e.target.value)} placeholder='e.g. 6ac5918c28a11d3b4c2308dc' className='font-mono' />
						</div>
						<div className='grid grid-cols-2 gap-3'>
							<Button variant='outline' onClick={() => run(true)} disabled={loading !== null || !fromUserId.trim() || !keepUserId.trim()}>
								{loading === 'preview' ? <RefreshCw className='animate-spin' /> : <Eye />}
								Preview
							</Button>
							<Button variant='destructive' onClick={() => run(false)} disabled={!canMerge}>
								{loading === 'merge' ? <RefreshCw className='animate-spin' /> : <GitMerge />}
								Merge
							</Button>
						</div>
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
						{result.merged ? (
							<Alert variant='success'>
								<CheckCircle2 />
								<AlertTitle>Merged</AlertTitle>
								<AlertDescription>
									{result.from.name ?? result.from.email} ({result.from.email}) was merged into {result.keep.name ?? result.keep.email} ({result.keep.email}) and deleted.
								</AlertDescription>
							</Alert>
						) : result.conflicts.length > 0 ? (
							<Alert variant='destructive'>
								<TriangleAlert />
								<AlertTitle>Can&apos;t merge: {result.conflicts.length} conflict(s)</AlertTitle>
								<AlertDescription>
									<ul className='list-inside list-disc'>
										{result.conflicts.map(c => (
											<li key={c}>{c}</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						) : (
							<Alert variant='info'>
								<Eye />
								<AlertTitle>Preview</AlertTitle>
								<AlertDescription>
									Merge {result.from.name ?? '(no name)'} ({result.from.email}) into {result.keep.name ?? '(no name)'} ({result.keep.email}). Nothing has changed yet.
								</AlertDescription>
							</Alert>
						)}

						<div className='grid grid-cols-2 gap-3'>
							{Object.entries(result.counts).map(([key, value]) => (
								<StatTile key={key} label={COUNT_LABELS[key] ?? key} value={value} tone={value > 0 ? 'primary' : 'muted'} />
							))}
						</div>

						{Object.keys(result.picksBySeason).length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className='text-xl'>Picks by season</CardTitle>
								</CardHeader>
								<CardContent className='space-y-1 text-sm'>
									{Object.entries(result.picksBySeason).map(([season, n]) => (
										<div key={season} className='flex justify-between'>
											<span>{season}</span>
											<span className='tabular'>{n} weeks</span>
										</div>
									))}
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</div>
		</PageContainer>
	);
}
