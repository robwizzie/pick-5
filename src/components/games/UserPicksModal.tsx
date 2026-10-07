'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamLogo } from '@/components/ui/team-logo';
import { PickGameCard } from './PickGameCard';
import { countLeaguePickers } from './GameCard';
import { NFLService } from '@/services/nflService';
import { hasGameStarted, hasGameFinished } from '@/services/gameUtils';
import { ScoringService } from '@/services/scoringService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { cn } from '@/lib/utils';
import { useWeek } from '@/contexts/WeekContext';
import { useLeagueRules } from '@/contexts/LeagueRulesContext';
import type { Game } from './GameCard';

interface UserPicksModalProps {
	userId: string;
	playerName: string;
	week: number;
	leagueId: string;
	onClose: () => void;
	/** Optional extras for the header; the modal still works without them. */
	playerImage?: string | null;
	weekPoints?: number;
}

interface UserPick {
	gameId: string;
	team: string;
	opponent: string;
	isHome: boolean;
	isCorrect?: boolean | null;
	odds?: number;
}

interface SnapshotOdds {
	id: string;
	home?: { odds?: number };
	away?: { odds?: number };
}

interface LeagueUserPick {
	userId: string;
	name: string;
	image: string | null;
}

interface LeaguePicksData {
	[gameId: string]: {
		away: LeagueUserPick[];
		home: LeagueUserPick[];
	};
}

type GameStatus = 'completed' | 'in_progress' | 'pending';

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

/** Graded once final; ties are losses for both sides (mirrors server scoring). */
const isPickCorrect = (pick: UserPick, game: Game | undefined): boolean | null => {
	if (!game || !hasGameFinished(game)) return null;

	const homeScore = game.home.score;
	const awayScore = game.away.score;
	if (typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;

	return ScoringService.calculatePickResult(pick, { id: game.id, homeScore, awayScore, homeTeam: game.home.team, awayTeam: game.away.team, status: game.status });
};

const checkGameStatus = (game: Game): GameStatus => {
	if (hasGameFinished(game)) return 'completed';
	const status = game.status?.toLowerCase();
	if (status === 'in' || status === 'in_progress') return 'in_progress';
	return 'pending';
};

const getGameTotal = (game: Game) => {
	const { home, away } = game;
	return typeof home.score === 'number' && typeof away.score === 'number' ? home.score + away.score : undefined;
};

export function UserPicksModal({ userId, playerName, week, leagueId, onClose, playerImage, weekPoints }: UserPicksModalProps) {
	const { season } = useWeek();
	const rules = useLeagueRules();
	const { data: session } = useSession();
	const [picks, setPicks] = useState<UserPick[]>([]);
	const [serverHiddenPicks, setServerHiddenPicks] = useState(0);
	const [tfsGame, setTfsGame] = useState<string>('');
	const [tfsScore, setTfsScore] = useState<number | null>(null);
	const [lockGameId, setLockGameId] = useState<string | null>(null);
	const [games, setGames] = useState<Game[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [leagueMode, setLeagueMode] = useState<string>('standard');
	const [leaguePicks, setLeaguePicks] = useState<LeaguePicksData>({});

	// Check if viewing own picks
	const isViewingOwnPicks = session?.user?.id === userId;

	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				setError(null);

				// League mode, games, this user's picks, the league's picks and the odds snapshot are independent
				const [leagueResponse, rawGames, picksResponse, leaguePicksResponse, oddsResponse] = await Promise.all([
					fetch(`/api/league/${leagueId}`),
					NFLService.getWeeklyGames(week, season),
					fetch(`/api/picks/user?week=${week}&leagueId=${leagueId}&userId=${userId}&season=${season}`),
					fetch(`/api/picks/league?week=${week}&leagueId=${leagueId}&season=${season}`, { cache: 'no-store' }),
					fetch(`/api/odds/snapshot?week=${week}&season=${season}`).catch((err: unknown) => {
						console.error('[UserPicksModal] Error fetching odds:', err);
						return null;
					})
				]);

				let fetchedLeagueMode = 'standard';
				if (leagueResponse.ok) {
					const leagueData = await leagueResponse.json();
					fetchedLeagueMode = leagueData.mode || 'standard';
					setLeagueMode(fetchedLeagueMode);
				}

				// Enrich live games with clock and period data
				const weeklyGames = await NFLService.enrichGamesWithLiveData(rawGames);

				if (!picksResponse.ok) {
					throw new Error('Failed to fetch picks');
				}

				const picksData = await picksResponse.json();
				const leaguePicksData: LeaguePicksData = leaguePicksResponse.ok ? await leaguePicksResponse.json() : {};
				setLeaguePicks(leaguePicksData);

				setServerHiddenPicks(0);
				setLockGameId(null);
				if (picksData) {
					// Another player's lock is only sent once that game kicks off
					setLockGameId(picksData.lockGameId ?? null);
					setPicks(picksData.picks || []);
					setServerHiddenPicks(picksData.hiddenPicks || 0);
					setTfsGame(picksData.tfsGame || '');
					setTfsScore(picksData.tfsScore ?? null);
				}

				// Odds only matter for Standard mode leagues
				let gamesWithOdds = weeklyGames;
				if (fetchedLeagueMode === 'standard' && oddsResponse) {
					try {
						let snapshotOdds: SnapshotOdds[] = [];
						if (oddsResponse.ok) {
							const data = await oddsResponse.json();
							snapshotOdds = data.odds || [];
						}

						gamesWithOdds = weeklyGames.map(game => {
							const snapshotGameOdds = snapshotOdds.find(o => o.id === game.id);
							const homeOdds = snapshotGameOdds?.home?.odds;
							const awayOdds = snapshotGameOdds?.away?.odds;

							if (homeOdds || awayOdds) {
								return {
									...game,
									home: { ...game.home, odds: homeOdds },
									away: { ...game.away, odds: awayOdds }
								};
							}
							return game;
						});
					} catch (error) {
						console.error('[UserPicksModal] Error fetching odds:', error);
					}
				}

				setGames(gamesWithOdds);
			} catch (err) {
				console.error('Error loading user picks:', err);
				setError('Error loading picks');
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, [userId, week, leagueId, season]);

	// For other users: only show picks for games that have started. For own picks: show all.
	const visiblePicks = picks
		.map(pick => ({ pick, game: games.find(g => g.id === pick.gameId) }))
		.filter((p): p is { pick: UserPick; game: Game } => !!p.game && (isViewingOwnPicks || hasGameStarted(p.game)))
		.map(({ pick, game }) => {
			const status = checkGameStatus(game);
			const gameFinished = status === 'completed';
			const isCorrect = isPickCorrect(pick, game);
			const isLock = !!lockGameId && lockGameId === pick.gameId;

			// Points depend on league mode; the lock scores double
			const pickPoints = gameFinished && isCorrect === true ? ScoringService.pointsForPick(pick, { ...rules, mode: leagueMode }, calculatePointsFromOdds, isLock) : 0;
			return { pick, game, status, gameFinished, gameInProgress: status === 'in_progress', isCorrect, isLock, pickPoints };
		});

	// Picks for games that haven't kicked off are withheld by the server; it sends the count
	const hiddenCount = picks.length - visiblePicks.length + serverHiddenPicks;
	const computedPoints = visiblePicks.reduce((sum, p) => sum + p.pickPoints, 0);
	const correctCount = visiblePicks.filter(p => p.gameFinished && p.isCorrect === true).length;
	const gradedCount = visiblePicks.filter(p => p.gameFinished).length;
	const headerPoints = weekPoints ?? computedPoints;

	// TFS prediction: other users only once that game has started
	const tfsGameObj = tfsGame ? games.find(g => g.id === tfsGame) : undefined;
	const tfsGameStarted = tfsGameObj ? hasGameStarted(tfsGameObj) : false;
	const showTfs = !!tfsGameObj && (isViewingOwnPicks || tfsGameStarted);
	const tfsTotal = tfsGameObj ? getGameTotal(tfsGameObj) : undefined;
	const tfsFinished = tfsGameObj ? hasGameFinished(tfsGameObj) : false;

	return (
		<Dialog open onOpenChange={open => !open && onClose()}>
			<DialogContent className='gap-0 sm:max-w-2xl'>
				{/* Player header */}
				<DialogHeader className='mb-5 flex-row items-center gap-3.5 space-y-0'>
					<Avatar className='h-14 w-14 ring-2 ring-primary/40 ring-offset-2 ring-offset-[hsl(var(--surface-raised))]'>
						<AvatarImage src={playerImage || undefined} alt={playerName} />
						<AvatarFallback className='bg-primary/15 text-sm font-bold text-primary'>{initials(playerName)}</AvatarFallback>
					</Avatar>
					<div className='min-w-0 flex-1'>
						<p className='eyebrow'>Week {week} picks</p>
						<DialogTitle className='mt-1 truncate'>{playerName}</DialogTitle>
						<DialogDescription className='mt-1 text-xs tabular'>
							{loading ? 'Loading picks…' : gradedCount > 0 ? `${correctCount}/${gradedCount} correct so far` : `${visiblePicks.length} pick${visiblePicks.length === 1 ? '' : 's'} shown`}
						</DialogDescription>
					</div>
					<div className='shrink-0 text-right'>
						<p className='font-display text-4xl font-extrabold italic leading-none tabular text-accent'>{loading && weekPoints === undefined ? '–' : headerPoints}</p>
						<p className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>Points</p>
					</div>
				</DialogHeader>

				{error && <div className='mb-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive'>{error}</div>}

				{loading ? (
					<div className='space-y-3'>
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className='h-36 rounded-2xl' />
						))}
					</div>
				) : (
					<div className='space-y-3'>
						{picks.length === 0 ? (
							<div className='rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground'>No picks found</div>
						) : (
							visiblePicks.map((p, displayIndex) => (
								<div key={p.pick.gameId} className='animate-slide-up' style={{ animationDelay: `${displayIndex * 60}ms` }}>
									<PickGameCard
										game={p.game}
										pick={p.pick}
										pickIndex={displayIndex}
										gameFinished={p.gameFinished}
										gameInProgress={p.gameInProgress}
										showScores={p.gameFinished || p.gameInProgress}
										isCorrect={p.isCorrect}
										pickPoints={p.pickPoints}
										isLock={p.isLock}
										leaguePicks={p.gameFinished || p.gameInProgress ? leaguePicks[p.pick.gameId] : undefined}
										leagueSize={countLeaguePickers(leaguePicks)}
										leagueMode={leagueMode}
										variant='picks'
									/>
								</div>
							))
						)}

						{hiddenCount > 0 && !isViewingOwnPicks && (
							<div className='flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground'>
								<Lock className='h-4 w-4 shrink-0' />
								<span>
									<span className='font-semibold text-foreground tabular'>{hiddenCount}</span> more pick{hiddenCount === 1 ? '' : 's'} revealed at kickoff
								</span>
							</div>
						)}

						{/* Total Final Score prediction */}
						{showTfs && tfsGameObj && (
							<div className='rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4'>
								<div className='mb-3 flex items-center gap-2'>
									<span className='grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary'>
										<Target className='h-3.5 w-3.5' />
									</span>
									<p className='eyebrow'>Total final score</p>
								</div>
								<div className='mb-4 flex items-center gap-2'>
									<TeamLogo src={tfsGameObj.away.logo} alt={tfsGameObj.away.team} size={28} />
									<span className='font-display text-base font-bold uppercase italic tracking-tight'>{tfsGameObj.away.abbreviation}</span>
									<span className='font-display text-sm italic text-muted-foreground'>@</span>
									<span className='font-display text-base font-bold uppercase italic tracking-tight'>{tfsGameObj.home.abbreviation}</span>
									<TeamLogo src={tfsGameObj.home.logo} alt={tfsGameObj.home.team} size={28} />
								</div>
								<div className='grid grid-cols-2 gap-2'>
									<div className='rounded-xl bg-primary/[0.08] px-3 py-2.5 ring-1 ring-primary/20'>
										<p className='eyebrow text-[10px]'>Predicted</p>
										<p className='mt-1 font-display text-3xl font-extrabold italic leading-none tabular text-primary'>{tfsScore ?? '–'}</p>
									</div>
									<div className='rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.07]'>
										<p className='eyebrow text-[10px]'>Actual</p>
										<p className={cn('mt-1 font-display font-extrabold italic leading-none tabular', tfsFinished && tfsTotal !== undefined ? 'text-3xl' : 'pt-1.5 text-lg text-muted-foreground')}>
											{tfsFinished && tfsTotal !== undefined ? tfsTotal : tfsGameStarted ? 'In progress' : 'TBD'}
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
