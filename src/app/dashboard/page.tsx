'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowRight, Compass, Flame, LogIn, Percent, Plus, Target, Trophy, Users } from 'lucide-react';
import CountUp from 'react-countup';
import ActiveLeagues, { type DashboardLeague, type LeagueSummary, type PickedTeam } from '@/components/league/ActiveLeagues';
import { Button } from '@/components/ui/button';
import { LeagueCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, PageContainer, SectionHeader, StatTile } from '@/components/ui/page';
import { useWeek } from '@/contexts/WeekContext';
import type { MatchupMiniData } from '@/components/league/MatchupMini';
import type { MatchupsResponse } from '@/lib/matchups';
import { LiveNowBanner } from '@/components/league/LiveNowBanner';

interface LeaderboardResponse {
	weeklyResults?: Array<{ userId: string; points: number; hasPicks: boolean; tfsPoints: number; pickedTeams: PickedTeam[] }>;
	seasonStats?: Array<{ userId?: string; player: string; totalPoints: number; totalPicks: number; correctPicks: number }>;
}

function summarize(data: LeaderboardResponse, userId: string, league: DashboardLeague) {
	const me = data.weeklyResults?.find(r => r.userId === userId);
	const standings = [...(data.seasonStats ?? [])].sort((a, b) => b.totalPoints - a.totalPoints);
	const myIndex = standings.findIndex(s => s.userId === userId);
	const mySeason = standings[myIndex];

	const summary: LeagueSummary = {
		hasPicks: !!me?.hasPicks,
		weekPoints: me?.points ?? 0,
		seasonPoints: mySeason?.totalPoints ?? 0,
		rank: myIndex >= 0 ? myIndex + 1 : null,
		totalMembers: standings.length || league.members?.length || 0,
		pickedTeams: me?.pickedTeams ?? [],
		tfsPoints: me?.tfsPoints ?? 0
	};
	return { summary, correct: mySeason?.correctPicks ?? 0, graded: mySeason?.totalPicks ?? 0 };
}

export default function Dashboard() {
	const { data: session, status } = useSession();
	const { liveWeek } = useWeek();
	const userId = session?.user?.id;
	const [leagues, setLeagues] = useState<DashboardLeague[] | null>(null);
	const [summaries, setSummaries] = useState<Map<string, LeagueSummary>>(new Map());
	const [totals, setTotals] = useState<{ correct: number; graded: number } | null>(null);
	const [matchups, setMatchups] = useState<Map<string, MatchupMiniData>>(new Map());

	useEffect(() => {
		if (status !== 'authenticated') return;
		fetch('/api/user/leagues')
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`Failed to load leagues (${res.status})`))))
			.then((data: DashboardLeague[]) => setLeagues(data))
			.catch(error => {
				console.error(error);
				setLeagues([]);
			});
	}, [status]);

	// One leaderboard + one matchups request per league, all in parallel
	useEffect(() => {
		if (!leagues?.length || !userId || liveWeek === null) return;
		let cancelled = false;

		const loadMatchup = async (leagueId: string): Promise<MatchupMiniData | null> => {
			try {
				const res = await fetch(`/api/league/${leagueId}/matchups?week=${liveWeek}`);
				if (!res.ok) return null;
				const data: MatchupsResponse = await res.json();
				return { matchup: data.matchups.find(m => m.id === data.myMatchupId) ?? null, record: data.records[userId] };
			} catch (error) {
				console.error(`Error loading matchups for league ${leagueId}:`, error);
				return null;
			}
		};

		Promise.all(
			leagues.map(async league => {
				try {
					const [res, matchup] = await Promise.all([fetch(`/api/leaderboard?week=${liveWeek}&leagueId=${league._id}`), loadMatchup(league._id)]);
					if (!res.ok) return null;
					return { id: league._id, matchup, ...summarize(await res.json(), userId, league) };
				} catch (error) {
					console.error(`Error loading league ${league._id}:`, error);
					return null;
				}
			})
		).then(results => {
			if (cancelled) return;
			const matchupMap = new Map<string, MatchupMiniData>();
			const map = new Map<string, LeagueSummary>();
			let correct = 0;
			let graded = 0;
			for (const r of results) {
				if (!r) continue;
				map.set(r.id, r.summary);
				if (r.matchup) matchupMap.set(r.id, r.matchup);
				correct += r.correct;
				graded += r.graded;
			}
			setSummaries(map);
			setMatchups(matchupMap);
			setTotals({ correct, graded });
		});

		return () => {
			cancelled = true;
		};
	}, [leagues, userId, liveWeek]);

	const overview = useMemo(() => {
		const all = Array.from(summaries.values());
		const ranked = all.filter(s => s.rank !== null);
		return {
			seasonPoints: all.reduce((sum, s) => sum + s.seasonPoints, 0),
			weekPoints: all.reduce((sum, s) => sum + s.weekPoints, 0),
			bestRank: ranked.length ? Math.min(...ranked.map(s => s.rank!)) : null,
			leagueCount: all.length,
			needsPicks: leagues?.filter(l => summaries.get(l._id)?.hasPicks === false) ?? []
		};
	}, [summaries, leagues]);

	const firstName = session?.user?.name?.split(' ')[0];
	const winRate = totals && totals.graded > 0 ? Math.round((totals.correct / totals.graded) * 100) : null;
	const statsReady = summaries.size > 0;

	return (
		<PageContainer size='wide'>
			{/* Hero */}
			<section className='mb-8 grid gap-6 sm:mb-10 lg:grid-cols-[1fr_auto] lg:items-end'>
				<div className='animate-slide-up'>
					<p className='eyebrow mb-3 flex items-center gap-2'>
						<span className='live-dot' />
						{liveWeek ? `Week ${liveWeek} is on` : 'This week'}
					</p>
					<h1 className='display-heading text-5xl sm:text-7xl'>
						<span className='chrome-text'>Let’s go,</span> <span className='brand-text pr-2'>{firstName ?? 'champ'}.</span>
					</h1>
					{overview.needsPicks.length > 0 ? (
						<p className='mt-3 text-base text-muted-foreground sm:text-lg'>
							You still need picks in <span className='font-semibold text-warning'>{overview.needsPicks.length === 1 ? overview.needsPicks[0].name : `${overview.needsPicks.length} leagues`}</span>. Lock them in before kickoff.
						</p>
					) : (
						<p className='mt-3 text-base text-muted-foreground sm:text-lg'>{leagues?.length ? 'Your picks are in. Now sit back and sweat it out.' : 'Join a league to start making picks.'}</p>
					)}
				</div>
				{overview.needsPicks.length > 0 && (
					<Button asChild size='lg' className='animate-slide-up self-start lg:self-end' style={{ animationDelay: '120ms' }}>
						<Link href={`/league/${overview.needsPicks[0]._id}`}>
							Make your picks <ArrowRight />
						</Link>
					</Button>
				)}
			</section>

			{/* Live games: secured/projected points per league (renders nothing when no games are live) */}
			{!!leagues?.length && <LiveNowBanner leagues={leagues} className='mb-8' />}

			{/* KPIs */}
			{!!leagues?.length && (
				<section className='mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4'>
					<StatTile label='Season points' icon={Trophy} value={statsReady ? <CountUp end={overview.seasonPoints} duration={1.2} /> : '—'} sub={`across ${overview.leagueCount || leagues.length} league${leagues.length === 1 ? '' : 's'}`} />
					<StatTile label='This week' icon={Flame} tone='hot' value={statsReady ? <CountUp end={overview.weekPoints} duration={1.2} prefix='+' /> : '—'} sub={liveWeek ? `Week ${liveWeek}` : undefined} />
					<StatTile label='Best rank' icon={Target} tone='warning' value={overview.bestRank ? `#${overview.bestRank}` : '—'} sub={<Link href='/leaderboard' className='font-semibold text-primary hover:underline'>Global leaderboard →</Link>} />
					<StatTile label='Win rate' icon={Percent} tone='accent' value={winRate !== null ? <CountUp end={winRate} duration={1.2} suffix='%' /> : '—'} sub={totals ? `${totals.correct} of ${totals.graded} correct` : undefined} />
				</section>
			)}

			<div className='grid gap-8 lg:grid-cols-[1fr_320px]'>
				{/* Leagues */}
				<section>
					<SectionHeader
						title='Your leagues'
						icon={Users}
						action={
							<div className='flex gap-2'>
								<Button asChild size='sm' variant='outline'>
									<Link href='/league/join'>
										<LogIn /> Join
									</Link>
								</Button>
								<Button asChild size='sm'>
									<Link href='/league/create'>
										<Plus /> Create
									</Link>
								</Button>
							</div>
						}
					/>
					{leagues === null ? (
						<div className='grid gap-3'>
							{[0, 1].map(i => (
								<LeagueCardSkeleton key={i} />
							))}
						</div>
					) : leagues.length > 0 ? (
						<ActiveLeagues leagues={leagues} summaries={summaries} userId={userId} matchups={matchups} />
					) : (
						<EmptyState
							icon={Users}
							title='No leagues yet'
							description='Start your own league and invite friends, or join one with an invite link or code.'
							action={
								<>
									<Button asChild>
										<Link href='/league/create'>
											<Plus /> Create a league
										</Link>
									</Button>
									<Button asChild variant='outline'>
										<Link href='/league/join'>
											<LogIn /> Join a league
										</Link>
									</Button>
								</>
							}
						/>
					)}
				</section>

				{/* Sidebar */}
				<aside className='space-y-4'>
					<div className='glass rounded-2xl p-2'>
						{[
							{ href: '/league/create', icon: Plus, title: 'Create a league', body: 'Be the commissioner', tone: 'text-primary bg-primary/10' },
							{ href: '/league/join', icon: LogIn, title: 'Join with a code', body: 'Got an invite?', tone: 'text-accent bg-accent/10' },
							{ href: '/league/browse', icon: Compass, title: 'Browse public leagues', body: 'Find a game to join', tone: 'text-warning bg-warning/10' },
							{ href: '/stats', icon: Target, title: 'My stats', body: 'Your season in numbers', tone: 'text-accent-2 bg-accent-2/10' }
						].map(({ href, icon: Icon, title, body, tone }) => (
							<Link key={href} href={href} className='group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.05]'>
								<span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
									<Icon className='h-5 w-5' />
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block text-sm font-semibold'>{title}</span>
									<span className='block text-xs text-muted-foreground'>{body}</span>
								</span>
								<ArrowRight className='h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground' />
							</Link>
						))}
					</div>

					<div className='gradient-border glass relative overflow-hidden rounded-2xl p-5'>
						<div className='pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-2/25 blur-2xl' />
						<p className='eyebrow'>Pro tip</p>
						<p className='mt-2 font-display text-2xl font-bold uppercase italic leading-tight'>One upset beats a week of chalk.</p>
						<p className='mt-2 text-sm text-muted-foreground'>In Standard leagues a +300 underdog pays 6 points — the same as six heavy favorites.</p>
					</div>
				</aside>
			</div>
		</PageContainer>
	);
}
