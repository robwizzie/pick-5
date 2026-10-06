'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronRight } from 'lucide-react';
import { useWeek } from '@/contexts/WeekContext';
import { SWEAT_REFRESH_MS, fetchSweat, useVisiblePolling, useWeekLiveStatus } from '@/components/sweat/useSweat';
import type { SweatResponse } from '@/components/sweat/sweatModel';
import { cn } from '@/lib/utils';

interface LiveNowBannerProps {
	leagues: Array<{ _id: string; name: string }>;
	className?: string;
}

/**
 * Dashboard banner shown only while games of the live week are in progress: how many games are
 * live and, per league, the viewer's banked/projected points and projected rank. Links into each
 * league's Live view. Renders nothing when no games are live.
 */
export function LiveNowBanner({ leagues, className }: LiveNowBannerProps) {
	const { liveWeek } = useWeek();
	const { data: session } = useSession();
	const viewerId = session?.user?.id;
	const status = useWeekLiveStatus(liveWeek);
	const live = (status?.liveGames ?? 0) > 0;
	const [sweats, setSweats] = useState<Record<string, SweatResponse>>({});

	const leagueKey = leagues.map(l => l._id).join(',');
	const load = useCallback(async () => {
		if (!liveWeek || !leagueKey) return;
		const ids = leagueKey.split(',');
		const settled = await Promise.allSettled(ids.map(id => fetchSweat(id, liveWeek)));
		setSweats(prev => {
			const next = { ...prev };
			settled.forEach((r, i) => {
				if (r.status === 'fulfilled') next[ids[i]] = r.value;
			});
			return next;
		});
	}, [leagueKey, liveWeek]);

	useEffect(() => {
		if (live) load();
	}, [live, load]);
	useVisiblePolling(load, SWEAT_REFRESH_MS, live);

	if (!live || leagues.length === 0) return null;

	// Prefer the server's fresher count once a league snapshot is in
	const firstSweat = leagues.map(l => sweats[l._id]).find(Boolean);
	const liveGames = firstSweat?.games.live || status?.liveGames || 0;
	if (liveGames === 0) return null;

	return (
		<section
			className={cn(
				'relative overflow-hidden rounded-2xl border border-live/30 bg-gradient-to-br from-live/[0.12] via-surface/80 to-surface/80 shadow-[0_0_0_1px_hsl(var(--live)/0.08),0_20px_60px_-24px_hsl(var(--live)/0.7)] backdrop-blur-xl animate-fade-in',
				className
			)}
			aria-label='Live games'
		>
			<div className='pointer-events-none absolute -left-10 -top-16 h-40 w-40 animate-pulse-glow rounded-full bg-live/25 blur-3xl' />
			<div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-live to-transparent' />

			<div className='relative flex items-center justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5'>
				<h2 className='flex items-center gap-2.5 font-display text-lg font-bold uppercase italic leading-none tracking-tight sm:text-xl'>
					<span className='live-dot h-2.5 w-2.5' />
					<span>
						<span className='tabular text-live'>{liveGames}</span> {liveGames === 1 ? 'game' : 'games'} live
						<span className='text-muted-foreground'> — sweat it out</span>
					</span>
				</h2>
			</div>

			<ul className='relative px-2 pb-2'>
				{leagues.map(league => {
					const sweat = sweats[league._id];
					const me = sweat?.standings.find(s => s.userId === viewerId);
					const projected = sweat ? sweat.me.secured + sweat.me.live : null;
					return (
						<li key={league._id}>
							<Link
								href={`/league/${league._id}?view=live`}
								className='group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.05] active:scale-[0.99]'
							>
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-semibold'>{league.name}</p>
									<p className='mt-0.5 text-xs text-muted-foreground tabular'>
										{!sweat ? (
											<span className='inline-block h-3 w-28 animate-pulse rounded bg-white/[0.06] align-middle' />
										) : sweat.me.hasPicks ? (
											<>
												<span className='text-foreground'>{sweat.me.secured}</span> secured
												{sweat.me.live > 0 && <span className='text-accent'> · +{sweat.me.live} live</span>}
												<span> · max {sweat.me.max}</span>
											</>
										) : (
											'No picks this week'
										)}
									</p>
								</div>
								{sweat && projected !== null && (
									<div className='shrink-0 text-right'>
										<div className='font-display text-2xl font-extrabold italic leading-none tabular'>{projected}</div>
										{me && (
											<div className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular'>
												proj{' '}
												<span className={cn('font-bold', me.projectedRank < me.currentRank ? 'text-accent' : me.projectedRank > me.currentRank ? 'text-accent-2' : 'text-foreground')}>
													#{me.projectedRank}
													{me.projectedRank !== me.currentRank && (me.projectedRank < me.currentRank ? ' ▲' : ' ▼')}
												</span>
											</div>
										)}
									</div>
								)}
								<ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

export default LiveNowBanner;
