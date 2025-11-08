'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface WeekSelectorModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentWeek: number;
	onWeekSelect: (week: number) => void;
	weeksWithPicks: number[];
}

export function WeekSelectorModal({ open, onOpenChange, currentWeek, onWeekSelect, weeksWithPicks }: WeekSelectorModalProps) {
	const weeks = Array.from({ length: 18 }, (_, i) => i + 1);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[500px] glass border-white/10 backdrop-blur-xl'>
				<DialogHeader>
					<DialogTitle className='text-xl font-oswald uppercase tracking-wide text-primary'>Select Week</DialogTitle>
				</DialogHeader>
				<div className='grid grid-cols-3 gap-3 py-4'>
					{weeks.map(week => {
						const hasPicks = weeksWithPicks.includes(week);
						const isCurrentWeek = week === currentWeek;

						return (
							<Button
								key={week}
								variant='outline'
								onClick={() => {
									onWeekSelect(week);
									onOpenChange(false);
								}}
								className={`relative h-16 flex flex-col items-center justify-center gap-1 transition-all ${
									isCurrentWeek
										? 'bg-primary/20 border-primary text-primary font-bold'
										: hasPicks
										? 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20 hover:border-green-500'
										: 'border-primary/20 hover:bg-primary/10 hover:border-primary/40'
								}`}>
								<span className={`font-oswald text-lg ${isCurrentWeek ? 'text-primary' : ''}`}>Week {week}</span>
								{hasPicks && (
									<div className='flex items-center gap-1 text-xs text-green-400'>
										<Check className='w-3 h-3' />
										<span>Picks In</span>
									</div>
								)}
							</Button>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}
