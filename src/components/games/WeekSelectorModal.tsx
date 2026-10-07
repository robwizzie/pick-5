'use client';

import Link from 'next/link';
import { Check, History } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface WeekSelectorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentWeek: number;
	liveWeek?: number | null;
	onWeekSelect: (week: number) => void;
	weeksWithPicks: number[];
	/** Weeks in the viewed season */
	finalWeek: number;
	/** Seasons to choose from, newest first (the row is hidden when there's only one) */
	seasons?: number[];
	season?: number;
	currentSeason?: number;
	onSeasonSelect?: (season: number) => void;
	/** Link to the league's archived season history */
	historyHref?: string;
}

const seasonLabel = (year: number) => `${year}–${String(year + 1).slice(-2)}`;

export function WeekSelectorModal({ open, onOpenChange, currentWeek, liveWeek, onWeekSelect, weeksWithPicks, finalWeek, seasons = [], season, currentSeason, onSeasonSelect, historyHref }: WeekSelectorModalProps) {
	const picked = new Set(weeksWithPicks);
	const weeks = Array.from({ length: finalWeek }, (_, i) => i + 1);
	const isPastSeason = season !== undefined && season !== currentSeason;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>{isPastSeason ? `${seasonLabel(season!)} season` : 'Jump to week'}</DialogTitle>
					<DialogDescription>
						<span className='inline-flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-accent' /> picks in
						</span>
						{!isPastSeason && (
							<>
								<span className='mx-2 text-white/20'>·</span>
								<span className='inline-flex items-center gap-1.5'>
									<span className='live-dot' /> this week
								</span>
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				{seasons.length > 1 && onSeasonSelect && (
					<div>
						<p className='eyebrow mb-2'>Season</p>
						<div className='-mx-1 flex gap-2 overflow-x-auto px-1 pb-1'>
							{seasons.map(year => {
								const selected = year === season;
								return (
									<button
										key={year}
										type='button'
										onClick={() => onSeasonSelect(year)}
										aria-pressed={selected}
										className={cn(
											'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular transition-colors',
											selected ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground'
										)}
									>
										{seasonLabel(year)}
										{year === currentSeason && <span className={cn('ml-1.5 text-[10px] uppercase tracking-wider', selected ? 'text-primary-foreground/70' : 'text-primary')}>Now</span>}
									</button>
								);
							})}
						</div>
					</div>
				)}

				<div className='grid grid-cols-4 gap-2 sm:grid-cols-6'>
					{weeks.map(week => {
						const selected = week === currentWeek;
						const isLive = !isPastSeason && week === liveWeek;
						const isPast = isPastSeason || (liveWeek != null && week < liveWeek);
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

				{historyHref && (
					<Link href={historyHref} onClick={() => onOpenChange(false)} className='flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground'>
						<History className='h-4 w-4' /> Champions &amp; final standings
					</Link>
				)}
			</DialogContent>
		</Dialog>
	);
}
