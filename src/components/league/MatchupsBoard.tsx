'use client';

import { useCallback, useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeStrip } from '@/components/badges/BadgeStrip';
import { NFLService } from '@/services/nflService';
import type { Badge } from '@/lib/badges';
import { formatRecord, pairKey, type Matchup, type MatchupSide, type MatchupsResponse, type PairRecord } from '@/lib/matchups';
import { cn } from '@/lib/utils';
import { SideAvatar, StatusPill, fmtPoints, shortName } from './matchupParts';

/** "Steve M. leads 5–3", "Series tied 2–2" or "First meeting" for a pair's all-time record. */
function rivalryLine(matchup: Matchup, rivalries?: Record<string, PairRecord>): string | null {
	if (matchup.isBye || !rivalries) return null;
	const [x, y] = matchup.sides;
	const rec = rivalries[pairKey(x.userId, y.userId)];
	if (!rec || rec.aWins + rec.bWins + rec.ties === 0) return 'First meeting';
	const ties = rec.ties ? `–${rec.ties}` : '';
	if (rec.aWins === rec.bWins) return `Series tied ${rec.aWins}–${rec.bWins}${ties}`;
	const leader = rec.aWins > rec.bWins ? rec.a : rec.b;
	const name = matchup.sides.find(s => s.userId === leader)?.name ?? 'Leader';
	return `${shortName(name)} leads ${Math.max(rec.aWins, rec.bWins)}–${Math.min(rec.aWins, rec.bWins)}${ties}`;
}

function SideRow({ side, matchup, record, isMe, badges }: { side: MatchupSide; matchup: Matchup; record?: string; isMe: boolean; badges?: Badge[] }) {
	const final = matchup.status === 'final' && !matchup.noContest;
	const won = final && matchup.winnerId === side.userId;
	const lost = final && !matchup.isTie && !won;
	const other = matchup.sides.find(s => s !== side)!;
	const leading = matchup.status === 'live' && side.points > other.points;

	return (
		<div className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5', won && 'bg-accent/[0.07]')}>
			<SideAvatar side={side} className={cn(won && 'ring-accent/60')} />
			<div className='min-w-0 flex-1'>
				<p className={cn('flex items-center gap-1.5 text-sm font-semibold', lost && 'text-muted-foreground')}>
					<span className='truncate'>{side.name}</span>
					{isMe && <span className='shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary'>You</span>}
					<BadgeStrip badges={badges} max={2} />
				</p>
				<p className='text-[11px] text-muted-foreground tabular'>
					{side.kind === 'median' ? (
						'Bye week · plays the median'
					) : !side.hasPicks ? (
						<span className='text-warning'>No picks yet</span>
					) : (
						<>
							{side.correct}/{side.totalGames} correct
							{side.liveGames > 0 && <span className='text-live'> · {side.liveGames} live</span>}
							{record && <span> · {record}</span>}
						</>
					)}
				</p>
			</div>
			<span className={cn('shrink-0 font-display text-2xl font-extrabold italic leading-none tabular', won ? 'text-accent' : lost ? 'text-muted-foreground' : leading ? 'text-foreground' : 'text-foreground/80')}>
				{fmtPoints(side.points)}
			</span>
		</div>
	);
}

function MatchupCard({ matchup, records, rivalries, currentUserId, badgesByUser, index }: { matchup: Matchup; records: MatchupsResponse['records']; rivalries?: MatchupsResponse['rivalries']; currentUserId?: string; badgesByUser?: Map<string, Badge[]>; index: number }) {
	const isMine = matchup.sides.some(s => s.userId === currentUserId);
	const rivalry = rivalryLine(matchup, rivalries);
	return (
		<div
			className={cn('animate-slide-up rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5', isMine && 'bg-primary/[0.06] ring-1 ring-primary/30')}
			style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
		>
			<div className='flex items-center justify-between px-2 pb-1 pt-1'>
				<span className='flex min-w-0 items-center gap-2'>
					<span className='eyebrow shrink-0 text-[9px]'>{isMine ? 'Your matchup' : matchup.isBye ? 'Bye week' : 'Matchup'}</span>
					{rivalry && (
						<span className='truncate text-[10px] font-semibold text-muted-foreground' title='All-time head-to-head in this league'>
							⚔️ {rivalry}
						</span>
					)}
				</span>
				<StatusPill matchup={matchup} />
			</div>
			{matchup.sides.map(side => (
				<SideRow
					key={side.userId}
					side={side}
					matchup={matchup}
					isMe={side.userId === currentUserId}
					record={side.kind === 'member' ? formatRecord(records[side.userId]) : undefined}
					badges={badgesByUser?.get(side.userId)}
				/>
			))}
		</div>
	);
}

/** All of a week's head-to-head pairings, viewer's first. Fetches and polls its own data. */
export function MatchupsBoard({ leagueId, week, season, currentUserId, badgesByUser }: { leagueId: string; week: number; season?: number; currentUserId?: string; badgesByUser?: Map<string, Badge[]> }) {
	const [data, setData] = useState<MatchupsResponse | null>(null);
	const [error, setError] = useState(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/league/${leagueId}/matchups?week=${week}${season ? `&season=${season}` : ''}&rivalries=1`, { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to load matchups (${res.status})`);
			setData(await res.json());
			setError(false);
		} catch (err) {
			console.error(err);
			setError(true);
		}
	}, [leagueId, week, season]);

	useEffect(() => {
		setData(null);
		load();
		window.addEventListener('refreshLeaderboard', load);
		const poll = setInterval(load, NFLService.getPollingInterval());
		return () => {
			window.removeEventListener('refreshLeaderboard', load);
			clearInterval(poll);
		};
	}, [load]);

	if (error && !data) return <p className='rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive'>Couldn’t load matchups.</p>;
	if (!data)
		return (
			<div className='space-y-2'>
				{[0, 1, 2].map(i => (
					<Skeleton key={i} className='h-[104px] rounded-xl' />
				))}
			</div>
		);
	if (data.matchups.length === 0)
		return (
			<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center'>
				<span className='grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary'>
					<Swords className='h-5 w-5' />
				</span>
				<p className='text-sm text-muted-foreground'>Head-to-head matchups start once the league has 2+ players.</p>
			</div>
		);

	const ordered = [...data.matchups].sort((a, b) => Number(b.id === data.myMatchupId) - Number(a.id === data.myMatchupId));
	return (
		<div className='space-y-2'>
			{ordered.map((m, i) => (
				<MatchupCard key={m.id} matchup={m} records={data.records} rivalries={data.rivalries} currentUserId={currentUserId} badgesByUser={badgesByUser} index={i} />
			))}
			<p className='px-1 pt-1 text-[11px] leading-snug text-muted-foreground'>Everyone plays everyone before rematches. Odd player out faces the league median. Records count final weeks; ⚔️ is the all-time series in this league.</p>
		</div>
	);
}
