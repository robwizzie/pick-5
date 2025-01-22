// src/components/games/Nav.tsx
import { Button } from '@/components/ui/button';

interface NavProps {
	currentWeek: number;
	onWeekChange: (week: number) => void;
	userName?: string;
}

export function Nav({ currentWeek, onWeekChange, userName }: NavProps) {
	return (
		<div className='bg-white shadow'>
			<div className='max-w-7xl mx-auto px-4'>
				<div className='flex justify-between items-center h-16'>
					<div className='flex items-center space-x-4'>
						<Button variant='outline' onClick={() => onWeekChange(Math.max(10, currentWeek - 1))} disabled={currentWeek <= 10}>
							Previous Week
						</Button>
						<span className='font-medium'>Week {currentWeek}</span>
						<Button variant='outline' onClick={() => onWeekChange(Math.min(17, currentWeek + 1))} disabled={currentWeek >= 17}>
							Next Week
						</Button>
					</div>

					<div className='flex items-center space-x-4'>{userName ? <span className='text-sm'>{userName}</span> : <Button variant='outline'>Sign In</Button>}</div>
				</div>
			</div>
		</div>
	);
}
