'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowRight, Clock, Flame, Gamepad2, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, SectionHeader } from '@/components/ui/page';
import { SweatPickRow, formatKickoff } from '@/components/sweat/SweatPickRow';
import { SweatStandings } from '@/components/sweat/SweatStandings';
import { useSweat } from '@/components/sweat/useSweat';
import type { SweatPickState, SweatResponse } from '@/components/sweat/sweatModel';
import { cn } from '@/lib/utils';

const FLASH_MS = 1800;
const GOOD: SweatPickState[] = ['winning', 'won'];

interface SweatViewProps {
	leagueId: string;
	week: number;
	/** Jump to the full Results view (Results is replaced by Live in the mobile nav) */
	onShowResults?: () => void;
	/** Jump to the picks view (shown when the viewer hasn't picked) */
	onMakePicks?: () => void;
}

/** Game IDs of picks that just flipped to winning/won since the previous snapshot. */
function useFlips(data: SweatResponse | null) {
	const previous = useRef<{ week: number; states: Map<string, SweatPickState> } | null>(null);
	const [flashing, setFlashing] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!data) return;
		const states = new Map(data.me.picks.map(p => [p.gameId, p.state]));
		// First snapshot of a week: nothing to compare against, so nothing "flipped"
		const prev = previous.current?.week === data.week ? previous.current.states : null;
		previous.current = { week: data.week, states };
		if (!prev) return;
		const flipped = data.me.picks.filter(p => GOOD.includes(p.state) && !GOOD.includes(prev.get(p.gameId) ?? 'upcoming')).map(p => p.gameId);
		if (flipped.length > 0) setFlashing(new Set(flipped));
	}, [data]);

	useEffect(() => {
		if (flashing.size === 0) return;
		const timer = setTimeout(() => setFlashing(new Set()), FLASH_MS);
		return () => clearTimeout(timer);
	}, [flashing]);

	return flashing;
}

function ScoreBug({ data, viewerId, refreshing, onRefresh }: { data: SweatResponse; viewerId?: string; refreshing: boolean; onRefresh: () => void }) {
	const { secured, live, max } = data.me;
	const projected = secured + live;
	const me = data.standings.find(s => s.userId === viewerId);
	const pct = (n: number) => (max > 0 ? `${Math.min(100, (n / max) * 100)}%` : '0%');
	const updated = new Date(data.updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

	return (
		<div className='glass relative overflow-hidden rounded-2xl' aria-label={`Secured ${secured} · Live +${live} · Max ${max}`}>
			<div className='pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-live/20 blur-3xl' />
			<div className='pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl' />
			<div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-live/70 to-transparent' />

			<div className='relative flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 sm:px-5'>
				<div className='flex min-w-0 items-center gap-2'>
					{data.games.live > 0 ? (
						<span className='inline-flex items-center gap-1.5 rounded-md bg-live px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_0_20px_-4px_hsl(var(--live)/0.8)]'>
							<span className='h-1.5 w-1.5 animate-pulse rounded-full bg-white' /> Live
						</span>
					) : (
						<span className='rounded-md bg-white/[0.08] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground'>Week {data.week}</span>
					)}
					<span className='truncate text-xs font-semibold text-muted-foreground tabular'>
						{data.games.live > 0 && <span className='text-foreground'>{data.games.live} live · </span>}
						{data.games.final} final · {data.games.upcoming} to go
					</span>
				</div>
				<button
					type='button'
					onClick={onRefresh}
					className='inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground'
					aria-label='Refresh live scores'
				>
					<RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
					<span className='tabular'>{updated}</span>
				</button>
			</div>

			<div className='relative grid grid-cols-3 divide-x divide-white/[0.06] px-1 pb-3 pt-4 sm:pt-5'>
				{[
					{ label: 'Secured', value: secured, className: 'text-foreground' },
					{ label: 'Live', value: `+${live}`, className: live > 0 ? 'text-accent drop-shadow-[0_0_18px_hsl(var(--accent)/0.45)]' : 'text-muted-foreground' },
					{ label: 'Max', value: max, className: 'text-muted-foreground' }
				].map(stat => (
					<div key={stat.label} className='px-3 text-center sm:px-5'>
						<p className='eyebrow'>{stat.label}</p>
						<p className={cn('mt-1.5 font-display text-5xl font-extrabold italic leading-none tabular tracking-tight sm:text-6xl', stat.className)}>{stat.value}</p>
					</div>
				))}
			</div>

			{/* Secured | live | still possible, as one bar */}
			<div className='relative px-4 pb-4 sm:px-5'>
				<div className='flex h-2 overflow-hidden rounded-full bg-white/[0.06]'>
					<div className='h-full bg-accent transition-[width] duration-700 ease-out-expo' style={{ width: pct(secured) }} />
					<div
						className='h-full bg-accent/40 bg-[length:8px_8px] transition-[width] duration-700 ease-out-expo'
						style={{ width: pct(live), backgroundImage: 'linear-gradient(135deg, hsl(var(--accent) / 0.5) 25%, transparent 25%, transparent 50%, hsl(var(--accent) / 0.5) 50%, hsl(var(--accent) / 0.5) 75%, transparent 75%)' }}
					/>
				</div>
				<div className='mt-2.5 flex items-center justify-between gap-3 text-xs'>
					<span className='text-muted-foreground'>
						If it ended now: <span className='font-bold text-foreground tabular'>{projected} pts</span>
					</span>
					{me && (
						<span className='inline-flex items-center gap-1.5 font-semibold tabular text-muted-foreground'>
							#{me.currentRank}
							<ArrowRight className='h-3 w-3' />
							<span className={cn('font-bold', me.projectedRank < me.currentRank ? 'text-accent' : me.projectedRank > me.currentRank ? 'text-accent-2' : 'text-foreground')}>#{me.projectedRank}</span>
							<span className='hidden sm:inline'>in the league</span>
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function SweatSkeleton() {
	return (
		<div className='space-y-4' aria-busy>
			<Skeleton className='h-52 w-full rounded-2xl' />
			{[0, 1, 2, 3, 4].map(i => (
				<Skeleton key={i} className='h-[76px] w-full rounded-xl' />
			))}
		</div>
	);
}

export function SweatView({ leagueId, week, onShowResults, onMakePicks }: SweatViewProps) {
	const { data: session } = useSession();
	const viewerId = session?.user?.id;
	const { data, error, refreshing, refresh } = useSweat(leagueId, week);
	const flashing = useFlips(data);

	if (error) {
		return (
			<EmptyState
				icon={Flame}
				title='Couldn’t load live scores'
				description='The scoreboard didn’t answer. Give it another shot.'
				action={
					<Button onClick={refresh} variant='outline'>
						<RefreshCw /> Try again
					</Button>
				}
			/>
		);
	}
	if (!data) return <SweatSkeleton />;

	const underway = data.games.live + data.games.final > 0;
	const resultsLink = onShowResults && (
		<Button variant='ghost' size='sm' onClick={onShowResults} className='text-primary'>
			All results <ArrowRight />
		</Button>
	);

	return (
		<div className='space-y-6'>
			{underway ? (
				<ScoreBug data={data} viewerId={viewerId} refreshing={refreshing} onRefresh={refresh} />
			) : (
				<EmptyState
					icon={Clock}
					title={`Week ${data.week} hasn’t kicked off`}
					description={data.nextKickoff ? `Kickoff is ${formatKickoff(data.nextKickoff)} — check back when games start.` : 'Check back when games start.'}
				/>
			)}

			<section>
				<SectionHeader title='My picks' icon={Gamepad2} action={resultsLink} />
				{data.me.hasPicks ? (
					<div className='space-y-2'>
						{data.me.picks.map((pick, i) => (
							<SweatPickRow key={pick.gameId} pick={pick} flash={flashing.has(pick.gameId)} className='animate-slide-up' style={{ animationDelay: `${i * 40}ms` }} />
						))}
					</div>
				) : (
					<EmptyState
						icon={Gamepad2}
						title='No picks this week'
						description={data.games.upcoming > 0 ? 'There are still games left to pick — get in before kickoff.' : 'You sat this one out. Follow along with the league below.'}
						action={
							onMakePicks && data.games.upcoming > 0 ? (
								<Button onClick={onMakePicks}>
									<Gamepad2 /> Make picks
								</Button>
							) : undefined
						}
					/>
				)}
			</section>

			{underway && data.standings.length > 0 && (
				<section>
					<SectionHeader title='If it ended now' icon={TrendingUp} />
					<SweatStandings standings={data.standings} viewerId={viewerId} week={data.week} />
					<p className='mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground/80'>
						Projected = points banked from finals + live picks currently winning (ties don’t count). Picks show once their game kicks off.
					</p>
				</section>
			)}
		</div>
	);
}
