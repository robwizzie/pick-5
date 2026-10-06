'use client';

import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface WeekSelectorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentWeek: number;
	liveWeek?: number | null;
	onWeekSelect: (week: number) => void;
	weeksWithPicks: number[];
}

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export function WeekSelectorModal({ open, onOpenChange, currentWeek, liveWeek, onWeekSelect, weeksWithPicks }: WeekSelectorModalProps) {
	const picked = new Set(weeksWithPicks);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>Jump to week</DialogTitle>
					<DialogDescription>
						<span className='inline-flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-accent' /> picks in
						</span>
						<span className='mx-2 text-white/20'>·</span>
						<span className='inline-flex items-center gap-1.5'>
							<span className='live-dot' /> this week
						</span>
					</DialogDescription>
				</DialogHeader>

				<div className='grid grid-cols-4 gap-2 sm:grid-cols-6'>
					{WEEKS.map(week => {
						const selected = week === currentWeek;
						const isLive = week === liveWeek;
						const isPast = liveWeek != null && week < liveWeek;
						return (
							<button
								key={week}
								type='button'
								onClick={() => {
									onWeekSelect(week);
									onOpenChange(false);
								}}
								className={cn(
									'relative flex aspect-square flex-col items-center justify-center rounded-xl border transition-all duration-200 active:scale-95',
									selected
										? 'border-primary bg-primary text-primary-foreground shadow-primary-glow'
										: 'border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]',
									!selected && isPast && 'text-muted-foreground'
								)}
							>
								<span className={cn('text-[9px] font-semibold uppercase tracking-widest', selected ? 'text-primary-foreground/70' : 'text-muted-foreground')}>Wk</span>
								<span className='font-display text-2xl font-extrabold italic leading-none tabular'>{week}</span>
								{picked.has(week) && (
									<span className={cn('absolute right-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full', selected ? 'bg-primary-foreground/20' : 'bg-accent text-accent-foreground')}>
										<Check className='h-2.5 w-2.5' strokeWidth={3} />
									</span>
								)}
								{isLive && <span className='live-dot absolute left-2 top-2' />}
							</button>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}
