'use client';

import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import { useSession } from 'next-auth/react';
import { Crown, Swords, Trophy, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Pill } from '@/components/ui/page';
import { TeamLogo } from '@/components/ui/team-logo';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { NFLService } from '@/services/nflService';
import { cn } from '@/lib/utils';
import { UserPicksModal } from './UserPicksModal';
import { MatchupsBoard } from '@/components/league/MatchupsBoard';
import { BadgeStrip } from '@/components/badges/BadgeStrip';
import type { Badge, LeagueBadgesResponse, Streak } from '@/lib/badges';

interface PickedTeam {
	team: string;
	abbreviation: string;
	logo: string;
	gameStatus: 'scheduled' | 'in_progress' | 'final';
	isCorrect: boolean | null;
}

interface WeeklyResult {
	userId: string;
	player: string;
	image: string | null;
	points: number;
	correct: number;
	tfsPoints: number;
	hasPicks: boolean;
	pickedTeams?: PickedTeam[];
}

interface SeasonStat {
	userId?: string;
	player: string;
	image: string | null;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	weeksWon?: number;
}

interface LeaderboardResponse {
	weeklyResults: WeeklyResult[];
	seasonStats: SeasonStat[] | Record<string, SeasonStat>;
}

/** Normalized row used by both the weekly and season boards. */
interface BoardEntry {
	id: string;
	userId?: string;
	player: string;
	image: string | null;
	points: number;
	rank: number;
	clickable: boolean;
	streak?: Streak;
}

/** 🔥 / 🧊 with the run length, next to a name. */
function StreakMark({ streak }: { streak?: Streak }) {
	if (!streak) return null;
	const hot = streak.kind === 'hot';
	const label = hot ? `On fire: ${streak.length} correct picks in a row` : `Ice cold: ${streak.length} misses in a row`;
	return (
		<span className={cn('inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold tabular', hot ? 'text-accent-2' : 'text-primary')} title={label} aria-label={label}>
			<span aria-hidden>{hot ? '🔥' : '🧊'}</span>
			{streak.length}
		</span>
	);
}

const MEDALS = {
	1: { text: 'text-[#FFD66B]', ring: 'ring-[#FFD66B]', bg: 'from-[#FFD66B]/25', glow: 'shadow-[0_0_32px_-6px_rgba(255,214,107,0.6)]' },
	2: { text: 'text-[#D5DCE6]', ring: 'ring-[#D5DCE6]', bg: 'from-[#D5DCE6]/20', glow: 'shadow-[0_0_24px_-8px_rgba(213,220,230,0.5)]' },
	3: { text: 'text-[#E7A16B]', ring: 'ring-[#E7A16B]', bg: 'from-[#E7A16B]/20', glow: 'shadow-[0_0_24px_-8px_rgba(231,161,107,0.5)]' }
} as const;

const medal = (rank: number) => (rank >= 1 && rank <= 3 ? MEDALS[rank as 1 | 2 | 3] : null);

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

/** Competition ranking ("1, 1, 3") over a list already sorted by score descending. */
function withRanks<T>(sorted: T[], score: (item: T) => number): Array<T & { rank: number }> {
	let rank = 1;
	return sorted.map((item, i) => {
		if (i > 0 && score(item) < score(sorted[i - 1])) rank = i + 1;
		return { ...item, rank };
	});
}

const getTimeAgo = (date: Date | null) => {
	if (!date) return '';
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	return `${Math.floor(minutes / 60)}h ago`;
};

function PlayerAvatar({ name, image, className, ringClass }: { name: string; image: string | null; className?: string; ringClass?: string }) {
	return (
		<Avatar className={cn('h-10 w-10 ring-1 ring-white/10', ringClass, className)}>
			<AvatarImage src={image || undefined} alt={name} />
			<AvatarFallback className='bg-primary/15 text-xs font-bold text-primary'>{initials(name)}</AvatarFallback>
		</Avatar>
	);
}

/** Top-3 podium: 2nd · 1st · 3rd, with the leader raised. */
function Podium({
	entries,
	sub,
	currentUserId,
	onSelect,
	badgesByUser
}: {
	entries: BoardEntry[];
	sub: (entry: BoardEntry) => React.ReactNode;
	currentUserId?: string;
	onSelect: (entry: BoardEntry) => void;
	badgesByUser?: Map<string, Badge[]>;
}) {
	const order = [entries[1], entries[0], entries[2]];
	const heights = ['h-14', 'h-20', 'h-10'];

	return (
		<div className='relative mb-4 grid grid-cols-3 items-end gap-2 sm:gap-3'>
			{/* Stadium-light glow behind the leader */}
			<div aria-hidden className='pointer-events-none absolute left-1/2 top-0 h-28 w-40 -translate-x-1/2 rounded-full bg-[#FFD66B]/10 blur-3xl' />
			{order.map((entry, col) => {
				const m = medal(entry.rank) ?? MEDALS[3];
				const isLeader = col === 1;
				const isMe = !!currentUserId && entry.userId === currentUserId;
				const Tag = entry.clickable ? 'button' : 'div';
				return (
					<Tag
						key={entry.id}
						{...(entry.clickable ? { type: 'button' as const, onClick: () => onSelect(entry) } : {})}
						className={cn('group relative flex min-w-0 flex-col items-center animate-slide-up', entry.clickable && 'cursor-pointer')}
						style={{ animationDelay: `${[120, 0, 200][col]}ms` }}
					>
						<div className='relative'>
							{isLeader && entry.points > 0 && <Crown className='absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-[#FFD66B] drop-shadow-[0_0_8px_rgba(255,214,107,0.7)]' fill='currentColor' />}
							<PlayerAvatar
								name={entry.player}
								image={entry.image}
								className={cn('transition-transform duration-300 ease-out-expo', isLeader ? 'h-16 w-16' : 'h-12 w-12', entry.clickable && 'group-hover:scale-105')}
								ringClass={cn('ring-2 ring-offset-2 ring-offset-[hsl(var(--surface))]', m.ring, m.glow)}
							/>
							<span className={cn('absolute -bottom-1.5 left-1/2 grid h-5 min-w-5 -translate-x-1/2 place-items-center rounded-full bg-background px-1 font-display text-[11px] font-extrabold italic tabular ring-1 ring-white/10', m.text)}>{entry.rank}</span>
						</div>
						<p className={cn('mt-3 flex w-full items-center justify-center gap-1 text-center text-xs font-semibold sm:text-sm', isMe ? 'text-primary' : 'text-foreground')}>
							<span className='truncate'>{entry.player}</span>
							<StreakMark streak={entry.streak} />
						</p>
						{entry.userId && badgesByUser?.get(entry.userId)?.some(b => b.earned) && (
							<span className='mb-0.5 mt-0.5'>
								<BadgeStrip badges={badgesByUser.get(entry.userId)} />
							</span>
						)}
						<p className={cn('font-display font-extrabold italic leading-none tabular tracking-tight', isLeader ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl', m.text)}>
							<CountUp end={entry.points} duration={0.8} preserveValue />
						</p>
						<div className='mt-0.5 h-4 text-[10px] font-medium text-muted-foreground tabular'>{sub(entry)}</div>
						{/* Pedestal */}
						<div className={cn('mt-2 w-full rounded-t-xl border border-b-0 border-white/[0.07] bg-gradient-to-b to-transparent', m.bg, heights[col], isMe && 'border-primary/40')} />
					</Tag>
				);
			})}
		</div>
	);
}

function RankBadge({ rank }: { rank: number }) {
	const m = medal(rank);
	return <span className={cn('w-6 shrink-0 text-center font-display text-lg font-extrabold italic tabular', m ? m.text : 'text-muted-foreground')}>{rank}</span>;
}

function Row({
	entry,
	index,
	isMe,
	onSelect,
	children,
	right,
	badges
}: {
	entry: BoardEntry;
	index: number;
	isMe: boolean;
	onSelect: (entry: BoardEntry) => void;
	children: React.ReactNode;
	right: React.ReactNode;
	badges?: Badge[];
}) {
	const Tag = entry.clickable ? 'button' : 'div';
	return (
		<Tag
			{...(entry.clickable ? { type: 'button' as const, onClick: () => onSelect(entry) } : {})}
			className={cn(
				'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 animate-slide-up',
				entry.clickable && 'cursor-pointer hover:bg-white/[0.04]',
				isMe && 'bg-primary/[0.08] ring-1 ring-primary/30'
			)}
			style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
		>
			<RankBadge rank={entry.rank} />
			<PlayerAvatar name={entry.player} image={entry.image} className='h-9 w-9' ringClass={medal(entry.rank)?.ring} />
			<div className='min-w-0 flex-1'>
				<p className='flex items-center gap-1.5 truncate text-sm font-semibold'>
					<span className='truncate'>{entry.player}</span>
					<StreakMark streak={entry.streak} />
					{isMe && <span className='shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary'>You</span>}
					<BadgeStrip badges={badges} />
				</p>
				<div className='mt-0.5'>{children}</div>
			</div>
			<div className='shrink-0 text-right'>{right}</div>
		</Tag>
	);
}

function PickedTeamStrip({ teams }: { teams: PickedTeam[] }) {
	const visible = teams.filter(t => t.gameStatus !== 'scheduled'); // Only show live or finished games
	if (visible.length === 0) return <span className='text-[11px] text-muted-foreground'>Waiting on kickoff</span>;
	return (
		<div className='flex flex-wrap items-center gap-1'>
			{visible.map((t, idx) => {
				const tone =
					t.gameStatus === 'in_progress' ? 'ring-live/70' : t.isCorrect === true ? 'ring-accent/80' : t.isCorrect === false ? 'ring-accent-2/70 opacity-50 grayscale-[40%]' : 'ring-white/15';
				return <TeamLogo key={`${t.team}-${idx}`} src={t.logo} alt={t.abbreviation} size={22} className={cn('ring-[1.5px]', tone)} />;
			})}
		</div>
	);
}

function BoardSkeleton() {
	return (
		<div>
			<div className='mb-5 grid grid-cols-3 items-end gap-3'>
				{['h-28', 'h-36', 'h-24'].map((h, i) => (
					<div key={i} className='flex flex-col items-center gap-2'>
						<Skeleton className={cn('rounded-full', i === 1 ? 'h-16 w-16' : 'h-12 w-12')} />
						<Skeleton className='h-3 w-14' />
						<Skeleton className={cn('w-full rounded-b-none rounded-t-xl', h === 'h-36' ? 'h-24' : h === 'h-28' ? 'h-16' : 'h-12')} />
					</div>
				))}
			</div>
			<div className='space-y-2'>
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className='flex items-center gap-3 px-3 py-2'>
						<Skeleton className='h-5 w-5' />
						<Skeleton className='h-9 w-9 rounded-full' />
						<div className='flex-1 space-y-1.5'>
							<Skeleton className='h-3.5 w-28' />
							<Skeleton className='h-3 w-16' />
						</div>
						<Skeleton className='h-6 w-10' />
					</div>
				))}
			</div>
		</div>
	);
}

export function Leaderboard() {
	const { currentWeek, season, isPastSeason } = useWeek();
	const { leagueId } = useLeague();
	const { data: session } = useSession();
	const currentUserId = session?.user?.id;

	const [weeklyResults, setWeeklyResults] = useState<WeeklyResult[]>([]);
	const [seasonStats, setSeasonStats] = useState<SeasonStat[]>([]);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [tab, setTab] = useState('season');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [leagueMode, setLeagueMode] = useState<string>('');
	const [gamesStarted, setGamesStarted] = useState<boolean>(false);
	const [badgesByUser, setBadgesByUser] = useState<Map<string, Badge[]>>(new Map());
	const [streaks, setStreaks] = useState<Record<string, Streak>>({});
	const [punishment, setPunishment] = useState('');

	// Season badges for the row icons (only finished games count, so no polling needed)
	useEffect(() => {
		if (!leagueId) return;
		let cancelled = false;
		const loadBadges = () =>
			fetch(`/api/league/${leagueId}/badges?season=${season}`)
				.then(res => (res.ok ? (res.json() as Promise<LeagueBadgesResponse>) : null))
				.then(data => {
					if (!cancelled && data) {
						setBadgesByUser(new Map(data.members.map(m => [m.userId, m.badges])));
						setStreaks(data.streaks ?? {});
					}
				})
				.catch(err => console.error('[Leaderboard] Error fetching badges:', err));
		loadBadges();
		window.addEventListener('refreshLeaderboard', loadBadges);
		return () => {
			cancelled = true;
			window.removeEventListener('refreshLeaderboard', loadBadges);
		};
	}, [leagueId, season]);

	// Fetch league details to get the mode
	useEffect(() => {
		const fetchLeagueDetails = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const data = await response.json();
					setLeagueMode(data.mode || 'standard');
					setPunishment(data.settings?.lastPlacePunishment ?? '');
				}
			} catch (error) {
				console.error('[Leaderboard] Error fetching league details:', error);
			}
		};
		fetchLeagueDetails();
	}, [leagueId]);

	// Fetch leaderboard data
	const fetchLeaderboard = async (isPolling = false) => {
		if (!leagueId) {
			setError('League ID is missing');
			setLoading(false);
			return;
		}
		try {
			if (isPolling) {
				setIsUpdating(true);
			} else {
				setLoading(true);
			}
			setError(null);

			const [response, games] = await Promise.all([fetch(`/api/leaderboard?week=${currentWeek}&leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }), NFLService.getWeeklyGames(currentWeek, season)]);
			if (!response.ok) throw new Error('Failed to fetch leaderboard data');

			const data: LeaderboardResponse = await response.json();
			setWeeklyResults(data.weeklyResults || []);
			setSeasonStats(Array.isArray(data.seasonStats) ? data.seasonStats : Object.values(data.seasonStats || {}));
			setLastUpdated(new Date());

			// Check if any games have started this week
			const hasStarted = games.some(game => {
				const status = game.status?.toLowerCase() || 'scheduled';
				return status === 'in' || status === 'in_progress' || status === 'post' || status === 'final';
			});
			setGamesStarted(hasStarted);
		} catch (err) {
			console.error('Failed to load leaderboard data:', err);
			setError('Failed to load leaderboard data.');
		} finally {
			setLoading(false);
			setIsUpdating(false);
		}
	};

	useEffect(() => {
		fetchLeaderboard(false); // Initial load

		const handleRefresh = () => fetchLeaderboard(true);
		window.addEventListener('refreshLeaderboard', handleRefresh);

		// Use smart polling interval (2 min during games, 5 min outside); past seasons are final
		const pollInterval = isPastSeason ? undefined : setInterval(() => fetchLeaderboard(true), NFLService.getPollingInterval());

		return () => {
			window.removeEventListener('refreshLeaderboard', handleRefresh);
			clearInterval(pollInterval);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeek, leagueId, season]);

	// Weekly board: points desc, then players with picks first
	const weeklySorted = withRanks(
		[...weeklyResults].sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			return Number(b.hasPicks) - Number(a.hasPicks);
		}),
		r => r.points
	);
	const weeklyById = new Map(weeklyResults.map(r => [r.userId, r]));
	const weeklyEntries: BoardEntry[] = weeklySorted.map(r => ({
		id: r.userId,
		userId: r.userId,
		player: r.player,
		image: r.image,
		points: r.points,
		rank: r.rank,
		clickable: r.hasPicks,
		streak: streaks[r.userId]
	}));

	// Season board. Season stats carry a userId (used for the "you" highlight and the picks modal);
	// older responses without it are in the same user order as weeklyResults.
	const seasonAligned = seasonStats.length === weeklyResults.length;
	const seasonSorted = withRanks(
		seasonStats
			.map((stats, i) => ({
				...stats,
				userId: stats.userId || (seasonAligned ? weeklyResults[i]?.userId : undefined),
				player: stats.player || `User ${String(i + 1).padStart(4, '0')}`,
				winPercentage: stats.winPercentage ? Math.round(stats.winPercentage) : 0
			}))
			.sort((a, b) => b.totalPoints - a.totalPoints),
		s => s.totalPoints
	);
	const seasonEntryId = (s: (typeof seasonSorted)[number], i: number) => s.userId || `season-${i}`;
	const seasonById = new Map(seasonSorted.map((s, i) => [seasonEntryId(s, i), s]));
	const seasonEntries: BoardEntry[] = seasonSorted.map((s, i) => ({
		id: seasonEntryId(s, i),
		userId: s.userId,
		player: s.player,
		image: s.image,
		points: s.totalPoints,
		rank: s.rank,
		clickable: !!s.userId && !!weeklyById.get(s.userId)?.hasPicks,
		streak: s.userId ? streaks[s.userId] : undefined
	}));

	const handleSelect = (entry: BoardEntry) => {
		if (entry.clickable && entry.userId) setSelectedUserId(entry.userId);
	};

	const selectedWeekly = selectedUserId ? weeklyById.get(selectedUserId) : undefined;
	const isMe = (entry: BoardEntry) => !!currentUserId && entry.userId === currentUserId;

	const weeklySub = (entry: BoardEntry) => {
		const r = entry.userId ? weeklyById.get(entry.userId) : undefined;
		if (!r) return null;
		return leagueMode === 'steve' ? `${r.correct}/5 · ${r.tfsPoints} TFS` : `${r.correct}/5 correct`;
	};
	const seasonSub = (entry: BoardEntry) => {
		const s = seasonById.get(entry.id);
		return s ? `${s.correctPicks}-${s.totalPicks - s.correctPicks} · ${s.winPercentage}%` : null;
	};

	const renderBoard = (entries: BoardEntry[], kind: 'weekly' | 'season') => {
		if (entries.length === 0) {
			return (
				<div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center'>
					<span className='grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary'>
						<Users className='h-5 w-5' />
					</span>
					<p className='text-sm text-muted-foreground'>No players in this league yet.</p>
				</div>
			);
		}

		const showPodium = entries.length >= 3 && entries[0].points > 0;
		const rest = showPodium ? entries.slice(3) : entries;
		const sub = kind === 'weekly' ? weeklySub : seasonSub;

		return (
			<div>
				{showPodium && <Podium entries={entries} sub={sub} currentUserId={currentUserId} onSelect={handleSelect} badgesByUser={badgesByUser} />}
				{rest.length > 0 && (
					<div className='-mx-1 space-y-1'>
						{rest.map((entry, i) => {
							if (kind === 'weekly') {
								const r = entry.userId ? weeklyById.get(entry.userId) : undefined;
								return (
									<Row
										key={entry.id}
										entry={entry}
										index={i}
										isMe={isMe(entry)}
										onSelect={handleSelect}
										badges={entry.userId ? badgesByUser.get(entry.userId) : undefined}
										right={
											<div className='flex items-baseline gap-3'>
												{leagueMode === 'steve' && (
													<span className='text-right'>
														<span className='block font-display text-lg font-bold italic leading-none text-accent tabular'>{r?.tfsPoints ?? 0}</span>
														<span className='text-[9px] font-semibold uppercase tracking-wider text-muted-foreground'>TFS</span>
													</span>
												)}
												<span className='text-right'>
													<span className='block font-display text-2xl font-extrabold italic leading-none tabular'>
														<CountUp end={entry.points} duration={0.8} preserveValue />
													</span>
													<span className='text-[9px] font-semibold uppercase tracking-wider text-muted-foreground'>Pts</span>
												</span>
											</div>
										}
									>
										{r?.hasPicks && r.pickedTeams && r.pickedTeams.length > 0 && gamesStarted ? (
											<PickedTeamStrip teams={r.pickedTeams} />
										) : (
											<Pill tone={r?.hasPicks ? 'accent' : 'warning'} className='px-2 py-0 text-[9px]'>
												{r?.hasPicks ? 'Picks in' : 'Needs pick'}
											</Pill>
										)}
									</Row>
								);
							}
							const s = seasonById.get(entry.id);
							return (
								<Row
									key={entry.id}
									entry={entry}
									index={i}
									isMe={isMe(entry)}
									onSelect={handleSelect}
									badges={entry.userId ? badgesByUser.get(entry.userId) : undefined}
									right={
										<span>
											<span className='block font-display text-2xl font-extrabold italic leading-none tabular'>
												<CountUp end={entry.points} duration={0.8} preserveValue />
											</span>
											<span className='text-[9px] font-semibold uppercase tracking-wider text-muted-foreground'>Pts</span>
										</span>
									}
								>
									{s && (
										<p className='flex items-center gap-2 text-[11px] text-muted-foreground tabular'>
											<span>
												{s.correctPicks}-{s.totalPicks - s.correctPicks}
											</span>
											<span className='text-muted-foreground/40'>·</span>
											<span className={cn(s.winPercentage >= 50 ? 'text-accent' : 'text-muted-foreground')}>{s.winPercentage}%</span>
											{!!s.weeksWon && (
												<>
													<span className='text-muted-foreground/40'>·</span>
													<span className='inline-flex items-center gap-0.5 text-[#FFD66B]'>
														<Trophy className='h-3 w-3' />
														{s.weeksWon}
													</span>
												</>
											)}
										</p>
									)}
								</Row>
							);
						})}
					</div>
				)}
			</div>
		);
	};

	return (
		<Card className='overflow-hidden p-4 sm:p-5'>
			<div className='mb-4 flex items-start justify-between gap-3'>
				<div className='min-w-0'>
					<p className='eyebrow'>Standings</p>
					<h2 className='mt-1 font-display text-2xl font-bold uppercase italic leading-none tracking-tight'>Leaderboard</h2>
				</div>
				<div className='flex shrink-0 items-center gap-1.5 pt-1 text-[11px] font-medium text-muted-foreground'>
					{isUpdating ? (
						<>
							<span className='h-1.5 w-1.5 animate-pulse rounded-full bg-primary' />
							<span className='text-primary'>Updating…</span>
						</>
					) : (
						lastUpdated && (
							<>
								<span className='h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]' />
								<span>Live · {getTimeAgo(lastUpdated)}</span>
							</>
						)
					)}
				</div>
			</div>

			{loading ? (
				<BoardSkeleton />
			) : error ? (
				<p className='rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive'>{error}</p>
			) : (
				<Tabs value={tab} onValueChange={setTab}>
					<TabsList className='mb-6 grid w-full grid-cols-3'>
						<TabsTrigger value='weekly' className='px-2'>
							Week {currentWeek}
						</TabsTrigger>
						<TabsTrigger value='season' className='px-2'>
							{isPastSeason ? season : 'Season'}
						</TabsTrigger>
						<TabsTrigger value='matchups' className='px-2'>
							<Swords aria-hidden />
							H2H
						</TabsTrigger>
					</TabsList>
					<TabsContent value='weekly' className='mt-0'>
						{renderBoard(weeklyEntries, 'weekly')}
					</TabsContent>
					<TabsContent value='season' className='mt-0'>
						{renderBoard(seasonEntries, 'season')}
						{punishment && seasonEntries.length > 1 && (
							<div className='mt-3 flex items-start gap-2.5 rounded-xl border border-accent-2/25 bg-accent-2/[0.07] px-3 py-2.5'>
								<span className='text-lg leading-none' aria-hidden>
									🥄
								</span>
								<p className='min-w-0 text-xs text-muted-foreground'>
									<span className='font-semibold text-foreground'>Last place punishment</span>
									{seasonEntries.at(-1)!.points < seasonEntries[0].points && <> (currently {seasonEntries.at(-1)!.player})</>}: <span className='text-foreground/90'>{punishment}</span>
								</p>
							</div>
						)}
					</TabsContent>
					<TabsContent value='matchups' className='mt-0'>
						{leagueId && <MatchupsBoard leagueId={leagueId} week={currentWeek} season={season} currentUserId={currentUserId} badgesByUser={badgesByUser} />}
					</TabsContent>
				</Tabs>
			)}

			{selectedUserId && leagueId && (
				<UserPicksModal
					userId={selectedUserId}
					playerName={selectedWeekly?.player || 'Unknown'}
					playerImage={selectedWeekly?.image ?? null}
					weekPoints={selectedWeekly?.points}
					week={currentWeek}
					leagueId={leagueId}
					onClose={() => setSelectedUserId(null)}
				/>
			)}
		</Card>
	);
}
