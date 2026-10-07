import { Swords } from 'lucide-react';
import type { H2HRecord, Matchup } from '@/lib/matchups';
import { formatRecord } from '@/lib/matchups';
import { cn } from '@/lib/utils';
import { SideAvatar, fmtPoints, outcomeFor, shortName } from './matchupParts';

export interface MatchupMiniData {
	matchup: Matchup | null;
	record?: H2HRecord;
}

const OUTCOME_STYLES = {
	W: 'bg-accent/15 text-accent ring-accent/30',
	L: 'bg-accent-2/15 text-accent-2 ring-accent-2/30',
	T: 'bg-white/[0.06] text-muted-foreground ring-white/10'
} as const;

/** Dashboard league-card row: "You 12 – 9 Steve M." with live/final state and the viewer's H2H record. */
export function MatchupMini({ data, userId }: { data: MatchupMiniData; userId: string }) {
	const { matchup, record } = data;
	if (!matchup) return null;
	const mine = matchup.sides.findIndex(s => s.userId === userId);
	if (mine < 0) return null;
	const me = matchup.sides[mine];
	const opp = matchup.sides[1 - mine];
	const outcome = outcomeFor(matchup, userId);
	const started = matchup.status !== 'upcoming';
	const meAhead = started && me.points > opp.points;
	const oppAhead = started && opp.points > me.points;
	const scoreTone = (ahead: boolean, isMe: boolean) =>
		outcome ? (outcome === 'T' ? 'text-foreground' : (outcome === 'W') === isMe ? 'text-accent' : 'text-muted-foreground') : ahead ? 'text-foreground' : 'text-muted-foreground';

	return (
		<div className='mt-3 flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2' aria-label={`This week's matchup: you ${fmtPoints(me.points)}, ${opp.name} ${fmtPoints(opp.points)}`}>
			<div className='flex w-10 shrink-0 flex-col items-start gap-0.5'>
				<span className='eyebrow flex items-center gap-1 text-[9px] tracking-[0.12em]'>
					<Swords className='h-3 w-3' aria-hidden /> H2H
				</span>
				{matchup.status === 'live' ? (
					<span className='flex items-center gap-1 text-[10px] font-bold uppercase text-live'>
						<span className='live-dot h-1.5 w-1.5' /> Live
					</span>
				) : outcome ? (
					<span className={cn('rounded px-1 text-[10px] font-extrabold ring-1', OUTCOME_STYLES[outcome])}>{outcome}</span>
				) : (
					<span className='text-[10px] font-semibold text-muted-foreground'>{matchup.status === 'final' ? '—' : 'Soon'}</span>
				)}
			</div>

			<div className='flex min-w-0 flex-1 items-center justify-center gap-2'>
				<SideAvatar side={me} className='h-7 w-7 ring-primary/40' />
				<span className='hidden text-xs font-semibold text-primary min-[400px]:inline'>You</span>
				<span className='flex shrink-0 items-baseline gap-1.5 font-display text-2xl font-extrabold italic leading-none tabular'>
					<span className={scoreTone(meAhead, true)}>{fmtPoints(me.points)}</span>
					<span className='text-base text-muted-foreground/50'>–</span>
					<span className={scoreTone(oppAhead, false)}>{fmtPoints(opp.points)}</span>
				</span>
				<span className='min-w-0 truncate text-xs font-semibold text-foreground/80'>{opp.kind === 'median' ? 'Median' : shortName(opp.name)}</span>
				<SideAvatar side={opp} className='h-7 w-7' />
			</div>

			<div className='shrink-0 text-right'>
				<p className='font-display text-base font-extrabold italic leading-none tabular'>{formatRecord(record)}</p>
				<p className='eyebrow mt-0.5 text-[8px] tracking-[0.12em]'>Record</p>
			</div>
		</div>
	);
}
