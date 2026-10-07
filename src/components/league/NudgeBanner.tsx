'use client';

import { ArrowRight, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNudges } from '@/contexts/NudgeContext';
import { useWeek } from '@/contexts/WeekContext';

/** "Sam nudged you" — shown on the league page while the viewer's picks for this week are missing. */
export function NudgeBanner({ onMakePicks, survivor = false }: { onMakePicks: () => void; survivor?: boolean }) {
	const { status } = useNudges();
	const { currentWeek, setCurrentWeek, isPastSeason, setSeason, currentSeason } = useWeek();
	if (!status?.mine || !status.open) return null;
	const from = status.mine.fromName.split(' ')[0];

	return (
		<div className='mb-4 flex animate-slide-up flex-wrap items-center gap-3 rounded-2xl border border-warning/35 bg-gradient-to-r from-warning/[0.14] to-warning/[0.04] px-4 py-3 shadow-[0_12px_40px_-20px_hsl(var(--warning)/0.7)]'>
			<span className='grid h-10 w-10 shrink-0 animate-pulse place-items-center rounded-xl bg-warning/20 text-warning'>
				<BellRing className='h-5 w-5' />
			</span>
			<div className='min-w-0 flex-1'>
				<p className='text-sm font-semibold'>👉 {from} nudged you</p>
				<p className='text-xs text-muted-foreground'>
					Your Week {status.week} {survivor ? 'survivor pick isn’t' : 'picks aren’t'} in yet. Games lock at kickoff.
				</p>
			</div>
			<Button
				size='sm'
				onClick={() => {
					if (isPastSeason) setSeason(currentSeason);
					if (currentWeek !== status.week) setCurrentWeek(status.week);
					onMakePicks();
				}}
			>
				{survivor ? 'Make my pick' : 'Make my picks'} <ArrowRight />
			</Button>
		</div>
	);
}
