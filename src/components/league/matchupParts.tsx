import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pill } from '@/components/ui/page';
import type { Matchup, MatchupSide } from '@/lib/matchups';
import { cn } from '@/lib/utils';
import { Scale } from 'lucide-react';

export const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

/** "Steve Martinez" -> "Steve M." */
export const shortName = (name: string) => {
	const [first, ...rest] = name.trim().split(/\s+/);
	const last = rest.at(-1);
	return last ? `${first} ${last[0]}.` : first;
};

/** Points can be fractional for the league median. */
export const fmtPoints = (points: number) => (Number.isInteger(points) ? String(points) : points.toFixed(1));

export function SideAvatar({ side, className }: { side: MatchupSide; className?: string }) {
	if (side.kind === 'median') {
		return (
			<span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-muted-foreground ring-1 ring-white/10', className)} title='League median'>
				<Scale className='h-1/2 w-1/2' aria-hidden />
			</span>
		);
	}
	return (
		<Avatar className={cn('h-8 w-8 ring-1 ring-white/10', className)}>
			<AvatarImage src={side.image || undefined} alt={side.name} />
			<AvatarFallback className='bg-primary/15 text-[10px] font-bold text-primary'>{initials(side.name)}</AvatarFallback>
		</Avatar>
	);
}

export type MatchupOutcome = 'W' | 'L' | 'T' | null;

/** Outcome for `userId` once final. */
export function outcomeFor(m: Matchup, userId: string): MatchupOutcome {
	if (m.status !== 'final' || m.noContest) return null;
	if (m.isTie) return 'T';
	return m.winnerId === userId ? 'W' : 'L';
}

export function StatusPill({ matchup }: { matchup: Matchup }) {
	if (matchup.status === 'live')
		return (
			<Pill tone='live' className='px-2 py-0 text-[9px]'>
				<span className='live-dot h-1.5 w-1.5' /> Live
			</Pill>
		);
	if (matchup.status === 'final') return <Pill className='px-2 py-0 text-[9px]'>{matchup.noContest ? 'No contest' : 'Final'}</Pill>;
	return <Pill className='px-2 py-0 text-[9px]'>Upcoming</Pill>;
}
