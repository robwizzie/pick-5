'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Award, BarChart3, Calendar, ChevronRight, Crosshair, Crown, Flame, History, Medal, Rocket, Shield, Sparkles, Star, Target, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageContainer, PageHeader, Pill, SectionHeader, StatTile } from '@/components/ui/page';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BadgeCard } from '@/components/badges/BadgeCard';
import type { UserBadge, UserBadgesResponse } from '@/lib/badges';
import { useWeek } from '@/contexts/WeekContext';

const seasonLabel = (year: number) => `${year}–${String(year + 1).slice(-2)}`;

interface LeagueStats {
	leagueId: string;
	leagueName: string;
	leagueMode: string;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	weeksPlayed: number;
	bestWeekPoints: number;
	currentStreak: number;
	bestStreak: number;
	weeksWon: number;
}

interface AllTimeStats {
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
	winPercentage: number;
	totalLeagues: number;
	totalWeeksPlayed: number;
	avgPointsPerWeek: number;
	bestWeekPoints: number;
	bestWeekNumber: number;
	perfectWeeks: number;
	currentStreak: number;
	bestStreak: number;
	totalWins: number;
	totalLosses: number;
}

interface PickData {
	week: number;
	picks: Array<{
		gameId: string;
		isCorrect?: boolean | null;
	}>;
	correctPicks?: number;
	weeklyPoints?: number;
	tfsPoints?: number;
}

interface LeagueData {
	_id: string;
	name: string;
	mode?: string;
}

interface WeeklyStat {
	weeklyPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

interface SeasonStatsResponse {
	weeksWon?: number;
	weeklyStats?: Record<string, WeeklyStat>;
}

/** One finished week in one league, used for streak + perfect-week math. */
interface WeekData {
	week: number;
	leagueId: string;
	correctPicks: number;
	totalPicks: number;
	weeklyPoints: number;
	isPerfectWeek: boolean;
	allGamesFinished: boolean;
}

/** Points per week summed across leagues (from the recalculated season stats). */
interface WeekTotal {
	week: number;
	points: number;
	correct: number;
	total: number;
}

interface Achievement {
	icon: LucideIcon;
	label: string;
	value: string;
	tone: 'gold' | 'primary' | 'accent' | 'hot' | 'warning' | 'violet';
	description: string;
}

const ACHIEVEMENT_TONES: Record<Achievement['tone'], string> = {
	gold: 'text-[#FFD66B] bg-[#FFD66B]/10',
	primary: 'text-primary bg-primary/10',
	accent: 'text-accent bg-accent/10',
	hot: 'text-accent-2 bg-accent-2/10',
	warning: 'text-warning bg-warning/10',
	violet: 'text-chart-5 bg-chart-5/10'
};

const isFinished = (p: { isCorrect?: boolean | null }) => p.isCorrect !== undefined && p.isCorrect !== null;

const StatsPage = () => {
	const router = useRouter();
	const { status } = useSession();
	const [loading, setLoading] = useState(true);
	const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
	const [leagueStats, setLeagueStats] = useState<LeagueStats[]>([]);
	const [weekTotals, setWeekTotals] = useState<WeekTotal[]>([]);
	const [badges, setBadges] = useState<UserBadge[] | null>(null);
	const { currentSeason, setSeason: setLeagueSeason } = useWeek();
	// The season being reported on, and the seasons the user has picks in
	const [season, setSeason] = useState(currentSeason);
	const [seasons, setSeasons] = useState<number[]>([]);
	const isPastSeason = season !== currentSeason;

	// Badges load independently (in parallel with the stats below)
	const fetchBadges = useCallback(async (season: number) => {
		try {
			setBadges(null);
			const res = await fetch(`/api/user/badges?season=${season}`);
			if (!res.ok) throw new Error(`Failed to fetch badges (${res.status})`);
			const data: UserBadgesResponse = await res.json();
			setBadges(data.badges);
		} catch (error) {
			console.error('Error fetching badges:', error);
			setBadges([]);
		}
	}, []);

	const fetchStats = useCallback(async (season: number) => {
		try {
			setLoading(true);

			// Fetch user's leagues
			const leaguesResponse = await fetch('/api/user/leagues');
			if (!leaguesResponse.ok) throw new Error('Failed to fetch leagues');
			// Survivor pools have no points to report
			const leagues: LeagueData[] = ((await leaguesResponse.json()) as LeagueData[]).filter(l => l.mode !== 'survivor');

			// Fetch picks + season stats for every league concurrently
			const perLeague = await Promise.all(
				leagues.map(async league => {
					try {
						const [picksResponse, seasonStats] = await Promise.all([
							fetch(`/api/picks/user?leagueId=${league._id}&season=${season}`),
							fetch(`/api/seasonStats?leagueId=${league._id}&season=${season}`)
								.then(res => (res.ok ? (res.json() as Promise<SeasonStatsResponse>) : null))
								.catch(error => {
									console.error('Error fetching weeks won for league:', league._id, error);
									return null;
								})
						]);
						if (!picksResponse.ok) return null;
						const picks: PickData[] = await picksResponse.json();
						return { league, picks, seasonStats };
					} catch (error) {
						console.error('Error fetching stats for league:', league._id, error);
						return null;
					}
				})
			);

			const leagueStatsData: LeagueStats[] = [];
			const allTimeData = {
				totalPoints: 0,
				correctPicks: 0,
				totalPicks: 0,
				totalTFSPoints: 0,
				totalWeeksPlayed: 0,
				bestWeekPoints: 0,
				bestWeekNumber: 0,
				perfectWeeks: 0,
				currentStreak: 0,
				bestStreak: 0,
				totalWins: 0,
				totalLosses: 0
			};

			const allWeeks: WeekData[] = [];
			const perfectWeeksSet = new Set<string>(); // Same week across multiple leagues counts once
			const weekTotalsMap = new Map<number, WeekTotal>();

			// Aggregate in league order so tie-breaks match the original sequential behavior
			for (const result of perLeague) {
				if (!result) continue;
				const { league, picks, seasonStats } = result;
				// Past seasons only list the leagues the user actually played in
				if (season !== currentSeason && picks.length === 0) continue;

				let leagueTotalPoints = 0;
				let leagueCorrectPicks = 0;
				let leagueTotalPicks = 0;
				let leagueTotalTFSPoints = 0;
				let leagueBestWeekPoints = 0;

				picks.forEach(pick => {
					const finishedGamesCount = pick.picks.filter(isFinished).length;
					const totalPicksInWeek = pick.picks.length;
					const allGamesFinished = finishedGamesCount === totalPicksInWeek && totalPicksInWeek === 5;
					// Only count picks that are definitively correct (game finished and won)
					const correctInWeek = pick.picks.filter(p => p.isCorrect === true).length;

					// Count stats for any week with at least one finished game
					if (finishedGamesCount > 0) {
						leagueTotalPoints += pick.weeklyPoints || 0;
						leagueCorrectPicks += correctInWeek;
						leagueTotalPicks += finishedGamesCount;
						leagueTotalTFSPoints += pick.tfsPoints || 0;

						const isPerfectWeek = allGamesFinished && correctInWeek === 5;

						// Only fully finished weeks feed streaks
						if (allGamesFinished) {
							allWeeks.push({
								week: pick.week,
								leagueId: league._id,
								correctPicks: correctInWeek,
								totalPicks: totalPicksInWeek,
								weeklyPoints: pick.weeklyPoints || 0,
								isPerfectWeek,
								allGamesFinished
							});
							if (isPerfectWeek) perfectWeeksSet.add(`week-${pick.week}`);
						}
					}
				});

				const weeksPlayed = picks.filter(p => p.picks.some(isFinished)).length;
				const leagueWeeksWon = seasonStats?.weeksWon || 0;

				// Use recalculated weekly stats for best week (retroactive)
				if (seasonStats?.weeklyStats) {
					Object.entries(seasonStats.weeklyStats).forEach(([week, weekData]) => {
						const weekPoints = weekData.weeklyPoints || 0;
						if (weekPoints > leagueBestWeekPoints) leagueBestWeekPoints = weekPoints;
						if (weekPoints > allTimeData.bestWeekPoints) {
							allTimeData.bestWeekPoints = weekPoints;
							allTimeData.bestWeekNumber = parseInt(week);
						}

						const weekNum = parseInt(week);
						const agg = weekTotalsMap.get(weekNum) ?? { week: weekNum, points: 0, correct: 0, total: 0 };
						agg.points += weekPoints;
						agg.correct += weekData.correctPicks || 0;
						agg.total += weekData.totalPicks || 0;
						weekTotalsMap.set(weekNum, agg);
					});
				}

				leagueStatsData.push({
					leagueId: league._id,
					leagueName: league.name,
					leagueMode: league.mode || 'standard',
					totalPoints: leagueTotalPoints,
					correctPicks: leagueCorrectPicks,
					totalPicks: leagueTotalPicks,
					totalTFSPoints: leagueTotalTFSPoints,
					winPercentage: leagueTotalPicks > 0 ? (leagueCorrectPicks / leagueTotalPicks) * 100 : 0,
					weeksPlayed,
					bestWeekPoints: leagueBestWeekPoints,
					currentStreak: 0,
					bestStreak: 0,
					weeksWon: leagueWeeksWon
				});

				allTimeData.totalPoints += leagueTotalPoints;
				allTimeData.correctPicks += leagueCorrectPicks;
				allTimeData.totalPicks += leagueTotalPicks;
				allTimeData.totalTFSPoints += leagueTotalTFSPoints;
				allTimeData.totalWeeksPlayed += weeksPlayed;
				allTimeData.totalWins += leagueCorrectPicks;
				allTimeData.totalLosses += leagueTotalPicks - leagueCorrectPicks;
			}

			allTimeData.perfectWeeks = perfectWeeksSet.size;

			// Streaks: group by week number across leagues, 60%+ accuracy extends a streak
			const weekMap = new Map<number, { correct: number; total: number }>();
			allWeeks.forEach(w => {
				const existing = weekMap.get(w.week) || { correct: 0, total: 0 };
				weekMap.set(w.week, { correct: existing.correct + w.correctPicks, total: existing.total + w.totalPicks });
			});
			const sortedWeeks = Array.from(weekMap.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([week, data]) => ({ week, ...data }));
			const goodWeek = (w: { correct: number; total: number }) => (w.total > 0 ? w.correct / w.total : 0) >= 0.6;

			let currentStreak = 0;
			let bestStreak = 0;
			let tempStreak = 0;
			for (const w of sortedWeeks) {
				if (goodWeek(w)) {
					tempStreak++;
					bestStreak = Math.max(bestStreak, tempStreak);
				} else {
					tempStreak = 0;
				}
			}
			for (let i = sortedWeeks.length - 1; i >= 0; i--) {
				if (goodWeek(sortedWeeks[i])) currentStreak++;
				else break;
			}

			// No complete weeks yet but a strong win rate: count it as a 1-week streak
			if (currentStreak === 0 && allTimeData.totalPicks > 0 && allTimeData.correctPicks / allTimeData.totalPicks >= 0.6) {
				currentStreak = 1;
				if (bestStreak === 0) bestStreak = 1;
			}

			allTimeData.currentStreak = currentStreak;
			allTimeData.bestStreak = bestStreak;

			setLeagueStats(leagueStatsData);
			setWeekTotals(Array.from(weekTotalsMap.values()).sort((a, b) => a.week - b.week));
			setAllTimeStats({
				...allTimeData,
				winPercentage: allTimeData.totalPicks > 0 ? (allTimeData.correctPicks / allTimeData.totalPicks) * 100 : 0,
				totalLeagues: leagueStatsData.length,
				avgPointsPerWeek: allTimeData.totalWeeksPlayed > 0 ? allTimeData.totalPoints / allTimeData.totalWeeksPlayed : 0
			});
		} catch (error) {
			console.error('Error fetching stats:', error);
		} finally {
			setLoading(false);
		}
	}, [currentSeason]);

	// Seasons to choose from
	useEffect(() => {
		if (status !== 'authenticated') return;
		fetch('/api/user/seasons')
			.then(res => (res.ok ? res.json() : null))
			.then((data: { seasons?: Array<{ year: number }> } | null) => setSeasons(data?.seasons?.map(s => s.year) ?? []))
			.catch(error => console.error('Error fetching seasons:', error));
	}, [status]);

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
			return;
		}

		if (status === 'authenticated') {
			fetchStats(season);
			fetchBadges(season);
		}
	}, [status, router, fetchStats, fetchBadges, season]);


	const achievements = useMemo(() => (allTimeStats ? getAchievements(allTimeStats) : []), [allTimeStats]);
	// Pick one fact per data load (not per render)
	const featuredFact = useMemo(() => {
		if (!allTimeStats) return null;
		const facts = getStatFacts(allTimeStats);
		return facts[Math.floor(Math.random() * facts.length)];
	}, [allTimeStats]);

	const seasonPicker =
		seasons.length > 1 ? (
			<div className='flex flex-wrap gap-2' role='group' aria-label='Season'>
				{seasons.map(year => (
					<button
						key={year}
						type='button'
						onClick={() => setSeason(year)}
						aria-pressed={year === season}
						className={cn(
							'rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular transition-colors',
							year === season ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground'
						)}
					>
						{seasonLabel(year)}
					</button>
				))}
			</div>
		) : undefined;

	const header = (
		<PageHeader
			eyebrow={
				<>
					<BarChart3 className='h-3.5 w-3.5' /> {isPastSeason ? `${seasonLabel(season)} season report` : 'Season report'}
				</>
			}
			title='My Stats'
			description={isPastSeason ? `How your ${seasonLabel(season)} season went, across every league you played.` : 'Your picks, wins and streaks across every league.'}
			actions={seasonPicker}
		/>
	);

	if (status === 'loading' || loading) {
		return (
			<PageContainer>
				{header}
				<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className='h-32 rounded-2xl' />
					))}
				</div>
				<div className='mt-6 grid gap-6 lg:grid-cols-2'>
					<Skeleton className='h-64 rounded-2xl' />
					<Skeleton className='h-64 rounded-2xl' />
				</div>
				<Skeleton className='mt-6 h-72 rounded-2xl' />
			</PageContainer>
		);
	}

	if (!allTimeStats || leagueStats.length === 0) {
		return (
			<PageContainer>
				{header}
				<EmptyState
					icon={BarChart3}
					title='No stats yet'
					description='Join a league and start making picks — your season numbers will show up here once games are graded.'
					action={
						<Button asChild>
							<Link href='/dashboard'>Go to dashboard</Link>
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	const s = allTimeStats;
	const incorrect = s.totalPicks - s.correctPicks;
	const winPct = Math.round(s.winPercentage);

	return (
		<PageContainer>
			{header}

			{featuredFact && (
				<div className='mb-6 flex animate-fade-in items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3'>
					<Sparkles className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
					<p className='text-sm text-foreground/90'>{featuredFact}</p>
				</div>
			)}

			{/* Headline numbers */}
			<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
				<StatTile label='Total points' value={s.totalPoints} icon={Trophy} tone='primary' sub={s.bestWeekPoints > 0 ? `Best: ${s.bestWeekPoints} in Wk ${s.bestWeekNumber}` : undefined} className='animate-slide-up' />
				<StatTile
					label='Win rate'
					value={`${winPct}%`}
					icon={Target}
					tone='accent'
					sub={
						<div className='h-1 overflow-hidden rounded-full bg-accent/15' role='meter' aria-valuemin={0} aria-valuemax={100} aria-valuenow={winPct} aria-label='Win rate'>
							<div className='h-full rounded-full bg-accent transition-[width] duration-700' style={{ width: `${Math.min(100, s.winPercentage)}%` }} />
						</div>
					}
					className='animate-slide-up [animation-delay:60ms]'
				/>
				<StatTile label='Avg / week' value={s.avgPointsPerWeek.toFixed(1)} icon={TrendingUp} tone='primary' sub={`${s.totalWeeksPlayed} weeks played`} className='animate-slide-up [animation-delay:120ms]' />
				<StatTile label='TFS bonus' value={s.totalTFSPoints} icon={Zap} tone='warning' sub='Tiebreaker points' className='animate-slide-up [animation-delay:180ms]' />
			</div>

			{/* Record + Performance */}
			<div className='mt-6 grid gap-6 lg:grid-cols-2'>
				<Card className='p-5 sm:p-6'>
					<SectionHeader title='Your Record' icon={Trophy} />
					<div className='flex items-end justify-between gap-4'>
						<p className='font-display text-5xl font-extrabold italic leading-none tracking-tight sm:text-6xl'>
							<span className='text-accent'>{s.correctPicks}</span>
							<span className='mx-1 text-muted-foreground'>-</span>
							<span className='text-accent-2'>{incorrect}</span>
						</p>
						<p className='pb-1 text-right text-xs text-muted-foreground tabular'>
							{s.totalPicks} games
							<br />
							{s.totalWeeksPlayed} weeks
						</p>
					</div>

					{/* Win/loss split — two segments with a 2px surface gap */}
					<div className='mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full' aria-hidden>
						{s.correctPicks > 0 && <div className='rounded-l-full bg-accent' style={{ flexGrow: s.correctPicks }} />}
						{incorrect > 0 && <div className='rounded-r-full bg-accent-2' style={{ flexGrow: incorrect }} />}
						{s.totalPicks === 0 && <div className='flex-1 bg-white/[0.06]' />}
					</div>
					<div className='mt-2 flex justify-between text-xs text-muted-foreground'>
						<span className='flex items-center gap-1.5'>
							<span className='h-2 w-2 rounded-full bg-accent' /> Correct
						</span>
						<span className='flex items-center gap-1.5'>
							Incorrect <span className='h-2 w-2 rounded-full bg-accent-2' />
						</span>
					</div>

					<dl className='mt-5 grid grid-cols-2 gap-3'>
						<Metric label='Leagues' value={s.totalLeagues} />
						<Metric label='Weeks played' value={s.totalWeeksPlayed} />
					</dl>
				</Card>

				<Card className='p-5 sm:p-6'>
					<SectionHeader title='Performance' icon={Flame} />
					<dl className='grid grid-cols-2 gap-3'>
						<Metric label='Current streak' value={s.currentStreak} sub='wks at 60%+' accent={s.currentStreak >= 3} />
						<Metric label='Best streak' value={s.bestStreak} sub='wks at 60%+' />
						<Metric label='Best week' value={s.bestWeekPoints} sub={s.bestWeekNumber ? `Week ${s.bestWeekNumber}` : undefined} />
						<Metric label='Pts / correct pick' value={s.correctPicks > 0 ? (s.totalPoints / s.correctPicks).toFixed(1) : '—'} />
					</dl>
					{s.perfectWeeks > 0 && (
						<div className='mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#FFD66B]/25 bg-[#FFD66B]/[0.07] px-4 py-3'>
							<div className='flex items-center gap-2.5'>
								<Crown className='h-5 w-5 text-[#FFD66B]' />
								<div>
									<p className='text-sm font-semibold'>Perfect weeks</p>
									<p className='text-xs text-muted-foreground'>All 5 picks correct</p>
								</div>
							</div>
							<span className='font-display text-3xl font-extrabold italic tabular text-[#FFD66B]'>{s.perfectWeeks}</span>
						</div>
					)}
				</Card>
			</div>

			{/* Badges */}
			<BadgesSection badges={badges} multiLeague={leagueStats.length > 1} />

			{/* Week by week */}
			{weekTotals.length > 0 && (
				<section className='mt-8'>
					<SectionHeader title='Week by Week' icon={BarChart3} action={<Pill>{leagueStats.length > 1 ? 'All leagues' : leagueStats[0].leagueName}</Pill>} />
					<Card className='p-4 sm:p-6'>
						<WeekColumns weeks={weekTotals} />
					</Card>
				</section>
			)}

			{/* League breakdown */}
			<section className='mt-8'>
				<SectionHeader title='By League' icon={Users} />
				<div className='space-y-3'>
					{leagueStats.map((stat, i) => (
						<div key={stat.leagueId} className='glass animate-slide-up overflow-hidden rounded-2xl' style={{ animationDelay: `${i * 50}ms` }}>
							<Link
								href={`/league/${stat.leagueId}`}
								// Open the league on the season being viewed here
								onClick={() => setLeagueSeason(season)}
								className='group block p-4 transition-colors hover:bg-white/[0.06] sm:p-5'
							>
								<div className='flex items-center gap-3'>
									<div className='min-w-0 flex-1'>
										<div className='flex items-center gap-2'>
											<h3 className='truncate font-display text-xl font-bold uppercase italic tracking-tight'>{stat.leagueName}</h3>
											{stat.leagueMode === 'steve' && <Pill tone='warning'>TFS</Pill>}
										</div>
										<p className='text-xs text-muted-foreground tabular'>
											{stat.weeksPlayed} weeks · {stat.totalPicks} picks
										</p>
									</div>
									<div className='text-right'>
										<p className='font-display text-3xl font-extrabold italic leading-none tabular'>{stat.totalPoints}</p>
										<p className='eyebrow mt-0.5 text-[9px]'>pts</p>
									</div>
									<ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary' />
								</div>
	
								<dl className={cn('mt-4 grid grid-cols-3 gap-2', stat.leagueMode === 'steve' ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
									<Metric compact label='Win %' value={`${Math.round(stat.winPercentage)}%`} />
									<Metric compact label='Weeks won' value={stat.weeksWon} />
									<Metric compact label='Correct' value={stat.correctPicks} />
									<Metric compact label='Incorrect' value={stat.totalPicks - stat.correctPicks} />
									{stat.leagueMode === 'steve' && <Metric compact label='TFS' value={stat.totalTFSPoints} />}
								</dl>
	
								<div className='mt-3 h-1 overflow-hidden rounded-full bg-accent/15'>
									<div className='h-full rounded-full bg-accent' style={{ width: `${Math.min(100, stat.winPercentage)}%` }} />
								</div>
							</Link>
							<Link
								href={`/league/${stat.leagueId}/history`}
								className='flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground sm:px-5'
							>
								<span className='flex items-center gap-2'>
									<History className='h-3.5 w-3.5' /> League history · champions &amp; final standings
								</span>
								<ChevronRight className='h-3.5 w-3.5' />
							</Link>
						</div>
					))}
				</div>
			</section>

			{/* Achievements */}
			{achievements.length > 0 && (
				<section className='mt-8'>
					<SectionHeader title='Achievements' icon={Award} action={<Pill tone='primary'>{achievements.length} unlocked</Pill>} />
					<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
						{achievements.map((a, i) => (
							<div key={a.label} className='glass animate-slide-up rounded-2xl p-4' style={{ animationDelay: `${i * 40}ms` }}>
								<div className='flex items-start justify-between gap-2'>
									<span className={cn('grid h-9 w-9 place-items-center rounded-xl', ACHIEVEMENT_TONES[a.tone])}>
										<a.icon className='h-4 w-4' />
									</span>
									<span className='font-display text-lg font-extrabold italic tabular'>{a.value}</span>
								</div>
								<p className='mt-3 text-sm font-semibold'>{a.label}</p>
								<p className='mt-0.5 text-xs leading-snug text-muted-foreground'>{a.description}</p>
							</div>
						))}
					</div>
				</section>
			)}
		</PageContainer>
	);
};

export default StatsPage;

/* ------------------------------------------------------------------ */

function Metric({ label, value, sub, accent, compact }: { label: string; value: ReactNode; sub?: string; accent?: boolean; compact?: boolean }) {
	return (
		<div className={cn('rounded-xl border border-white/[0.07] bg-white/[0.03]', compact ? 'px-3 py-2' : 'p-3.5')}>
			<dt className='eyebrow text-[10px]'>{label}</dt>
			<dd className={cn('mt-1 font-display font-extrabold italic leading-none tabular', compact ? 'text-xl' : 'text-3xl', accent && 'text-accent')}>{value}</dd>
			{sub && <dd className='mt-1 text-[11px] text-muted-foreground'>{sub}</dd>}
		</div>
	);
}

function BadgesSection({ badges, multiLeague }: { badges: UserBadge[] | null; multiLeague: boolean }) {
	if (badges && badges.length === 0) return null;
	const earned = badges?.filter(b => b.earned).length ?? 0;
	// Earned first (keeping prestige order), then locked by progress
	const ordered = badges
		? [...badges].sort((a, b) => Number(b.earned) - Number(a.earned) || (b.earned ? 0 : b.progress.current / b.progress.target - a.progress.current / a.progress.target))
		: [];
	return (
		<section className='mt-8'>
			<SectionHeader title='Badges' icon={Medal} action={badges && <Pill tone={earned ? 'accent' : 'muted'}>{earned}/{badges.length} earned</Pill>} />
			<div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
				{badges
					? ordered.map((b, i) => <BadgeCard key={b.id} badge={b} index={i} showLeague={multiLeague} />)
					: Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-44 rounded-2xl' />)}
			</div>
		</section>
	);
}

/** Single-series column chart: points per week. Value on the best week's cap; tooltip on hover/focus. */
function WeekColumns({ weeks }: { weeks: WeekTotal[] }) {
	const [active, setActive] = useState<number | null>(null);
	const max = Math.max(...weeks.map(w => w.points), 1);
	const step = [1, 2, 5, 10, 20, 25, 50, 100].find(s => max / s <= 4) ?? Math.ceil(max / 4);
	const top = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let t = 0; t <= top; t += step) ticks.push(t);
	const best = weeks.reduce((b, w) => (w.points > b.points ? w : b), weeks[0]);
	const activeWeek = weeks.find(w => w.week === active) ?? null;

	return (
		<div>
			<div className='mb-3 flex h-5 items-center justify-between text-xs text-muted-foreground'>
				{activeWeek ? (
					<p>
						<span className='font-semibold text-foreground'>Week {activeWeek.week}</span> · <span className='font-display text-sm font-bold italic tabular text-foreground'>{activeWeek.points}</span> pts · {activeWeek.correct}/{activeWeek.total} correct
					</p>
				) : (
					<p>Tap or hover a week for details</p>
				)}
			</div>
			<div className='relative flex h-48 gap-2'>
				{/* Y axis + gridlines share one coordinate system: bottom 1.5rem is the label row */}
				<div className='relative w-6 shrink-0'>
					{ticks.map(t => (
						<span key={t} className='absolute right-0 translate-y-1/2 text-[10px] leading-none text-muted-foreground tabular' style={{ bottom: `calc(${t / top} * (100% - 1.5rem) + 1.5rem)` }}>
							{t}
						</span>
					))}
				</div>
				<div className='relative min-w-0 flex-1'>
					{ticks.map(t => (
						<div key={t} className='pointer-events-none absolute inset-x-0 h-px bg-white/[0.07]' style={{ bottom: `calc(${t / top} * (100% - 1.5rem) + 1.5rem)` }} />
					))}
					<ol className='relative flex h-full items-stretch gap-0.5' onMouseLeave={() => setActive(null)}>
						{weeks.map(w => {
							const pct = (w.points / top) * 100;
							const isActive = active === w.week;
							return (
								<li key={w.week} className='flex min-w-0 flex-1 flex-col'>
									<button
										type='button'
										onMouseEnter={() => setActive(w.week)}
										onFocus={() => setActive(w.week)}
										onClick={() => setActive(w.week)}
										aria-label={`Week ${w.week}: ${w.points} points, ${w.correct} of ${w.total} correct`}
										className={cn('relative flex flex-1 items-end justify-center rounded-t-md transition-colors', isActive && 'bg-white/[0.04]')}
									>
										{w.week === best.week && w.points > 0 && (
											<span className='absolute left-1/2 -translate-x-1/2 text-[10px] font-bold leading-none text-foreground tabular' style={{ bottom: `calc(${pct}% + 4px)` }}>
												{w.points}
											</span>
										)}
										<span
											className={cn('block w-full max-w-6 rounded-t bg-primary transition-opacity', active !== null && !isActive && 'opacity-50')}
											style={{ height: `${Math.max(pct, w.points > 0 ? 2 : 0.5)}%` }}
										/>
									</button>
									<span className={cn('h-6 pt-1.5 text-center text-[10px] font-semibold leading-none tabular', isActive ? 'text-foreground' : 'text-muted-foreground')}>{w.week}</span>
								</li>
							);
						})}
					</ol>
				</div>
			</div>
			<table className='sr-only'>
				<caption>Points per week</caption>
				<thead>
					<tr>
						<th scope='col'>Week</th>
						<th scope='col'>Points</th>
						<th scope='col'>Correct</th>
					</tr>
				</thead>
				<tbody>
					{weeks.map(w => (
						<tr key={w.week}>
							<td>{w.week}</td>
							<td>{w.points}</td>
							<td>
								{w.correct}/{w.total}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function getAchievements(s: AllTimeStats): Achievement[] {
	const list: Achievement[] = [];
	if (s.totalPoints >= 100) list.push({ icon: Trophy, label: 'Century Club', value: '100+', tone: 'primary', description: 'Earned 100+ total points' });
	if (s.totalPoints >= 200) list.push({ icon: Rocket, label: 'Points Machine', value: '200+', tone: 'hot', description: 'Earned 200+ total points' });
	if (s.winPercentage >= 60) list.push({ icon: Star, label: 'Elite Picker', value: `${Math.round(s.winPercentage)}%`, tone: 'accent', description: 'Maintained 60%+ win rate' });
	if (s.winPercentage >= 80) list.push({ icon: Crosshair, label: 'Sharpshooter', value: `${Math.round(s.winPercentage)}%`, tone: 'hot', description: 'Achieved 80%+ win rate' });
	// (Perfect Week and the pick-level Hot Streak are season badges now; this one is week-based)
	if (s.bestStreak >= 5) list.push({ icon: Flame, label: 'Steady Hand', value: `${s.bestStreak}`, tone: 'warning', description: '5+ weeks with 60%+ win rate' });
	if (s.bestStreak >= 10) list.push({ icon: Sparkles, label: 'Unstoppable', value: `${s.bestStreak}`, tone: 'gold', description: '10+ week winning streak' });
	if (s.totalTFSPoints >= 20) list.push({ icon: Zap, label: 'TFS Master', value: `${s.totalTFSPoints}`, tone: 'violet', description: 'Earned 20+ TFS bonus points' });
	if (s.totalTFSPoints >= 50) list.push({ icon: Zap, label: 'TFS Expert', value: `${s.totalTFSPoints}`, tone: 'violet', description: 'Earned 50+ TFS bonus points' });
	if (s.totalLeagues >= 3) list.push({ icon: Users, label: 'League Warrior', value: `${s.totalLeagues}`, tone: 'primary', description: 'Competing in 3+ leagues' });
	if (s.totalWeeksPlayed >= 10) list.push({ icon: Calendar, label: 'Consistency King', value: `${s.totalWeeksPlayed}w`, tone: 'accent', description: 'Played in 10+ weeks' });
	if (s.totalWeeksPlayed >= 15) list.push({ icon: Medal, label: 'Marathon Runner', value: `${s.totalWeeksPlayed}w`, tone: 'primary', description: 'Played in 15+ weeks' });
	if (s.correctPicks >= 100) list.push({ icon: Shield, label: 'Champion', value: `${s.correctPicks}`, tone: 'gold', description: 'Made 100+ correct picks' });
	if (s.currentStreak >= 3) list.push({ icon: Flame, label: 'On Fire', value: `${s.currentStreak}`, tone: 'hot', description: 'Currently on a 3+ week streak' });
	return list;
}

function getStatFacts(s: AllTimeStats): string[] {
	const facts: string[] = [];
	if (s.winPercentage > 60) facts.push(`You're beating the house! ${Math.round(s.winPercentage)}% win rate crushes the typical 50% mark`);
	if (s.bestWeekPoints >= 15) facts.push(`Your best week earned ${s.bestWeekPoints} points — that's ${(s.bestWeekPoints / (s.avgPointsPerWeek || 1)).toFixed(1)}x your average!`);
	if (s.perfectWeeks > 0) facts.push(`Perfect weeks are rare — you've achieved ${s.perfectWeeks} of them!`);
	if (s.currentStreak >= 3) facts.push(`You're on fire! ${s.currentStreak} weeks in a row with 60%+ accuracy`);
	if (s.totalTFSPoints >= 20) facts.push(`Your TFS predictions have earned ${s.totalTFSPoints} bonus points!`);
	if (s.totalWeeksPlayed >= 10) facts.push(`${s.totalWeeksPlayed} weeks of dedication — you're in for the long haul!`);
	if (s.correctPicks > 0) facts.push(`Each correct pick earns you ${(s.totalPoints / s.correctPicks).toFixed(1)} points on average`);
	return facts.length > 0 ? facts : ['Keep making picks to unlock interesting stats!'];
}
