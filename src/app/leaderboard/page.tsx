'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Crown, Globe, Hash, Percent, Trophy, Users } from 'lucide-react';
import CountUp from 'react-countup';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageContainer, PageHeader, Pill, SectionHeader, StatTile } from '@/components/ui/page';
import { LeaderboardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
	rank: number;
	name: string;
	image: string | null;
	totalPoints: number;
	totalPicks: number;
	correctPicks: number;
	winRate: number;
	isCurrentUser: boolean;
}

interface LeagueSummary {
	_id: string;
	mode?: string;
}

interface SeasonStat {
	userId?: string;
	player: string;
	image: string | null;
	totalPoints: number;
	totalPicks: number;
	correctPicks: number;
}

interface Aggregate {
	key: string;
	userId?: string;
	name: string;
	image: string | null;
	totalPoints: number;
	totalPicks: number;
	correctPicks: number;
}

const RANK_TEXT: Record<number, string> = { 1: 'text-[#FFD66B]', 2: 'text-[#D5DCE6]', 3: 'text-[#E7A16B]' };
const RANK_RING: Record<number, string> = { 1: 'ring-[#FFD66B]/60', 2: 'ring-[#D5DCE6]/50', 3: 'ring-[#E7A16B]/50' };
const RANK_GLOW: Record<number, string> = { 1: 'from-[#FFD66B]/25', 2: 'from-[#D5DCE6]/15', 3: 'from-[#E7A16B]/20' };

function initials(name: string) {
	return name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

export default function GlobalLeaderboard() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [userRank, setUserRank] = useState<number | null>(null);

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
		}
	}, [status, router]);

	useEffect(() => {
		if (!session) return;
		const myId = session.user?.id;
		const myName = session.user?.name;

		const fetchGlobalLeaderboard = async () => {
			try {
				setLoading(true);

				const leaguesRes = await fetch('/api/user/leagues');
				if (!leaguesRes.ok) return;
				// Survivor pools have no points, so they don't feed the points leaderboard
				const leagues = ((await leaguesRes.json()) as LeagueSummary[]).filter(l => l.mode !== 'survivor');
				if (leagues.length === 0) return;

				// Fetch every league's standings concurrently
				const perLeague = await Promise.all(
					leagues.map(async league => {
						try {
							const res = await fetch(`/api/leaderboard?leagueId=${league._id}`);
							if (!res.ok) return [];
							const data: { seasonStats?: SeasonStat[] } = await res.json();
							return Array.isArray(data.seasonStats) ? data.seasonStats : [];
						} catch (error) {
							console.error('Error fetching league leaderboard:', error);
							return [];
						}
					})
				);

				// Aggregate across leagues, keyed by user id (names can collide)
				const totals = new Map<string, Aggregate>();
				perLeague.flat().forEach(stat => {
					const key = stat.userId ?? `name:${stat.player}`;
					const existing = totals.get(key);
					if (existing) {
						existing.totalPoints += stat.totalPoints || 0;
						existing.totalPicks += stat.totalPicks || 0;
						existing.correctPicks += stat.correctPicks || 0;
					} else {
						totals.set(key, {
							key,
							userId: stat.userId,
							name: stat.player,
							image: stat.image || null,
							totalPoints: stat.totalPoints || 0,
							totalPicks: stat.totalPicks || 0,
							correctPicks: stat.correctPicks || 0
						});
					}
				});

				const sorted: LeaderboardEntry[] = Array.from(totals.values())
					.sort((a, b) => b.totalPoints - a.totalPoints)
					.map((user, index) => ({
						rank: index + 1,
						name: user.name,
						image: user.image,
						totalPoints: user.totalPoints,
						totalPicks: user.totalPicks,
						correctPicks: user.correctPicks,
						winRate: user.totalPicks > 0 ? Math.round((user.correctPicks / user.totalPicks) * 100) : 0,
						isCurrentUser: myId && user.userId ? user.userId === myId : user.name === myName
					}));

				setLeaderboard(sorted);
				setUserRank(sorted.find(entry => entry.isCurrentUser)?.rank ?? null);
			} catch (error) {
				console.error('Error fetching global leaderboard:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchGlobalLeaderboard();
	}, [session]);

	const header = <PageHeader eyebrow={<><Globe className='h-3.5 w-3.5' /> All your leagues</>} title='Global Leaderboard' description='Every player across your leagues, ranked by total season points.' actions={userRank ? <Pill tone='primary'>You&apos;re #{userRank}</Pill> : undefined} />;

	if (loading) {
		return (
			<PageContainer size='narrow'>
				{header}
				<div className='mb-8 grid grid-cols-3 gap-3'>
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className='h-28 rounded-2xl' />
					))}
				</div>
				<Skeleton className='mb-8 h-56 rounded-2xl' />
				<LeaderboardSkeleton rows={6} />
			</PageContainer>
		);
	}

	if (leaderboard.length === 0) {
		return (
			<PageContainer size='narrow'>
				{header}
				<EmptyState
					icon={Trophy}
					title='No rankings yet'
					description='Join a league and make picks to appear on the leaderboard.'
					action={
						<Button asChild>
							<Link href='/dashboard'>Go to dashboard</Link>
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	const podium = leaderboard.slice(0, 3);
	const rest = leaderboard.slice(3);
	// Top X% — rank 1 of 10 is the top 10%
	const percentile = userRank ? Math.max(1, Math.ceil((userRank / leaderboard.length) * 100)) : null;

	return (
		<PageContainer size='narrow'>
			{header}

			<div className='mb-8 grid grid-cols-3 gap-3'>
				<StatTile label='Players' value={leaderboard.length} icon={Users} tone='muted' />
				<StatTile label='Your rank' value={userRank ? `#${userRank}` : '—'} icon={Hash} tone='primary' />
				<StatTile label='Top' value={percentile ? `${percentile}%` : '—'} icon={Percent} tone='accent' />
			</div>

			{/* Podium — 2 / 1 / 3 */}
			<section aria-label='Top three' className='mb-8'>
				<div className='grid grid-cols-3 items-end gap-2 sm:gap-4'>
					{[podium[1], podium[0], podium[2]].map((entry, slot) =>
						entry ? <PodiumSpot key={entry.rank} entry={entry} delay={[1, 0, 2][slot] * 90} /> : <div key={`empty-${slot}`} />
					)}
				</div>
			</section>

			{rest.length > 0 && (
				<section>
					<SectionHeader title='Rankings' icon={Trophy} />
					<Card className='p-2 sm:p-3'>
						<ol className='space-y-1'>
							{rest.map((entry, i) => (
								<li
									key={`${entry.rank}-${entry.name}`}
									className={cn('flex animate-slide-up items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]', entry.isCurrentUser && 'bg-primary/[0.08] ring-1 ring-primary/30')}
									style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
									aria-current={entry.isCurrentUser ? 'true' : undefined}
								>
									<span className={cn('w-7 shrink-0 text-center font-display text-lg font-extrabold italic tabular', entry.isCurrentUser ? 'text-primary' : 'text-muted-foreground')}>{entry.rank}</span>
									<PlayerAvatar entry={entry} className='h-9 w-9' />
									<div className='min-w-0 flex-1'>
										<p className={cn('truncate text-sm font-semibold', entry.isCurrentUser && 'text-primary')}>
											{entry.name}
											{entry.isCurrentUser && <span className='ml-1.5 text-[11px] font-medium uppercase tracking-wider'>You</span>}
										</p>
										<p className='text-xs text-muted-foreground tabular'>
											{entry.correctPicks}/{entry.totalPicks} picks · {entry.winRate}%
										</p>
									</div>
									<div className='text-right'>
										<p className='font-display text-2xl font-extrabold italic leading-none tabular'>{entry.totalPoints}</p>
										<p className='eyebrow mt-0.5 text-[9px]'>pts</p>
									</div>
								</li>
							))}
						</ol>
					</Card>
				</section>
			)}
		</PageContainer>
	);
}

function PlayerAvatar({ entry, className }: { entry: LeaderboardEntry; className?: string }) {
	return (
		<Avatar className={cn('ring-1 ring-white/10', className)}>
			{entry.image && <AvatarImage src={entry.image} alt={entry.name} className='object-cover' />}
			<AvatarFallback className='bg-primary/15 text-xs font-semibold text-primary'>{initials(entry.name)}</AvatarFallback>
		</Avatar>
	);
}

function PodiumSpot({ entry, delay }: { entry: LeaderboardEntry; delay: number }) {
	const first = entry.rank === 1;
	const height = first ? 'h-32 sm:h-36' : entry.rank === 2 ? 'h-24 sm:h-28' : 'h-[4.5rem] sm:h-20';
	return (
		<div className='flex min-w-0 animate-slide-up flex-col items-center' style={{ animationDelay: `${delay}ms` }}>
			<div className='relative mb-2'>
				{first && <Crown className='absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-[#FFD66B]' fill='currentColor' aria-hidden />}
				<PlayerAvatar entry={entry} className={cn('ring-2', RANK_RING[entry.rank], first ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-12 w-12 sm:h-14 sm:w-14')} />
			</div>
			<p className={cn('w-full truncate text-center text-xs font-semibold sm:text-sm', entry.isCurrentUser && 'text-primary')}>
				{entry.name}
				{entry.isCurrentUser && ' (You)'}
			</p>
			<p className='mb-2 font-display text-2xl font-extrabold italic leading-none tracking-tight tabular sm:text-3xl'>
				<CountUp end={entry.totalPoints} duration={0.6} />
				<span className='ml-1 text-[10px] font-semibold not-italic uppercase tracking-wider text-muted-foreground'>pts</span>
			</p>
			<div
				className={cn(
					'glass relative w-full overflow-hidden rounded-t-2xl rounded-b-md border-b-0 bg-gradient-to-b to-transparent',
					RANK_GLOW[entry.rank],
					height,
					entry.isCurrentUser && 'ring-1 ring-primary/40'
				)}
			>
				<span className={cn('absolute inset-x-0 top-2 text-center font-display text-4xl font-extrabold italic leading-none tabular sm:text-5xl', RANK_TEXT[entry.rank])}>{entry.rank}</span>
				<span className='absolute inset-x-0 bottom-2 text-center text-[10px] text-muted-foreground tabular'>{entry.winRate}% win</span>
			</div>
		</div>
	);
}
