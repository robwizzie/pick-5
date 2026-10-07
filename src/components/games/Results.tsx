'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import CountUp from 'react-countup';
import { CheckCircle2, ClipboardX, LayoutGrid, LogIn, Target, Trophy, Tv } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, StatTile } from '@/components/ui/page';
import { GameCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { TeamLogo } from '@/components/ui/team-logo';
import { PickGameCard } from './PickGameCard';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { hasGameFinished, hasGameStarted } from '@/services/gameUtils';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Pick {
	gameId: string;
	team: string;
	opponent: string;
	isHome: boolean;
	odds?: number;
}

interface WeeklyPicks {
	picks: Pick[];
	tfsGame: string;
	tfsScore: string;
	submitted: boolean;
	/** Lock of the week; for another player it's only revealed once that game kicks off. */
	lockGameId?: string | null;
}

interface LeagueMember {
	_id: string;
	name: string;
	image: string | null;
}

interface Picker {
	userId: string;
	name: string;
	image: string | null;
}

interface LeaguePicksData {
	[gameId: string]: {
		away: Picker[];
		home: Picker[];
	};
}

interface SnapshotOdds {
	id: string;
	home?: { odds?: number };
	away?: { odds?: number };
}

interface ResultRow {
	pick: Pick;
	index: number;
	game: Game;
	isCorrect: boolean | null;
	points: number;
	isLock: boolean;
	finished: boolean;
	inProgress: boolean;
}

const ALL_GAMES = 'all-games';

const isLiveStatus = (status?: string) => {
	const s = status?.toLowerCase();
	return s === 'in' || s === 'in_progress';
};
const isFinalStatus = (status?: string) => {
	const s = status?.toLowerCase();
	return s === 'post' || s === 'final';
};
const isUpcomingStatus = (status?: string) => {
	const s = status?.toLowerCase();
	return s === 'pre' || s === 'scheduled' || !s;
};

/** Attach odds from the centralized snapshot (standard mode). */
async function withSnapshotOdds(games: Game[], week: number, season: number): Promise<Game[]> {
	try {
		const oddsResponse = await fetch(`/api/odds/snapshot?week=${week}&season=${season}`);
		let snapshotOdds: SnapshotOdds[] = [];
		if (oddsResponse.ok) {
			const data = await oddsResponse.json();
			snapshotOdds = data.odds || [];
		}

		return games.map(game => {
			const snapshotGameOdds = snapshotOdds.find(o => o.id === game.id);
			const homeOdds = snapshotGameOdds?.home?.odds;
			const awayOdds = snapshotGameOdds?.away?.odds;
			if (homeOdds || awayOdds) {
				return { ...game, home: { ...game.home, odds: homeOdds }, away: { ...game.away, odds: awayOdds } };
			}
			return game;
		});
	} catch (error) {
		console.error('[Results] Error fetching odds:', error);
		return games;
	}
}

/** A pick is only graded once the game is final. Ties are losses for both sides (mirrors server scoring). */
function checkPickCorrect(pick: Pick, game: Game): boolean | null {
	if (!hasGameFinished(game)) return null;
	const homeScore = game.home.score;
	const awayScore = game.away.score;
	if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;
	return ScoringService.calculatePickResult(pick, {
		id: game.id,
		homeScore,
		awayScore,
		homeTeam: game.home.team,
		awayTeam: game.away.team,
		status: game.status
	});
}

const getGameTotal = (game: Game) => (typeof game.home.score === 'number' && typeof game.away.score === 'number' ? game.home.score + game.away.score : undefined);

const getTimeAgo = (date: Date | null) => {
	if (!date) return '';
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	return `${Math.floor(minutes / 60)}h ago`;
};

function GroupLabel({ title, count, live }: { title: string; count: number; live?: boolean }) {
	return (
		<div className='mb-3 flex items-center gap-2.5 px-1'>
			{live && <span className='live-dot' />}
			<h3 className={cn('font-display text-lg font-bold uppercase italic tracking-tight', live ? 'text-live' : 'text-foreground')}>{title}</h3>
			<span className='text-xs font-semibold text-muted-foreground tabular'>{count}</span>
			<span className='h-px flex-1 bg-white/[0.06]' />
		</div>
	);
}

function ResultsSkeleton() {
	return (
		<div className='space-y-5'>
			<div className='glass space-y-4 rounded-2xl p-4 sm:p-5'>
				<div className='space-y-2'>
					<Skeleton className='h-3 w-20' />
					<Skeleton className='h-10 w-44' />
				</div>
				<Skeleton className='h-11 w-full' />
			</div>
			<div className='grid grid-cols-2 gap-3'>
				<Skeleton className='h-28 rounded-2xl' />
				<Skeleton className='h-28 rounded-2xl' />
			</div>
			<GameCardSkeleton />
			<GameCardSkeleton />
		</div>
	);
}

export function Results() {
	const { currentWeek, season, isPastSeason } = useWeek();
	const { leagueId } = useLeague();
	const { data: session, status: sessionStatus } = useSession();
	const [picks, setPicks] = useState<WeeklyPicks | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [leaguePicks, setLeaguePicks] = useState<LeaguePicksData>({});
	const [leagueMode, setLeagueMode] = useState<string>('standard');
	const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>([]);
	const [selectedUserId, setSelectedUserId] = useState<string>('');
	const currentUserId = session?.user?.id;

	// Fetch league mode
	useEffect(() => {
		const fetchLeagueMode = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const leagueData = await response.json();
					setLeagueMode(leagueData.mode || 'standard');
				}
			} catch (error) {
				console.error('[Results] Error fetching league mode:', error);
			}
		};
		fetchLeagueMode();
	}, [leagueId]);

	// Fetch league members (once per league / user — not on every selection change)
	useEffect(() => {
		const fetchLeagueMembers = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}/members`);
				if (response.ok) {
					const members: LeagueMember[] = await response.json();
					setLeagueMembers(members);
					// Default to current user's results
					if (currentUserId) setSelectedUserId(prev => prev || currentUserId);
				}
			} catch (error) {
				console.error('[Results] Error fetching league members:', error);
			}
		};
		if (currentUserId) fetchLeagueMembers();
	}, [leagueId, currentUserId]);

	useEffect(() => {
		const loadData = async (isPolling = false) => {
			if (sessionStatus === 'loading') return;
			if (!selectedUserId) return; // Wait for user selection

			try {
				if (!leagueId) {
					setError('League ID is missing.');
					return;
				}

				// Polls update silently with a small indicator; only the initial load shows skeletons
				if (isPolling) setIsUpdating(true);
				else setLoading(true);

				const allGamesView = selectedUserId === ALL_GAMES;
				const [weeklyGames, leaguePicksResponse, picksResponse] = await Promise.all([
					NFLService.getWeeklyGames(currentWeek, season),
					fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }),
					allGamesView ? Promise.resolve(null) : fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}&userId=${selectedUserId}&season=${season}`, { cache: 'no-store' })
				]);

				// Enrich live games with clock and period data
				const enrichedGames = await NFLService.enrichGamesWithLiveData(weeklyGames);
				const leaguePicksData: LeaguePicksData = await leaguePicksResponse.json();
				const picksData: WeeklyPicks | null = picksResponse ? await picksResponse.json() : null;

				// Fetch odds for Standard mode leagues (same logic as WeeklyPicks)
				const gamesWithOdds = leagueMode === 'standard' ? await withSnapshotOdds(enrichedGames, currentWeek, season) : enrichedGames;

				setGames(gamesWithOdds);
				setPicks(picksData); // null in the "All Games" view
				setLeaguePicks(leaguePicksData);
				setLastUpdated(new Date());
				setError(null);

				if (!allGamesView && !isPastSeason) {
					// The /api/picks endpoint recalculates scores, so notify other components
					window.dispatchEvent(new Event('refreshLeaderboard'));
					window.dispatchEvent(new Event('refreshSeasonStats'));
				}
			} catch (err) {
				console.error('[Results] Error loading results:', err);
				setError('Error loading results');
			} finally {
				setLoading(false);
				setIsUpdating(false);
			}
		};

		loadData(false); // Initial load

		// Smart polling interval: 2 minutes during games, 5 minutes outside game windows
		// A past season's results are final: nothing to poll
		if (isPastSeason) return;
		const pollInterval = setInterval(() => loadData(true), NFLService.getPollingInterval());
		return () => clearInterval(pollInterval);
	}, [currentWeek, season, isPastSeason, sessionStatus, leagueId, selectedUserId, leagueMode]);

	const viewingSelf = selectedUserId === currentUserId;

	const results = useMemo(() => {
		const empty = { live: [] as ResultRow[], upcoming: [] as ResultRow[], final: [] as ResultRow[], totalPoints: 0, correctPicks: 0, tfsPoints: 0 };
		if (!picks || !games.length) return empty;

		let totalPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;

		const rows: ResultRow[] = [];
		picks.picks.forEach((pick, index) => {
			const game = games.find(g => g.id === pick.gameId);
			if (!game) return;

			// If viewing another user's picks, hide games that haven't started (to prevent pick stealing)
			if (!viewingSelf && !hasGameStarted(game)) return;

			const isCorrect = checkPickCorrect(pick, game);
			const finished = hasGameFinished(game);
			const isLock = !!picks.lockGameId && picks.lockGameId === pick.gameId;

			// Points depend on league mode; the lock scores double
			let points = 0;
			if (finished && isCorrect === true) {
				points = ScoringService.pointsForPick(pick, leagueMode, calculatePointsFromOdds, isLock);
				totalPoints += points;
				correctPicks += 1;
			}

			rows.push({ pick, index, game, isCorrect, points, isLock, finished, inProgress: !finished && isLiveStatus(game.status) });
		});

		// Calculate TFS points (only if game is finished)
		if (picks.tfsGame) {
			const tfsGame = games.find(g => g.id === picks.tfsGame);
			const total = tfsGame ? getGameTotal(tfsGame) : undefined;
			if (tfsGame && hasGameFinished(tfsGame) && total !== undefined) {
				tfsPoints = ScoringService.calculateTFSPoints(parseInt(picks.tfsScore), total);
				totalPoints += tfsPoints;
			}
		}

		return {
			live: rows.filter(r => isLiveStatus(r.game.status)),
			upcoming: rows.filter(r => isUpcomingStatus(r.game.status)),
			final: rows.filter(r => isFinalStatus(r.game.status)),
			totalPoints,
			correctPicks,
			tfsPoints
		};
	}, [picks, games, viewingSelf, leagueMode]);

	if (sessionStatus === 'loading' || loading) {
		return <ResultsSkeleton />;
	}

	if (!session) {
		return <EmptyState icon={LogIn} title='Sign in' description='Please sign in to view results.' />;
	}

	const selectedName = leagueMembers.find(m => m._id === selectedUserId)?.name;
	const allGamesView = selectedUserId === ALL_GAMES;

	const header = (
		<div className='glass relative overflow-hidden rounded-2xl p-4 sm:p-5'>
			<div className='pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl' />
			<div className='relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
				<div className='min-w-0'>
					<div className='mb-1.5 flex items-center gap-3'>
						<p className='eyebrow'>Results</p>
						{isUpdating ? (
							<span className='flex items-center gap-1.5 text-[11px] font-medium text-primary'>
								<span className='h-1.5 w-1.5 animate-pulse rounded-full bg-primary' />
								Updating…
							</span>
						) : (
							lastUpdated && (
								<span className='flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground'>
									<span className='h-1.5 w-1.5 rounded-full bg-accent' />
									Updated {getTimeAgo(lastUpdated)}
								</span>
							)
						)}
					</div>
					<h2 className='display-heading text-[2.5rem] sm:text-5xl'>
						Week <span className='text-primary tabular'>{currentWeek}</span>
					</h2>
				</div>
				<Select value={selectedUserId} onValueChange={setSelectedUserId}>
					<SelectTrigger className='w-full sm:w-[220px]' aria-label='View results for'>
						<SelectValue placeholder='Select player' />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_GAMES}>
							<span className='flex items-center gap-2'>
								<span className='grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary'>
									<LayoutGrid className='h-3 w-3' />
								</span>
								<span className='font-semibold'>All games</span>
							</span>
						</SelectItem>
						{leagueMembers.map(member => (
							<SelectItem key={member._id} value={member._id}>
								<span className='flex items-center gap-2'>
									<Avatar className='h-5 w-5 ring-1 ring-white/10'>
										<AvatarImage src={member.image || undefined} alt={member.name} />
										<AvatarFallback className='text-[10px]'>{member.name.charAt(0)}</AvatarFallback>
									</Avatar>
									<span>{member._id === currentUserId ? `${member.name} (you)` : member.name}</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);

	const renderBody = () => {
		// "All Games" view: final and in-progress games only (no upcoming games)
		if (allGamesView) {
			const groups = [
				{ key: 'live', title: 'Live', live: true, games: games.filter(g => isLiveStatus(g.status)) },
				{ key: 'final', title: 'Final', live: false, games: games.filter(g => isFinalStatus(g.status)) }
			].filter(g => g.games.length > 0);

			if (!groups.length) {
				return <EmptyState icon={Tv} title='Nothing final yet' description='No completed or live games yet this week.' />;
			}

			return groups.map(group => (
				<div key={group.key}>
					<GroupLabel title={group.title} count={group.games.length} live={group.live} />
					<div className='space-y-3'>
						{group.games.map((game, index) => (
							<div key={game.id} className='glass animate-slide-up rounded-2xl' style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
								<GameCard game={game} showScores disabled noHover leaguePicks={leaguePicks[game.id]} leagueMode={leagueMode} />
							</div>
						))}
					</div>
				</div>
			));
		}

		if (!picks || !picks.picks.length) {
			return (
				<EmptyState
					icon={ClipboardX}
					title='No picks'
					description={viewingSelf ? 'No picks were made for this week.' : `${selectedName || 'This user'} has not made picks for this week.`}
				/>
			);
		}

		const isSteve = leagueMode === 'steve';
		const groups = [
			{ key: 'live', title: 'Live', live: true, rows: results.live },
			{ key: 'final', title: 'Final', live: false, rows: results.final },
			{ key: 'upcoming', title: 'Upcoming', live: false, rows: results.upcoming }
		].filter(g => g.rows.length > 0);

		// TFS card (Steve mode) — hidden for other users until their TFS game kicks off
		const tfsGame = picks.tfsGame ? games.find(g => g.id === picks.tfsGame) : undefined;
		const showTfs = isSteve && !!tfsGame && (viewingSelf || hasGameStarted(tfsGame));
		const tfsFinished = !!tfsGame && hasGameFinished(tfsGame);
		const tfsTotal = tfsGame ? getGameTotal(tfsGame) : undefined;

		return (
			<>
				{/* Week summary */}
				<div className={cn('grid gap-2 sm:gap-3', isSteve ? 'grid-cols-3' : 'grid-cols-2')}>
					<StatTile
						label='Points'
						icon={Trophy}
						tone='accent'
						className='p-3 sm:p-5'
						value={
							<span className={results.totalPoints > 0 ? 'text-accent' : 'text-muted-foreground'}>
								<CountUp end={results.totalPoints} duration={1} preserveValue />
							</span>
						}
					/>
					<StatTile
						label='Correct'
						icon={CheckCircle2}
						tone='primary'
						className='p-3 sm:p-5'
						value={
							<span>
								<CountUp end={results.correctPicks} duration={1} preserveValue />
								<span className='text-muted-foreground'>/5</span>
							</span>
						}
					/>
					{isSteve && (
						<StatTile
							label='TFS'
							icon={Target}
							tone='warning'
							className='p-3 sm:p-5'
							value={
								<span className={results.tfsPoints > 0 ? 'text-accent' : 'text-muted-foreground'}>
									<CountUp end={results.tfsPoints} duration={1} preserveValue />
								</span>
							}
						/>
					)}
				</div>

				<p className='eyebrow px-1'>{viewingSelf ? 'Your picks' : `${selectedName ?? 'Player'}'s picks`}</p>

				{groups.map(group => (
					<div key={group.key}>
						<GroupLabel title={group.title} count={group.rows.length} live={group.live} />
						<div className='space-y-3'>
							{group.rows.map((row, i) => (
								<div key={row.pick.gameId} className='animate-slide-up' style={{ animationDelay: `${i * 50}ms` }}>
									<PickGameCard
										game={row.game}
										pick={row.pick}
										pickIndex={row.index}
										gameFinished={row.finished}
										gameInProgress={row.inProgress}
										showScores={row.finished || row.inProgress}
										isCorrect={row.isCorrect}
										pickPoints={row.points}
										isLock={row.isLock}
										leaguePicks={leaguePicks[row.pick.gameId]}
										leagueMode={leagueMode}
										variant='results'
									/>
								</div>
							))}
						</div>
					</div>
				))}

				{showTfs && tfsGame && (
					<div className='glass rounded-2xl p-4 sm:p-5'>
						<div className='mb-4 flex items-center justify-between gap-3'>
							<p className='eyebrow'>Total final score</p>
							<div className='flex items-center gap-2'>
								<TeamLogo src={tfsGame.away.logo} alt={tfsGame.away.team} size={24} />
								<span className='font-display text-sm font-bold uppercase italic tracking-tight'>
									{tfsGame.away.abbreviation} <span className='text-muted-foreground'>@</span> {tfsGame.home.abbreviation}
								</span>
								<TeamLogo src={tfsGame.home.logo} alt={tfsGame.home.team} size={24} />
							</div>
						</div>
						<div className='grid grid-cols-3 gap-2'>
							{[
								{ label: 'Guess', value: picks.tfsScore || '—', tone: 'text-foreground' },
								{ label: 'Actual', value: tfsFinished && tfsTotal !== undefined ? tfsTotal : 'TBD', tone: 'text-foreground' },
								{
									label: 'Bonus',
									value: tfsFinished ? `+${results.tfsPoints}` : 'TBD',
									tone: tfsFinished && results.tfsPoints > 0 ? 'text-accent' : 'text-muted-foreground'
								}
							].map(stat => (
								<div key={stat.label} className='rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center'>
									<p className='eyebrow'>{stat.label}</p>
									<p className={cn('mt-1 font-display text-2xl font-extrabold italic tabular', stat.tone)}>{stat.value}</p>
								</div>
							))}
						</div>
					</div>
				)}
			</>
		);
	};

	return (
		<section className='space-y-5'>
			{header}
			{error && (
				<Alert variant='destructive'>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			{renderBody()}
		</section>
	);
}
