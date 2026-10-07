import type { UserBadge } from '@/lib/badges';
import { cn } from '@/lib/utils';
import { BADGE_TONES, BadgeIcon } from './badgeStyles';

const TIER_LABEL: Record<UserBadge['tier'], string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

/** Stats-page badge card: vivid with a glow when earned, dimmed with a progress bar when locked. */
export function BadgeCard({ badge, index = 0, showLeague }: { badge: UserBadge; index?: number; showLeague?: boolean }) {
	const tone = BADGE_TONES[badge.tone];
	const { current, target } = badge.progress;
	const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
	const otherLeagues = badge.leagues.filter(l => l.earned && l.leagueId !== badge.leagueId).length;

	return (
		<div
			className={cn('glass relative animate-slide-up overflow-hidden rounded-2xl p-4', badge.earned ? tone.card : 'opacity-80')}
			style={{ animationDelay: `${index * 40}ms` }}
		>
			{badge.earned && <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent to-60%', tone.wash)} />}
			<div className='relative flex items-start justify-between gap-2'>
				<BadgeIcon badge={badge} size='lg' className={cn(!badge.earned && 'grayscale')} />
				<div className='text-right'>
					<p className={cn('eyebrow text-[9px]', badge.earned && tone.text)}>{TIER_LABEL[badge.tier]}</p>
					{badge.earned && badge.count > 1 && <p className={cn('font-display text-lg font-extrabold italic leading-none tabular', tone.text)}>{badge.count}×</p>}
				</div>
			</div>
			<p className={cn('relative mt-3 font-display text-lg font-bold uppercase italic leading-none tracking-tight', !badge.earned && 'text-foreground/70')}>{badge.name}</p>
			<p className='relative mt-1 text-xs leading-snug text-muted-foreground'>{badge.description}</p>

			<div className='relative mt-3'>
				{badge.earned ? (
					<p className='truncate text-[11px] font-semibold text-foreground/80'>
						{badge.earnedWeek ? `Week ${badge.earnedWeek}` : 'Earned'}
						{showLeague && badge.leagueName && (
							<span className='font-medium text-muted-foreground'>
								{' '}
								· {badge.leagueName}
								{otherLeagues > 0 && ` +${otherLeagues}`}
							</span>
						)}
					</p>
				) : (
					<>
						<div className='flex items-center justify-between text-[11px] text-muted-foreground'>
							<span>Progress</span>
							<span className='font-semibold tabular'>
								{current}/{target}
							</span>
						</div>
						<div
							className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]'
							role='progressbar'
							aria-valuemin={0}
							aria-valuemax={target}
							aria-valuenow={current}
							aria-label={`${badge.name} progress`}
						>
							<div className={cn('h-full rounded-full opacity-70', tone.bar)} style={{ width: `${pct}%` }} />
						</div>
					</>
				)}
			</div>
		</div>
	);
}
