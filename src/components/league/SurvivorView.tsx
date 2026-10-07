'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Check, Crown, EyeOff, HeartPulse, Loader2, Shield, Skull, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, Pill } from '@/components/ui/page';
import { TeamLogo } from '@/components/ui/team-logo';
import { useWeek } from '@/contexts/WeekContext';
import { NFLService } from '@/services/nflService';
import { hasGameStarted } from '@/services/gameUtils';
import type { Game } from '@/components/games/GameCard';
import type { SurvivorMember, SurvivorPickEntry, SurvivorResponse } from '@/lib/survivor';
import { cn } from '@/lib/utils';
import { NudgeButton } from './NudgeButton';

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

function PickCell({ entry, eliminatedHere, noPick }: { entry?: SurvivorPickEntry; eliminatedHere: boolean; noPick: boolean }) {
	if (!entry) {
		return noPick ? (
			<span className={cn('grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold', eliminatedHere ? 'bg-accent-2/15 text-accent-2' : 'text-muted-foreground/50')} title='No pick'>
				{eliminatedHere ? <Skull className='h-3.5 w-3.5' /> : '—'}
			</span>
		) : (
			<span className='h-8 w-8' />
		);
	}
	if (entry.hidden) {
		return (
			<span className='grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-muted-foreground ring-1 ring-white/10' title='Picked — revealed at kickoff'>
				<EyeOff className='h-3.5 w-3.5' />
			</span>
		);
	}
	const ring = entry.result === 'win' ? 'ring-2 ring-accent' : entry.result === 'loss' ? 'ring-2 ring-accent-2' : 'ring-1 ring-white/15';
	return (
		<span className={cn('relative rounded-full', ring, entry.result === 'loss' && 'opacity-60')} title={`${entry.team}${entry.result === 'pending' ? '' : entry.result === 'win' ? ' — won' : ' — lost'}`}>
			<TeamLogo src={entry.logo} alt={entry.abbreviation || entry.team} size={32} className='ring-0' />
		</span>
	);
}

function MemberStatus({ member, champion }: { member: SurvivorMember; champion: boolean }) {
	if (champion)
		return (
			<Pill tone='warning'>
				<Crown className='h-3 w-3' /> Champ
			</Pill>
		);
	if (member.alive)
		return (
			<Pill tone='accent'>
				<HeartPulse className='h-3 w-3' /> Alive
			</Pill>
		);
	return (
		<Pill tone='hot'>
			<Skull className='h-3 w-3' /> Out wk {member.eliminatedWeek}
		</Pill>
	);
}

/** A Survivor league's page body: this week's pick and the whole pool's board. */
export function SurvivorView({ leagueId }: { leagueId: string }) {
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const { currentWeek, season, isPastSeason } = useWeek();
	const [data, setData] = useState<SurvivorResponse | null>(null);
	const [error, setError] = useState(false);
	const [games, setGames] = useState<Game[] | null>(null);
	const [saving, setSaving] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/league/${leagueId}/survivor?season=${season}`, { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to load survivor standings (${res.status})`);
			setData(await res.json());
			setError(false);
		} catch (err) {
			console.error(err);
			setError(true);
		}
	}, [leagueId, season]);

	useEffect(() => {
		setData(null);
		load();
		if (isPastSeason) return;
		const poll = setInterval(load, NFLService.getPollingInterval());
		return () => clearInterval(poll);
	}, [load, isPastSeason]);

	useEffect(() => {
		let cancelled = false;
		setGames(null);
		NFLService.getWeeklyGames(currentWeek, season).then(list => {
			if (!cancelled) setGames(list);
		});
		return () => {
			cancelled = true;
		};
	}, [currentWeek, season]);

	const me = data?.members.find(m => m.userId === userId);
	const myPick = me?.picks[currentWeek];
	const canPick = !!data && !!me?.alive && !data.complete && !isPastSeason && currentWeek >= data.currentWeek && currentWeek <= data.finalWeek && !(myPick && games?.find(g => g.id === myPick.gameId && hasGameStarted(g)));
	const aliveCount = data?.members.filter(m => m.alive).length ?? 0;
	const boardWeeks = useMemo(() => {
		if (!data) return [];
		const last = Math.max(data.currentWeek, data.lastResolvedWeek ?? data.startWeek);
		return Array.from({ length: last - data.startWeek + 1 }, (_, i) => data.startWeek + i);
	}, [data]);

	const choose = async (game: Game, team: string) => {
		setSaving(`${game.id}:${team}`);
		try {
			const res = await fetch(`/api/league/${leagueId}/survivor`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ week: currentWeek, gameId: game.id, team })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error || 'Couldn’t save your pick');
			toast.success(`Riding with the ${team} in week ${currentWeek}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Couldn’t save your pick');
		} finally {
			setSaving(null);
		}
	};

	if (error && !data) return <EmptyState icon={Shield} title='Couldn’t load the pool' description='Try again in a moment.' />;
	if (!data) {
		return (
			<div className='space-y-4'>
				<Skeleton className='h-32 rounded-2xl' />
				<Skeleton className='h-72 rounded-2xl' />
			</div>
		);
	}

	const champions = new Set(data.champions);
	const outOfRange = currentWeek < data.startWeek || currentWeek > data.finalWeek;

	return (
		<div className='space-y-5'>
			{/* Pool status */}
			<Card className='relative overflow-hidden p-5'>
				<div aria-hidden className='pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-accent-2/15 blur-3xl' />
				<div className='relative flex flex-wrap items-end justify-between gap-4'>
					<div>
						<p className='eyebrow flex items-center gap-2'>
							<Shield className='h-3.5 w-3.5' /> Survivor · weeks {data.startWeek}–{data.finalWeek}
						</p>
						{data.complete ? (
							<h2 className='display-heading mt-2 text-3xl sm:text-4xl'>
								<span className='text-[#FFD66B]'>{data.members.filter(m => champions.has(m.userId)).map(m => m.name).join(' & ')}</span> {champions.size > 1 ? 'share the crown' : 'wins it all'}
							</h2>
						) : (
							<h2 className='display-heading mt-2 text-4xl sm:text-5xl'>
								<span className='text-accent'>{aliveCount}</span> <span className='text-muted-foreground'>of {data.members.length} still standing</span>
							</h2>
						)}
					</div>
					{me && <MemberStatus member={me} champion={champions.has(me.userId)} />}
				</div>
				{data.reprieveWeeks.length > 0 && (
					<p className='relative mt-3 text-xs text-muted-foreground'>
						Everyone left lost in week{data.reprieveWeeks.length > 1 ? 's' : ''} {data.reprieveWeeks.join(', ')}, so nobody went out.
					</p>
				)}
			</Card>

			{/* This week's pick */}
			{!isPastSeason && !data.complete && me?.alive && !outOfRange && (
				<Card className='p-4 sm:p-5'>
					<div className='mb-3 flex items-center justify-between gap-3'>
						<div>
							<p className='eyebrow'>Week {currentWeek} pick</p>
							<p className='mt-1 text-sm text-muted-foreground'>
								{myPick ? (
									<>
										You’re riding with <span className='font-semibold text-foreground'>{myPick.team}</span>. {canPick ? 'You can switch until it kicks off.' : 'Locked in.'}
									</>
								) : currentWeek < data.currentWeek ? (
									'This week is already underway.'
								) : (
									'Pick one team to win. You can’t use it again this season.'
								)}
							</p>
						</div>
						{myPick && <TeamLogo src={myPick.logo} alt={myPick.abbreviation} size={44} />}
					</div>

					{canPick &&
						(games === null ? (
							<div className='space-y-2'>
								{[0, 1, 2].map(i => (
									<Skeleton key={i} className='h-14 rounded-xl' />
								))}
							</div>
						) : games.length === 0 ? (
							<p className='text-sm text-muted-foreground'>No games scheduled this week.</p>
						) : (
							<div className='grid gap-2 sm:grid-cols-2'>
								{games.map(game => {
									const started = hasGameStarted(game);
									return (
										<div key={game.id} className={cn('flex items-stretch gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1.5', started && 'opacity-50')}>
											{(['away', 'home'] as const).map(side => {
												const team = game[side];
												const usedWeek = data.usedTeams[team.team];
												const usedElsewhere = usedWeek !== undefined && usedWeek !== currentWeek;
												const selected = myPick?.gameId === game.id && myPick.team === team.team;
												const busy = saving === `${game.id}:${team.team}`;
												return (
													<button
														key={side}
														type='button'
														disabled={started || usedElsewhere || !!saving}
														onClick={() => choose(game, team.team)}
														aria-pressed={selected}
														className={cn(
															'flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
															selected ? 'bg-primary/15 ring-1 ring-primary/60' : 'hover:bg-white/[0.06]',
															(usedElsewhere || started) && 'cursor-not-allowed'
														)}
													>
														<TeamLogo src={team.logo} alt={team.abbreviation} size={30} className={cn(usedElsewhere && 'grayscale')} />
														<span className='min-w-0'>
															<span className={cn('block font-display text-sm font-bold uppercase italic leading-none', usedElsewhere && 'text-muted-foreground line-through')}>
																{side === 'home' ? '@ ' : ''}
																{team.abbreviation}
															</span>
															<span className='block text-[10px] text-muted-foreground tabular'>{usedElsewhere ? `Used wk ${usedWeek}` : team.record}</span>
														</span>
														{busy ? <Loader2 className='ml-auto h-4 w-4 animate-spin text-primary' /> : selected && <Check className='ml-auto h-4 w-4 text-primary' strokeWidth={3} />}
													</button>
												);
											})}
										</div>
									);
								})}
							</div>
						))}
				</Card>
			)}

			{/* The board */}
			<Card className='p-4 sm:p-5'>
				<p className='eyebrow mb-3 flex items-center gap-2'>
					<Trophy className='h-3.5 w-3.5' /> The board
				</p>
				<div className='-mx-1 overflow-x-auto'>
					<table className='w-full min-w-max border-separate border-spacing-y-1 px-1 text-sm'>
						<thead>
							<tr className='text-[10px] uppercase tracking-wider text-muted-foreground'>
								<th className='sticky left-0 z-10 bg-[hsl(var(--surface))] py-1 pr-3 text-left font-semibold'>Player</th>
								{boardWeeks.map(week => (
									<th key={week} className={cn('px-1 font-semibold tabular', week === currentWeek && 'text-primary')}>
										{week}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{data.members.map(member => {
								const isMe = member.userId === userId;
								return (
									<tr key={member.userId} className={cn(!member.alive && 'opacity-70')}>
										<td className='sticky left-0 z-10 bg-[hsl(var(--surface))] py-1 pr-3'>
											<div className='flex items-center gap-2'>
												<Avatar className={cn('h-8 w-8 ring-1', isMe ? 'ring-primary/60' : 'ring-white/10')}>
													<AvatarImage src={member.image || undefined} alt={member.name} />
													<AvatarFallback className='bg-primary/15 text-[10px] font-bold text-primary'>{initials(member.name)}</AvatarFallback>
												</Avatar>
												<div className='min-w-0'>
													<p className={cn('max-w-[9rem] truncate text-sm font-semibold', isMe && 'text-primary', !member.alive && 'line-through decoration-accent-2/60')}>{member.name}</p>
													<span className='flex flex-wrap items-center gap-1'>
														<MemberStatus member={member} champion={champions.has(member.userId)} />
														<NudgeButton userId={member.userId} name={member.name} />
													</span>
												</div>
											</div>
										</td>
										{boardWeeks.map(week => {
											const resolved = data.lastResolvedWeek !== null && week <= data.lastResolvedWeek;
											const active = member.eliminatedWeek === null || week <= member.eliminatedWeek;
											return (
												<td key={week} className='px-1 text-center'>
													<div className='flex justify-center'>
														{active ? <PickCell entry={member.picks[week]} eliminatedHere={member.eliminatedWeek === week} noPick={resolved} /> : <span className='h-8 w-8' />}
													</div>
												</td>
											);
										})}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p className='mt-3 text-[11px] text-muted-foreground'>Other players’ picks are hidden until their game kicks off.</p>
			</Card>
		</div>
	);
}
