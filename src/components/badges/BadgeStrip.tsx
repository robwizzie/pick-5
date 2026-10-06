import type { Badge } from '@/lib/badges';
import { BADGE_ORDER } from '@/lib/badges';
import { BadgeIcon } from './badgeStyles';

/** Up to `max` earned badges as tiny icons (for leaderboard rows). Renders nothing if none. */
export function BadgeStrip({ badges, max = 3 }: { badges?: Badge[]; max?: number }) {
	const earned = (badges ?? []).filter(b => b.earned).sort((a, b) => BADGE_ORDER.indexOf(a.id) - BADGE_ORDER.indexOf(b.id));
	if (earned.length === 0) return null;
	const shown = earned.slice(0, max);
	const label = earned.map(b => b.name).join(', ');
	return (
		<span className='inline-flex shrink-0 items-center -space-x-1' role='img' aria-label={`Badges: ${label}`} title={label}>
			{shown.map(b => (
				<span key={b.id} title={b.name} className='rounded-full ring-2 ring-[hsl(var(--surface))]'>
					<BadgeIcon badge={b} size='xs' />
				</span>
			))}
			{earned.length > max && <span className='pl-1.5 text-[10px] font-semibold text-muted-foreground tabular'>+{earned.length - max}</span>}
		</span>
	);
}
