'use client';

import { useState } from 'react';
import { EyeOff, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamLogo } from '@/components/ui/team-logo';
import { cn } from '@/lib/utils';
import { PICK_STATE_META } from './SweatPickRow';
import type { SweatStanding } from './sweatModel';

type Mode = 'season' | 'week';

const RANK_COLORS = ['text-[#FFD66B]', 'text-[#D5DCE6]', 'text-[#E7A16B]'];

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

function Movement({ from, to }: { from: number; to: number }) {
	const delta = from - to;
	if (delta === 0) return <span className='text-[10px] font-bold text-muted-foreground/50'>—</span>;
	const up = delta > 0;
	return (
		<span className={cn('inline-flex items-center text-[10px] font-bold tabular', up ? 'text-accent' : 'text-accent-2')} aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(delta)}`}>
			{up ? '▲' : '▼'}
			{Math.abs(delta)}
		</span>
	);
}

/** Projected standings "if the games ended now" — season (with rank movement) or this week only. */
export function SweatStandings({ standings, viewerId, week }: { standings: SweatStanding[]; viewerId?: string; week: number }) {
	const [mode, setMode] = useState<Mode>('season');

	const rows = [...standings].sort((a, b) =>
		mode === 'season' ? a.projectedRank - b.projectedRank || a.name.localeCompare(b.name) : a.projectedWeekRank - b.projectedWeekRank || a.name.localeCompare(b.name)
	);

	return (
		<div className='glass rounded-2xl p-2 sm:p-3'>
			<div className='flex items-center justify-between gap-3 px-2 pb-2 pt-1'>
				<p className='eyebrow'>{mode === 'season' ? 'Season · projected' : `Week ${week} · projected`}</p>
				<div className='flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5' role='tablist' aria-label='Projection'>
					{(['season', 'week'] as const).map(m => (
						<button
							key={m}
							type='button'
							role='tab'
							aria-selected={mode === m}
							onClick={() => setMode(m)}
							className={cn('rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors', mode === m ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground')}
						>
							{m === 'season' ? 'Season' : 'Week'}
						</button>
					))}
				</div>
			</div>

			<ol className='space-y-1'>
				{rows.map((s, i) => {
					const isMe = s.userId === viewerId;
					const rank = mode === 'season' ? s.projectedRank : s.projectedWeekRank;
					return (
						<li
							key={s.userId}
							className={cn('flex animate-fade-in items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.04] sm:px-3', isMe && 'bg-primary/[0.08] ring-1 ring-primary/30 hover:bg-primary/[0.1]')}
							style={{ animationDelay: `${i * 30}ms` }}
						>
							<div className='flex w-7 shrink-0 flex-col items-center'>
								<span className={cn('font-display text-xl font-extrabold italic leading-none tabular', RANK_COLORS[rank - 1] ?? 'text-muted-foreground')}>{rank}</span>
								{mode === 'season' && <Movement from={s.currentRank} to={s.projectedRank} />}
							</div>

							<Avatar className='h-9 w-9 ring-1 ring-white/10'>
								<AvatarImage src={s.image || undefined} alt={s.name} />
								<AvatarFallback className='bg-primary/15 text-xs font-bold text-primary'>{initials(s.name)}</AvatarFallback>
							</Avatar>

							<div className='min-w-0 flex-1'>
								<div className='flex items-center gap-1.5'>
									<span className={cn('truncate text-sm font-semibold', isMe && 'text-primary')}>{s.name}</span>
									{isMe && <span className='shrink-0 rounded bg-primary/15 px-1 text-[9px] font-bold uppercase tracking-wider text-primary'>You</span>}
								</div>
								<div className='mt-1 flex min-h-[18px] items-center gap-1'>
									{!s.hasPicks ? (
										<span className='text-[11px] text-muted-foreground/70'>No picks this week</span>
									) : (
										<>
											{s.picks.map(p => (
												<span key={p.gameId} className='relative' title={`${p.abbreviation} · ${PICK_STATE_META[p.state].label}${p.isLock ? ' · Lock' : ''}`}>
													<TeamLogo src={p.logo} alt={p.abbreviation} size={18} className={cn('ring-[1.5px]', PICK_STATE_META[p.state].ring, p.state === 'lost' && 'opacity-45')} />
													{p.isLock && <Lock className='absolute -right-1 -top-1 h-2.5 w-2.5 text-warning' strokeWidth={3} />}
												</span>
											))}
											{s.hiddenPicks > 0 && (
												<span className='ml-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground/70' title='Revealed at kickoff'>
													<EyeOff className='h-3 w-3' />
													{s.hiddenPicks}
												</span>
											)}
										</>
									)}
								</div>
							</div>

							<div className='shrink-0 text-right'>
								<div className='font-display text-2xl font-extrabold italic leading-none tabular'>{mode === 'season' ? s.projectedSeason : s.projectedWeek}</div>
								<div className='mt-1 text-[10px] font-semibold tabular text-muted-foreground'>
									{mode === 'season' ? (
										<>
											<span className={cn(s.projectedWeek > 0 && 'text-accent')}>+{s.projectedWeek}</span> this wk
										</>
									) : (
										<>
											{s.secured} banked{s.liveWinning > 0 && <span className='text-accent'> +{s.liveWinning}</span>}
										</>
									)}
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
