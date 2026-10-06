'use client';

import { Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calculatePointsFromOdds, formatOdds, getOddsRiskLabel } from '@/utils/oddsUtils';
import { cn } from '@/lib/utils';
import { LOCK_MULTIPLIER, ScoringService } from '@/services/scoringService';

// Sample lines for the scoring table; points always come from the real scoring function
const SAMPLE_ODDS = [-300, -175, -110, 100, 150, 200, 300, 400, 500, 700, 1000, 1400];

// Example underdog for the lock explainer (Standard mode)
const LOCK_EXAMPLE_ODDS = 200;
const STEVE_WIN = ScoringService.pointsForPick({}, 'steve');
const STEVE_LOCK_WIN = ScoringService.pointsForPick({}, 'steve', undefined, true);

const TFS_TABLE = [
	{ diff: 'Exact', pts: 5 },
	{ diff: 'Within 3', pts: 4 },
	{ diff: 'Within 5', pts: 3 },
	{ diff: 'Within 7', pts: 2 },
	{ diff: 'Within 10', pts: 1 },
	{ diff: '11+ off', pts: 0 }
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className='space-y-3'>
			<h3 className='eyebrow'>{title}</h3>
			{children}
		</section>
	);
}

function LockSection({ isSteve }: { isSteve: boolean }) {
	const base = isSteve ? STEVE_WIN : calculatePointsFromOdds(LOCK_EXAMPLE_ODDS);
	const locked = isSteve ? STEVE_LOCK_WIN : ScoringService.pointsForPick({ odds: LOCK_EXAMPLE_ODDS }, 'standard', calculatePointsFromOdds, true);
	return (
		<Section title='Lock of the week'>
			<div className='rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5'>
				<div className='flex items-start gap-3'>
					<span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning'>
						<Lock className='h-4 w-4' strokeWidth={2.5} />
					</span>
					<p className='text-sm text-foreground/90'>
						Mark one of your five picks as your <span className='font-semibold text-warning'>Lock</span>. If it wins it scores{' '}
						<span className='font-semibold text-foreground'>{LOCK_MULTIPLIER}× points</span>; if it loses it scores 0, like any miss. It’s optional, and you can move it until your first game kicks off.
					</p>
				</div>
				<div className='mt-3 grid grid-cols-2 gap-2 text-center'>
					<div className='rounded-lg bg-white/[0.04] p-2.5'>
						<p className='font-display text-2xl font-extrabold italic tabular'>{base}</p>
						<p className='eyebrow mt-0.5'>{isSteve ? 'Normal win' : `+${LOCK_EXAMPLE_ODDS} win`}</p>
					</div>
					<div className='rounded-lg bg-warning/10 p-2.5 ring-1 ring-warning/30'>
						<p className='font-display text-2xl font-extrabold italic tabular text-warning'>{locked}</p>
						<p className='eyebrow mt-0.5'>As your lock</p>
					</div>
				</div>
			</div>
			<p className='text-sm text-muted-foreground'>Other members see your lock once that game kicks off.</p>
		</Section>
	);
}

function Steps({ items }: { items: string[] }) {
	return (
		<ol className='space-y-2'>
			{items.map((item, i) => (
				<li key={i} className='flex gap-3 text-sm'>
					<span className='grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-sm font-bold italic text-primary'>{i + 1}</span>
					<span className='pt-0.5 text-foreground/90'>{item}</span>
				</li>
			))}
		</ol>
	);
}

function Table({ rows, head }: { head: [string, string, string?]; rows: Array<[React.ReactNode, React.ReactNode, React.ReactNode?]> }) {
	return (
		<div className='overflow-hidden rounded-xl border border-white/[0.07]'>
			<table className='w-full text-sm'>
				<thead className='bg-white/[0.04] text-left'>
					<tr>
						{head.filter(Boolean).map((h, i) => (
							<th key={h} className={cn('px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', i === head.filter(Boolean).length - 1 && 'text-right')}>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody className='divide-y divide-white/[0.05]'>
					{rows.map((cells, r) => (
						<tr key={r}>
							{cells.filter(c => c !== undefined).map((c, i, arr) => (
								<td key={i} className={cn('px-3 py-2', i === arr.length - 1 && 'text-right font-display text-lg font-bold italic tabular text-primary')}>
									{c}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function LeagueRulesDialog({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (open: boolean) => void; mode?: string }) {
	const isSteve = mode === 'steve';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-xl sm:max-h-[85vh] sm:overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>How scoring works</DialogTitle>
					<DialogDescription>{isSteve ? 'Steve Mode — 2 points per win plus a Total Final Score bonus.' : 'Standard Mode — points scale with the moneyline. Underdogs pay more.'}</DialogDescription>
				</DialogHeader>

				<div className='space-y-6'>
					<Section title='How to play'>
						<Steps
							items={
								isSteve
									? [
											'Pick the winners of any 5 games this week.',
											'For one of those games, predict the Total Final Score (both teams combined).',
											'Optionally make one pick your Lock of the Week for double points.',
											'Edit your picks any time before each game kicks off.'
										]
									: [
											'Pick the winners of any 5 games this week.',
											'Each pick is worth points based on its moneyline odds, locked in when you pick.',
											'Optionally make one pick your Lock of the Week for double points.',
											'Edit your picks any time before each game kicks off.'
										]
							}
						/>
					</Section>

					{isSteve ? (
						<>
							<Section title='Picks'>
								<div className='grid grid-cols-3 gap-2 text-center'>
									{[
										{ label: 'Correct', value: String(STEVE_WIN) },
										{ label: 'Wrong', value: '0' },
										{ label: 'Lock win', value: String(STEVE_LOCK_WIN) }
									].map(s => (
										<div key={s.label} className='rounded-xl border border-white/[0.07] bg-white/[0.03] p-3'>
											<p className='font-display text-3xl font-extrabold italic tabular'>{s.value}</p>
											<p className='eyebrow mt-1'>{s.label}</p>
										</div>
									))}
								</div>
							</Section>
							<Section title='Total Final Score bonus'>
								<Table head={['How close', 'Points']} rows={TFS_TABLE.map(r => [r.diff, r.pts])} />
								<p className='text-sm text-muted-foreground'>
									Best possible week: <span className='font-semibold text-foreground'>{4 * STEVE_WIN + STEVE_LOCK_WIN + 5} points</span> ({4 * STEVE_WIN + STEVE_LOCK_WIN} from picks with a winning lock + 5 TFS).
								</p>
							</Section>
						</>
					) : (
						<Section title='Points by odds'>
							<Table
								head={['Line', 'Type', 'Points']}
								rows={SAMPLE_ODDS.map(odds => [<span key='o' className='font-mono font-bold'>{formatOdds(odds)}</span>, <span key='l' className='text-muted-foreground'>{getOddsRiskLabel(odds)}</span>, calculatePointsFromOdds(odds)])}
							/>
							<p className='text-sm text-muted-foreground'>Every correct pick earns at least 1 point, up to 30 for extreme long shots. Wrong picks earn 0. One +300 upset is worth six heavy favorites.</p>
						</Section>
					)}

					<LockSection isSteve={isSteve} />

					<Section title='Good to know'>
						<ul className='space-y-1.5 text-sm text-muted-foreground'>
							<li>• Ties count as a loss for both sides.</li>
							<li>• Scores update live; a pick is graded when its game goes final.</li>
							<li>• Other members’ picks are revealed once each game kicks off.</li>
							<li>• Season standings are total points across all 18 weeks.</li>
						</ul>
					</Section>
				</div>
			</DialogContent>
		</Dialog>
	);
}
