'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Info, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer, PageHeader, SectionHeader, StatTile } from '@/components/ui/page';
import { getCurrentSeasonYear } from '@/lib/seasonYear';
import type { NudgeReport, NudgeReportRow } from '@/lib/nudgeReportTypes';

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
const hours = (h: number | null) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);

function ReportTable({ rows, showOpened = true }: { rows: NudgeReportRow[]; showOpened?: boolean }) {
	return (
		<Card>
			<CardContent className='overflow-x-auto p-0'>
				<table className='w-full text-sm'>
					<thead>
						<tr className='border-b border-white/[0.06] text-left text-xs text-muted-foreground'>
							<th className='px-4 py-3 font-medium'>Group</th>
							<th className='px-4 py-3 text-right font-medium'>Players</th>
							{showOpened && <th className='px-4 py-3 text-right font-medium'>Opened</th>}
							<th className='px-4 py-3 text-right font-medium'>Picked</th>
							<th className='px-4 py-3 text-right font-medium'>Pick rate</th>
							<th className='px-4 py-3 text-right font-medium'>Median time to pick</th>
						</tr>
					</thead>
					<tbody className='divide-y divide-white/[0.06]'>
						{rows.map(r => (
							<tr key={r.label}>
								<td className='px-4 py-2.5 font-semibold'>{r.label}</td>
								<td className='tabular px-4 py-2.5 text-right'>{r.count}</td>
								{showOpened && <td className='tabular px-4 py-2.5 text-right'>{r.opened}</td>}
								<td className='tabular px-4 py-2.5 text-right'>{r.picked}</td>
								<td className='tabular px-4 py-2.5 text-right font-semibold'>{pct(r.pickRate)}</td>
								<td className='tabular px-4 py-2.5 text-right'>{hours(r.medianHoursToPick)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</CardContent>
		</Card>
	);
}

export default function NudgeReportPage() {
	const [season, setSeason] = useState(String(getCurrentSeasonYear()));
	const [report, setReport] = useState<NudgeReport | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (year: string) => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/admin/nudge-report?season=${encodeURIComponent(year)}`, { cache: 'no-store' });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to load the nudge report');
			setReport(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load the nudge report');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load(String(getCurrentSeasonYear()));
	}, [load]);

	const { nudged, notNudged } = report?.comparison ?? {};
	const lift = nudged?.pickRate != null && notNudged?.pickRate != null ? Math.round((nudged.pickRate - notNudged.pickRate) * 100) : null;

	return (
		<PageContainer>
			<PageHeader
				eyebrow='Admin · Picks'
				title='Nudge Report'
				description='Whether nudged players went on to make their picks, by how the nudge reached them'
				actions={
					<form
						className='flex items-end gap-2'
						onSubmit={e => {
							e.preventDefault();
							load(season);
						}}
					>
						<div className='space-y-1'>
							<Label htmlFor='season-input'>Season</Label>
							<Input id='season-input' type='number' inputMode='numeric' value={season} onChange={e => setSeason(e.target.value)} className='tabular w-28' />
						</div>
						<Button type='submit' disabled={loading}>
							<RefreshCw className={loading ? 'animate-spin' : ''} />
							Load
						</Button>
					</form>
				}
			/>

			{error && (
				<Alert variant='destructive' className='mb-6'>
					<XCircle />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{!report && loading && <Skeleton className='h-[320px] rounded-2xl' />}

			{report && (
				<div className='space-y-8'>
					<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
						<StatTile label='Nudges sent' value={report.overall.count} icon={BellRing} />
						<StatTile label='Picked after' value={pct(report.overall.pickRate)} sub={`${report.overall.picked} of ${report.overall.count}`} tone='accent' />
						<StatTile label='Median time to pick' value={hours(report.overall.medianHoursToPick)} tone='warning' />
						<StatTile
							label='vs. not nudged'
							value={lift === null ? '—' : `${lift > 0 ? '+' : ''}${lift} pts`}
							sub={notNudged ? `${pct(notNudged.pickRate)} of ${notNudged.count} not nudged picked` : undefined}
							tone='muted'
						/>
					</div>

					<section>
						<SectionHeader title='By channel' />
						{report.byChannel.length ? <ReportTable rows={report.byChannel} /> : <p className='text-sm text-muted-foreground'>No nudges this season.</p>}
					</section>

					{nudged && notNudged && (
						<section>
							<SectionHeader title='Nudged vs. not nudged' />
							<ReportTable rows={[nudged, notNudged]} showOpened={false} />
						</section>
					)}

					<Alert variant='info'>
						<Info />
						<AlertDescription className='space-y-1'>
							<p>
								“Not nudged” is pick ’em league-mates who weren’t nudged that week and had no picks in when the league’s first nudge went out, timed from that nudge. Survivor
								leagues are left out of the comparison because players who are out never pick.
							</p>
							<p>“Before tracking” nudges have no channel or open data. “Opened” means they opened the league from the nudge’s push, email or banner.</p>
							{report.estimatedPickTimes > 0 && (
								<p>
									{report.estimatedPickTimes} pick time{report.estimatedPickTimes === 1 ? ' comes' : 's come'} from a pick ’em pick’s last edit, from before first-submission
									times were saved, so {report.estimatedPickTimes === 1 ? 'it’s' : 'they’re'} an upper bound.
								</p>
							)}
						</AlertDescription>
					</Alert>
				</div>
			)}
		</PageContainer>
	);
}
