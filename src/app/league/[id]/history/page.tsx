'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Award, Calendar, Crown, History, ListOrdered, Target, TrendingUp, Trophy, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageContainer, PageHeader, Pill, SectionHeader, StatTile } from '@/components/ui/page';
import { cn } from '@/lib/utils';

interface PlayerSeasonStats {
	userId: string;
	userName: string;
	userImage: string | null;
	rank: number;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
	weeksWon: number;
	winPercentage: number;
	weeklyStats: Array<{
		week: number;
		points: number;
		correctPicks: number;
		totalPicks: number;
		tfsPoints: number;
	}>;
}

interface SeasonHistory {
	leagueId: string;
	leagueName: string;
	leagueMode: string;
	seasonYear: number;
	standings: PlayerSeasonStats[];
	champions: Array<{
		userId: string;
		userName: string;
		totalPoints: number;
	}>;
	seasonStats: {
		totalWeeksPlayed: number;
		totalGamesPlayed: number;
		totalPicksMade: number;
		highestWeeklyScore?: {
			userId: string;
			userName: string;
			week: number;
			points: number;
		};
	};
	archivedAt: string;
}

interface League {
	name: string;
	sport: string;
	mode: string;
}

const RANK_COLORS: Record<number, string> = {
	1: 'text-[#FFD66B]',
	2: 'text-[#D5DCE6]',
	3: 'text-[#E7A16B]'
};

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

const seasonLabel = (year: number) => `${year}–${String(year + 1).slice(-2)}`;

function PlayerAvatar({ player, className }: { player: Pick<PlayerSeasonStats, 'userName' | 'userImage'>; className?: string }) {
	return (
		<Avatar className={cn('ring-1 ring-white/10', className)}>
			{player.userImage && <AvatarImage src={player.userImage} alt={player.userName} />}
			<AvatarFallback className='bg-primary/15 text-xs font-semibold text-primary'>{initials(player.userName)}</AvatarFallback>
		</Avatar>
	);
}

export default function LeagueHistoryPage() {
	const params = useParams();
	const leagueId = (params?.id as string) || '';
	const router = useRouter();
	const { data: session } = useSession();
	const [league, setLeague] = useState<League | null>(null);
	const [history, setHistory] = useState<SeasonHistory[]>([]);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch league details
	useEffect(() => {
		const fetchLeague = async () => {
			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const data: League = await response.json();
					setLeague(data);
				} else {
					router.replace('/dashboard');
				}
			} catch {
				router.replace('/dashboard');
			}
		};

		if (leagueId) {
			fetchLeague();
		}
	}, [leagueId, router]);

	// Fetch league history
	useEffect(() => {
		const fetchHistory = async () => {
			if (!leagueId) return;

			try {
				setLoading(true);
				const response = await fetch(`/api/league/history?leagueId=${leagueId}`);
				if (response.ok) {
					const data: SeasonHistory[] = await response.json();
					setHistory(data);
					if (data.length > 0) {
						setSelectedYear(data[0].seasonYear); // Most recent season by default
					}
				} else {
					const errorData: { error?: string } = await response.json().catch(() => ({}));
					setError(errorData.error || 'Failed to fetch history');
				}
			} catch (err) {
				setError('Failed to fetch league history');
				console.error('Error fetching history:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [leagueId]);

	const selectedSeason = history.find(s => s.seasonYear === selectedYear) ?? null;
	const currentUserId = session?.user?.id;
	const backToLeague = () => router.push(`/league/${leagueId}`);

	const header = (
		<PageHeader
			eyebrow={
				<>
					<History className='h-3.5 w-3.5 text-primary' /> Season archive
				</>
			}
			title={
				<span className='flex items-center gap-3 sm:gap-4'>
					<span className='relative hidden h-14 w-12 shrink-0 sm:block'>
						<Image src='/pick-5-logo-sm.webp' alt='' fill sizes='48px' className='object-contain' priority />
					</span>
					<span className='min-w-0 break-words'>{league?.name || 'League History'}</span>
				</span>
			}
			description='Champions, final standings and season stats from past seasons.'
			actions={
				<Button variant='outline' onClick={backToLeague}>
					<ArrowLeft /> Back to League
				</Button>
			}
		/>
	);

	if (loading) {
		return (
			<PageContainer>
				{header}
				<div className='space-y-6'>
					<Skeleton className='h-10 w-64 rounded-full' />
					<Skeleton className='h-40 w-full rounded-3xl' />
					<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className='h-28 rounded-2xl' />
						))}
					</div>
					<Skeleton className='h-80 w-full rounded-2xl' />
				</div>
			</PageContainer>
		);
	}

	if (error) {
		return (
			<PageContainer>
				{header}
				<EmptyState icon={History} title='Couldn’t load history' description={error} action={<Button onClick={() => router.back()}>Go Back</Button>} />
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			{header}

			{history.length === 0 || !selectedSeason ? (
				<EmptyState
					icon={Calendar}
					title='No season history yet'
					description='Season history will appear here after the first season is completed and archived.'
					action={<Button onClick={backToLeague}>Back to League</Button>}
				/>
			) : (
				<div className='space-y-8'>
					{/* Season selector */}
					<div className='-mx-4 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:px-0'>
						<div role='tablist' aria-label='Season' className='inline-flex gap-2'>
							{history.map(season => {
								const active = season.seasonYear === selectedSeason.seasonYear;
								return (
									<button
										key={season.seasonYear}
										type='button'
										role='tab'
										aria-selected={active}
										onClick={() => setSelectedYear(season.seasonYear)}
										className={cn(
											'flex shrink-0 flex-col items-start rounded-xl border px-4 py-2.5 text-left transition-colors',
											active ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'
										)}
									>
										<span className={cn('font-display text-lg font-bold italic tabular leading-none', active ? 'text-primary' : 'text-foreground')}>
											{seasonLabel(season.seasonYear)}
										</span>
										<span className='mt-1 max-w-[10rem] truncate text-[11px] text-muted-foreground'>
											<Crown className='mr-1 inline h-3 w-3 text-[#FFD66B]' />
											{season.champions[0]?.userName || 'TBD'}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Champion hero */}
					<ChampionHero season={selectedSeason} />

					{/* Season stats */}
					<section>
						<SectionHeader title='Season Stats' icon={TrendingUp} />
						<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
							<StatTile label='Weeks played' value={selectedSeason.seasonStats.totalWeeksPlayed} icon={Calendar} />
							<StatTile label='Players' value={selectedSeason.standings.length} icon={Users} tone='accent' />
							<StatTile label='Total picks' value={selectedSeason.seasonStats.totalPicksMade} icon={Target} tone='muted' />
							{selectedSeason.seasonStats.highestWeeklyScore ? (
								<StatTile
									label='Best week'
									value={selectedSeason.seasonStats.highestWeeklyScore.points}
									icon={Award}
									tone='warning'
									sub={
										<span className='block truncate'>
											{selectedSeason.seasonStats.highestWeeklyScore.userName} · Wk {selectedSeason.seasonStats.highestWeeklyScore.week}
										</span>
									}
								/>
							) : (
								<StatTile label='Best week' value='—' icon={Award} tone='muted' />
							)}
						</div>
					</section>

					{/* Standings */}
					<section>
						<SectionHeader title='Final Standings' icon={ListOrdered} />
						<Tabs defaultValue='standings'>
							<TabsList className='mb-4'>
								<TabsTrigger value='standings'>Standings</TabsTrigger>
								<TabsTrigger value='details'>Player Details</TabsTrigger>
							</TabsList>

							<TabsContent value='standings'>
								<Card className='p-2 sm:p-3'>
									<div className='hidden items-center gap-3 px-3 pb-2 pt-1 sm:flex'>
										<span className='eyebrow w-8 text-center'>#</span>
										<span className='eyebrow flex-1'>Player</span>
										<span className='eyebrow w-20 text-right'>Record</span>
										<span className='eyebrow w-16 text-right'>Wk wins</span>
										<span className='eyebrow w-16 text-right'>Pts</span>
									</div>
									<ol className='space-y-1'>
										{selectedSeason.standings.map((player, index) => {
											const isYou = player.userId === currentUserId;
											return (
												<li
													key={player.userId}
													className={cn(
														'flex animate-slide-up items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]',
														isYou && 'bg-primary/[0.08] ring-1 ring-primary/30'
													)}
													style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
												>
													<span className={cn('w-8 text-center font-display text-xl font-extrabold italic tabular', RANK_COLORS[player.rank] ?? 'text-muted-foreground')}>
														{player.rank}
													</span>
													<PlayerAvatar player={player} className='h-9 w-9' />
													<div className='min-w-0 flex-1'>
														<p className={cn('truncate font-semibold', isYou && 'text-primary')}>
															{player.userName}
															{isYou && <span className='ml-1.5 text-xs font-medium text-muted-foreground'>(You)</span>}
														</p>
														<p className='text-xs text-muted-foreground tabular sm:hidden'>
															{player.correctPicks}/{player.totalPicks} · {player.winPercentage}% · {player.weeksWon} wk {player.weeksWon === 1 ? 'win' : 'wins'}
														</p>
													</div>
													<span className='hidden w-20 text-right text-sm tabular text-muted-foreground sm:block'>
														{player.correctPicks}/{player.totalPicks}
														<span className='block text-[11px]'>{player.winPercentage}%</span>
													</span>
													<span className='hidden w-16 text-right text-sm font-semibold tabular sm:block'>{player.weeksWon}</span>
													<span className='w-16 text-right font-display text-2xl font-extrabold italic tabular leading-none'>{player.totalPoints}</span>
												</li>
											);
										})}
									</ol>
								</Card>
							</TabsContent>

							<TabsContent value='details'>
								<div className='grid gap-3 sm:grid-cols-2'>
									{selectedSeason.standings.map(player => {
										const isYou = player.userId === currentUserId;
										return (
											<Card key={player.userId} className={cn('p-4', isYou && 'ring-1 ring-primary/30')}>
												<div className='mb-4 flex items-center gap-3'>
													<PlayerAvatar player={player} />
													<div className='min-w-0 flex-1'>
														<p className={cn('truncate font-semibold', isYou && 'text-primary')}>{player.userName}</p>
														<p className={cn('text-xs font-semibold tabular', RANK_COLORS[player.rank] ?? 'text-muted-foreground')}>Rank #{player.rank}</p>
													</div>
													<p className='font-display text-3xl font-extrabold italic tabular leading-none'>
														{player.totalPoints}
														<span className='ml-1 text-xs font-semibold not-italic text-muted-foreground'>pts</span>
													</p>
												</div>
												<div className='grid grid-cols-4 gap-2 text-center'>
													<MiniStat label='Picks' value={`${player.correctPicks}/${player.totalPicks}`} />
													<MiniStat label='Win %' value={`${player.winPercentage}%`} />
													<MiniStat label='Wk wins' value={player.weeksWon} />
													<MiniStat label='TFS' value={player.tfsPoints} />
												</div>
											</Card>
										);
									})}
								</div>
							</TabsContent>
						</Tabs>
					</section>
				</div>
			)}
		</PageContainer>
	);
}

function ChampionHero({ season }: { season: SeasonHistory }) {
	const champion = season.champions[0];
	const championStats = champion ? season.standings.find(p => p.userId === champion.userId) : undefined;
	const coChamps = season.champions.length > 1;

	return (
		<section className='gradient-border glass relative animate-scale-in overflow-hidden rounded-3xl'>
			<div aria-hidden className='pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#FFD66B]/20 blur-3xl' />
			<div aria-hidden className='pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl' />
			<Trophy aria-hidden className='pointer-events-none absolute -bottom-6 -right-4 h-40 w-40 rotate-12 text-[#FFD66B]/[0.07] sm:h-56 sm:w-56' />

			<div className='relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8'>
				<div className='relative shrink-0 self-start sm:self-center'>
					<div className='absolute inset-0 rounded-2xl bg-[#FFD66B]/30 blur-xl' />
					<div className='relative grid h-20 w-20 place-items-center rounded-2xl border border-[#FFD66B]/40 bg-[#FFD66B]/10 text-[#FFD66B] sm:h-24 sm:w-24'>
						<Trophy className='h-10 w-10 sm:h-12 sm:w-12' />
					</div>
				</div>

				<div className='min-w-0 flex-1'>
					<div className='mb-2 flex flex-wrap items-center gap-2'>
						<p className='eyebrow text-[#FFD66B]'>{coChamps ? 'Season co-champions' : 'Season champion'}</p>
						<Pill tone='muted'>{seasonLabel(season.seasonYear)}</Pill>
						{season.leagueMode && <Pill tone={season.leagueMode === 'steve' ? 'accent' : 'primary'}>{season.leagueMode === 'steve' ? 'Steve' : 'Standard'}</Pill>}
					</div>
					<h2 className='display-heading break-words text-4xl sm:text-6xl'>
						<span className='chrome-text'>{season.champions.map(c => c.userName).join(' & ') || 'TBD'}</span>
					</h2>
					{championStats && (
						<p className='mt-3 text-sm text-muted-foreground tabular'>
							{championStats.correctPicks}/{championStats.totalPicks} picks · {championStats.winPercentage}% · {championStats.weeksWon} weekly{' '}
							{championStats.weeksWon === 1 ? 'win' : 'wins'}
						</p>
					)}
				</div>

				{champion && (
					<div className='shrink-0 sm:text-right'>
						<p className='font-display text-6xl font-extrabold italic tabular leading-none text-[#FFD66B] sm:text-7xl'>{champion.totalPoints}</p>
						<p className='eyebrow mt-1'>Points</p>
					</div>
				)}
			</div>
		</section>
	);
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className='rounded-xl border border-white/[0.07] bg-white/[0.03] px-1 py-2'>
			<p className='font-display text-lg font-bold italic tabular leading-none'>{value}</p>
			<p className='mt-1 text-[10px] uppercase tracking-wider text-muted-foreground'>{label}</p>
		</div>
	);
}
