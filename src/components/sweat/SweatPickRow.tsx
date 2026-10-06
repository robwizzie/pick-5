'use client';

import type { CSSProperties } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { TeamLogo } from '@/components/ui/team-logo';
import { cn } from '@/lib/utils';
import type { SweatMyPick, SweatPickState } from './sweatModel';

export const PICK_STATE_META: Record<SweatPickState, { label: string; text: string; bar: string; ring: string }> = {
	winning: { label: 'Winning', text: 'text-accent', bar: 'bg-accent', ring: 'ring-accent/70' },
	losing: { label: 'Losing', text: 'text-accent-2', bar: 'bg-accent-2', ring: 'ring-accent-2/70' },
	tied: { label: 'Tied', text: 'text-warning', bar: 'bg-warning', ring: 'ring-warning/70' },
	won: { label: 'Final', text: 'text-accent', bar: 'bg-accent', ring: 'ring-accent/70' },
	lost: { label: 'Final', text: 'text-accent-2', bar: 'bg-accent-2/60', ring: 'ring-accent-2/50' },
	upcoming: { label: 'Upcoming', text: 'text-muted-foreground', bar: 'bg-white/15', ring: 'ring-white/10' }
};

const POINTS_CAPTION: Record<SweatPickState, string> = {
	won: 'banked',
	winning: 'live',
	tied: 'on the line',
	losing: 'at risk',
	lost: 'lost',
	upcoming: 'in play'
};

export function formatKickoff(iso: string) {
	const d = new Date(iso);
	const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
	const day = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
	return `${day} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function StateLabel({ state }: { state: SweatPickState }) {
	const meta = PICK_STATE_META[state];
	const live = state === 'winning' || state === 'losing' || state === 'tied';
	return (
		<span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em]', meta.text)}>
			{live && <span className={cn('h-1.5 w-1.5 rounded-full', meta.bar, state !== 'tied' && 'animate-pulse')} />}
			{meta.label}
			{state === 'won' && <Check className='h-3 w-3' strokeWidth={3} />}
			{state === 'lost' && <X className='h-3 w-3' strokeWidth={3} />}
		</span>
	);
}

/** One of the viewer's picks, broadcast lower-third style. `flash` pulses it (just flipped to winning). */
export function SweatPickRow({ pick, flash, className, style }: { pick: SweatMyPick; flash?: boolean; className?: string; style?: CSSProperties }) {
	const { state, game, team, opponent } = pick;
	const meta = PICK_STATE_META[state];
	const started = game.phase !== 'pre';
	const points = state === 'won' ? pick.earned : pick.value;

	return (
		<div
			style={style}
			className={cn(
				'relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] py-3 pl-4 pr-3 transition-[box-shadow,background-color,border-color] duration-700 ease-out-expo',
				state === 'lost' && 'bg-white/[0.015]',
				pick.isLock && 'border-warning/25',
				flash && 'border-accent/60 bg-accent/[0.10] shadow-[0_0_0_1px_hsl(var(--accent)/0.35),0_12px_40px_-12px_hsl(var(--accent)/0.6)]',
				className
			)}
		>
			<span className={cn('absolute inset-y-0 left-0 w-1', meta.bar)} aria-hidden />

			<TeamLogo src={team.logo} alt={team.team} size={44} className={cn(state === 'lost' && 'opacity-60')} />

			<div className='min-w-0 flex-1'>
				<StateLabel state={state} />
				<div className='mt-0.5 flex items-center gap-1.5'>
					<span className={cn('font-display text-xl font-bold uppercase italic leading-none tracking-tight', state === 'lost' && 'text-muted-foreground')}>
						<span className='sm:hidden'>{team.abbreviation}</span>
						<span className='hidden sm:inline'>{team.team}</span>
					</span>
					{pick.isLock && (
						<span className='inline-flex shrink-0 items-center gap-0.5 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-warning ring-1 ring-warning/30' title='Lock of the week — double points'>
							<Lock className='h-2.5 w-2.5' strokeWidth={3} /> 2×
						</span>
					)}
				</div>
				<div className='mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
					<span>{pick.isHome ? 'vs' : '@'}</span>
					<TeamLogo src={opponent.logo} alt={opponent.team} size={16} className='ring-0' />
					<span className='truncate font-semibold'>{opponent.abbreviation}</span>
				</div>
			</div>

			<div className='shrink-0 text-right'>
				{started ? (
					<div className='font-display text-[1.75rem] font-extrabold italic leading-none tabular tracking-tight'>
						<span className={cn(meta.text, state === 'tied' && 'text-foreground')}>{team.score ?? 0}</span>
						<span className='mx-0.5 text-base text-muted-foreground/60'>–</span>
						<span className='text-muted-foreground'>{opponent.score ?? 0}</span>
					</div>
				) : (
					<div className='font-display text-base font-bold uppercase italic leading-none tracking-tight text-foreground'>{formatKickoff(game.date).split(' ')[0]}</div>
				)}
				<div className='mt-1.5 flex items-center justify-end gap-1.5 text-[11px] font-semibold'>
					{game.phase === 'in' && (
						<>
							<span className='live-dot h-1.5 w-1.5' />
							<span className='text-foreground'>{game.periodDisplay ?? 'Live'}</span>
							{game.clock && <span className='font-mono text-muted-foreground'>{game.clock}</span>}
						</>
					)}
					{game.phase === 'post' && <span className='uppercase tracking-wider text-muted-foreground'>Final</span>}
					{game.phase === 'pre' && <span className='text-primary'>{formatKickoff(game.date).split(' ').slice(1).join(' ')}</span>}
				</div>
			</div>

			<div className='w-14 shrink-0 border-l border-white/[0.07] pl-3 text-right'>
				<div
					className={cn(
						'font-display text-2xl font-extrabold italic leading-none tabular',
						state === 'won' || state === 'winning' ? 'text-accent' : state === 'lost' ? 'text-muted-foreground/60 line-through decoration-2' : 'text-foreground',
						flash && 'animate-bounce-subtle'
					)}
				>
					{state === 'won' || state === 'winning' ? '+' : ''}
					{points}
				</div>
				<div className='mt-1 text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground'>{POINTS_CAPTION[state]}</div>
			</div>
		</div>
	);
}
