'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calculatePointsFromOdds, formatOdds, getOddsRiskLabel } from '@/utils/oddsUtils';
import { cn } from '@/lib/utils';

// Sample lines for the scoring table; points always come from the real scoring function
const SAMPLE_ODDS = [-300, -175, -110, 100, 150, 200, 300, 400, 500, 700, 1000, 1400];

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
									? ['Pick the winners of any 5 games this week.', 'For one of those games, predict the Total Final Score (both teams combined).', 'Edit your picks any time before each game kicks off.']
									: ['Pick the winners of any 5 games this week.', 'Each pick is worth points based on its moneyline odds, locked in when you pick.', 'Edit your picks any time before each game kicks off.']
							}
						/>
					</Section>

					{isSteve ? (
						<>
							<Section title='Picks'>
								<div className='grid grid-cols-3 gap-2 text-center'>
									{[
										{ label: 'Correct', value: '2' },
										{ label: 'Wrong', value: '0' },
										{ label: 'Max', value: '10' }
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
									Best possible week: <span className='font-semibold text-foreground'>15 points</span> (10 from picks + 5 TFS).
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
