'use client';

import { BellRing, Check, Loader2 } from 'lucide-react';
import { useNudges } from '@/contexts/NudgeContext';
import { useWeek } from '@/contexts/WeekContext';
import { cn } from '@/lib/utils';

/**
 * "Nudge" for a league-mate whose picks for this week are missing. Shows "Nudged" once someone
 * has (one nudge per player per week). Renders nothing outside the week being played now.
 */
export function NudgeButton({ userId, name, className }: { userId?: string; name: string; className?: string }) {
	const { status, nudge, sending } = useNudges();
	const { currentWeek, isPastSeason } = useWeek();
	if (!userId || !status || isPastSeason || currentWeek !== status.week || !status.open) return null;

	const already = status.nudged[userId];
	if (already && !status.pickedIn.includes(userId)) {
		return (
			<span
				className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground', className)}
				title={`${already.fromName} nudged them`}
			>
				<Check className='h-3 w-3' /> Nudged
			</span>
		);
	}
	if (!status.canNudge.includes(userId)) return null;

	const busy = sending === userId;
	return (
		<span
			role='button'
			tabIndex={0}
			aria-label={`Nudge ${name} to make their picks`}
			aria-disabled={!!sending}
			// Rows can be buttons themselves: keep the click from opening the row
			onClick={e => {
				e.stopPropagation();
				if (!sending) nudge(userId, name);
			}}
			onKeyDown={e => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				e.stopPropagation();
				if (!sending) nudge(userId, name);
			}}
			className={cn(
				'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning transition-colors hover:bg-warning/20 active:scale-95',
				!!sending && 'pointer-events-none opacity-60',
				className
			)}
		>
			{busy ? <Loader2 className='h-3 w-3 animate-spin' /> : <BellRing className='h-3 w-3' />} Nudge
		</span>
	);
}

/** "Picks in" / "Needs picks" for the viewed week of the current season. */
export function PicksStatus({ hasPicks, week, className }: { hasPicks: boolean; week?: number; className?: string }) {
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
				hasPicks ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning',
				className
			)}
		>
			{hasPicks ? <Check className='h-2.5 w-2.5' strokeWidth={3} /> : <span className='h-1.5 w-1.5 rounded-full bg-warning' aria-hidden />}
			{week ? `Wk ${week} · ` : ''}
			{hasPicks ? 'Picks in' : 'Needs picks'}
		</span>
	);
}
