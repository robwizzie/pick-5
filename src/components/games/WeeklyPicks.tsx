'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ArrowLeftRight, CalendarX, Check, Eye, EyeOff, Lock, LogIn, Pencil, RefreshCw, Target, TrendingUp, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, Pill } from '@/components/ui/page';
import { GameCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { TeamLogo } from '@/components/ui/team-logo';
import { GameCard } from './GameCard';
import { PickGameCard } from './PickGameCard';
import { NFLService } from '@/services/nflService';
import { LOCK_MULTIPLIER, ScoringService } from '@/services/scoringService';
import { useStats } from '@/contexts/StatsContext';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { hasGameStarted, hasGameFinished, haveAllPickedGamesStarted } from '@/services/gameUtils';
import { calculatePointsFromOdds, formatOdds, getOddsBadgeClass } from '@/utils/oddsUtils';
import { cn } from '@/lib/utils';
import type { Game } from './GameCard';

interface SeasonStatus {
	isActive: boolean;
	seasonYear: number;
	currentWeek: number;
	canSubmitPicks: boolean;
	message?: string;
}

interface UserPick {
	userId: string;
	name: string;
	image: string | null;
}

interface LeaguePicksData {
	[gameId: string]: {
		away: UserPick[];
		home: UserPick[];
	};
}

interface Pick {
	gameId: string;
	team: string;
	opponent: string;
	isHome: boolean;
	odds?: number;
}

interface SnapshotOdds {
	id: string;
	home?: { odds?: number };
	away?: { odds?: number };
}

const MAX_PICKS = 5;

const TFS_SCALE = [
	{ label: 'Exact score', points: 5 },
	{ label: 'Within 1–3', points: 4 },
	{ label: 'Within 4–5', points: 3 },
	{ label: 'Within 6–7', points: 2 },
	{ label: 'Within 8–10', points: 1 }
];

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

/** Grade a pick against the current score. Mirrors server scoring: ties are losses for both sides. */
function gradePick(pick: Pick, game: Game | undefined): boolean | null {
	if (!game) return null;
	if (typeof game.home.score !== 'number' || typeof game.away.score !== 'number') return null;
	return ScoringService.calculatePickResult(pick, {
		id: game.id,
		homeScore: game.home.score,
		awayScore: game.away.score,
		homeTeam: game.home.team,
		awayTeam: game.away.team,
		status: game.status
	});
}

/** Points available for a pick at the current line (standard mode), doubled for the lock. */
function potentialPoints(pick: Pick, game: Game | undefined, isLock = false) {
	const team = pick.isHome ? game?.home : game?.away;
	return team?.odds ? ScoringService.pointsForPick({ odds: team.odds }, 'standard', calculatePointsFromOdds, isLock) : 0;
}

/** Steve mode: 2 per correct pick, doubled for the lock. */
const STEVE_PICK_POINTS = ScoringService.pointsForPick({}, 'steve');
const TFS_MAX = 5;
// Short enough for the sticky bar at 375px
const LOCK_HINT = 'Pick a Lock to double one pick';

/** Lock of the week toggle: tap to lock this pick (moves the lock), tap the locked pick to clear it. */
function LockToggle({ active, onToggle, team, compact = false }: { active: boolean; onToggle: () => void; team: string; compact?: boolean }) {
	return (
		<button
			type='button'
			aria-pressed={active}
			aria-label={active ? `Remove ${team} as your lock of the week` : `Make ${team} your lock of the week`}
			onClick={onToggle}
			className={cn(
				'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ease-out-expo active:scale-95',
				compact ? 'w-8 justify-center' : 'px-3',
				active
					? 'border-warning/70 bg-warning/15 text-warning shadow-[0_0_0_1px_hsl(var(--warning)/0.35),0_8px_24px_-10px_hsl(var(--warning)/0.7)]'
					: 'border-white/10 bg-white/[0.04] text-muted-foreground hover:border-warning/40 hover:text-warning'
			)}
		>
			<Lock className='h-3.5 w-3.5' strokeWidth={active ? 3 : 2} aria-hidden />
			{!compact && (active ? <span className='tabular'>Lock · {LOCK_MULTIPLIER}×</span> : 'Lock')}
		</button>
	);
}

function PickProgress({ count, className }: { count: number; className?: string }) {
	return (
		<div className={cn('flex gap-1', className)} role='progressbar' aria-valuemin={0} aria-valuemax={MAX_PICKS} aria-valuenow={count} aria-label={`${count} of ${MAX_PICKS} picks made`}>
			{Array.from({ length: MAX_PICKS }).map((_, i) => (
				<span
					key={i}
					className={cn(
						'h-1.5 flex-1 rounded-full transition-all duration-300 ease-out-expo',
						i < count ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)]' : 'bg-white/[0.08]'
					)}
				/>
			))}
		</div>
	);
}

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

function WeeklyPicksSkeleton() {
	return (
		<div className='space-y-5'>
			<div className='glass space-y-4 rounded-2xl p-4 sm:p-5'>
				<div className='flex items-end justify-between gap-3'>
					<div className='space-y-2'>
						<Skeleton className='h-3 w-24' />
						<Skeleton className='h-10 w-40' />
					</div>
					<Skeleton className='h-6 w-24 rounded-full' />
				</div>
				<Skeleton className='h-1.5 w-full' />
			</div>
			{Array.from({ length: 3 }).map((_, i) => (
				<GameCardSkeleton key={i} />
			))}
		</div>
	);
}

export function WeeklyPicks() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session, status: sessionStatus } = useSession();
	const { refreshStats } = useStats();
	const [games, setGames] = useState<Game[]>([]);
	const [picks, setPicks] = useState<Pick[]>([]);
	const [tfsGame, setTfsGame] = useState('');
	const [tfsScore, setTfsScore] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [hasExistingPicks, setHasExistingPicks] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const initialLoadRef = useRef(true);
	const lastSavedRef = useRef<{ picks: Pick[]; tfsGame: string; tfsScore: string; lockGameId: string | null } | null>(null);
	const [leaguePicks, setLeaguePicks] = useState<LeaguePicksData>({});
	const [leagueMode, setLeagueMode] = useState<string>('');
	const [tfsError, setTfsError] = useState<string | null>(null);
	const [picksLoaded, setPicksLoaded] = useState(false);
	const [seasonStatus, setSeasonStatus] = useState<SeasonStatus | null>(null);
	const [showAllGames, setShowAllGames] = useState(false);
	const [swapCandidate, setSwapCandidate] = useState<Pick | null>(null);
	const [lockGameId, setLockGameId] = useState<string | null>(null);

	// Fetch league details to get the mode
	useEffect(() => {
		const fetchLeagueDetails = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}`);
				if (response.ok) {
					const data = await response.json();
					setLeagueMode(data.mode || 'standard');
				}
			} catch (error) {
				console.error('[WeeklyPicks] Error fetching league details:', error);
			}
		};
		fetchLeagueDetails();
	}, [leagueId]);

	// Fetch season status
	useEffect(() => {
		const fetchSeasonStatus = async () => {
			try {
				const response = await fetch('/api/season/status');
				if (response.ok) {
					const data = await response.json();
					setSeasonStatus(data);
				}
			} catch (error) {
				console.error('[WeeklyPicks] Error fetching season status:', error);
			}
		};
		fetchSeasonStatus();
	}, []);

	// Initial load (and week / league change): games first, then picks so we can check game status
	useEffect(() => {
		// Only load games if we know the league mode
		if (!leagueMode) return;

		initialLoadRef.current = true; // Reset for new week
		lastSavedRef.current = null; // Reset last saved for new week
		setPicksLoaded(false); // Reset picks loaded state for new week
		setShowAllGames(false);
		setSwapCandidate(null);

		let cancelled = false;
		(async () => {
			const loadedGames = await loadWeeklyGames();
			if (cancelled || loadedGames === null) return;
			if (sessionStatus === 'authenticated' && loadedGames.length > 0) {
				await Promise.all([loadExistingPicks(loadedGames), loadLeaguePicks()]);
			} else {
				setPicksLoaded(true);
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeek, session?.user?.id, sessionStatus, leagueMode]);

	// Auto-refresh live games with smart polling. Refreshes are silent: no loading state, no picks reload
	// (which would clobber unsaved local edits).
	useEffect(() => {
		if (!games.some(g => isLiveStatus(g.status))) return; // No polling needed when no games are live

		const pollTimer = setInterval(async () => {
			const refreshed = await loadWeeklyGames(true);
			if (!refreshed) return;
			loadLeaguePicks();
			// Lock the slate once every saved pick has kicked off
			const saved = lastSavedRef.current?.picks;
			if (saved && haveAllPickedGamesStarted(saved, refreshed)) setSubmitted(true);
		}, NFLService.getPollingInterval());

		return () => clearInterval(pollTimer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [games]); // Re-evaluate when games change

	/** Fetch games (+ live data, + odds in standard mode). Returns the loaded games, or null if skipped. */
	const loadWeeklyGames = async (silent = false): Promise<Game[] | null> => {
		if (sessionStatus === 'loading') return null;

		try {
			if (!silent) setLoading(true);
			let weeklyGames = await NFLService.getWeeklyGames(currentWeek);

			// Enrich live games with clock and period data
			weeklyGames = await NFLService.enrichGamesWithLiveData(weeklyGames);

			// Fetch odds for Standard mode leagues
			if (leagueMode === 'standard') {
				try {
					// Fetch odds from centralized snapshot (reduces API calls dramatically)
					const oddsResponse = await fetch(`/api/odds/snapshot?week=${currentWeek}`);
					let snapshotOdds: SnapshotOdds[] = [];
					if (oddsResponse.ok) {
						const data = await oddsResponse.json();
						snapshotOdds = data.odds || [];
					}

					// If no snapshot odds available, fall back to user's stored odds from picks
					const storedOddsMap = new Map<string, { homeOdds?: number; awayOdds?: number }>();
					if (snapshotOdds.length === 0 && leagueId) {
						const picksResponse = await fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}`);
						if (picksResponse.ok) {
							const picksData = await picksResponse.json();
							if (picksData?.picks) {
								picksData.picks.forEach((pick: { gameId: string; odds?: number; isHome: boolean }) => {
									if (!pick.odds) return;
									const gameOdds = storedOddsMap.get(pick.gameId) ?? {};
									if (pick.isHome) gameOdds.homeOdds = pick.odds;
									else gameOdds.awayOdds = pick.odds;
									storedOddsMap.set(pick.gameId, gameOdds);
								});
							}
						}
					}

					// Match odds to games
					weeklyGames = weeklyGames.map(game => {
						const snapshotGameOdds = snapshotOdds.find(o => o.id === game.id);
						const storedOdds = storedOddsMap.get(game.id);
						const homeOdds = snapshotGameOdds?.home?.odds || storedOdds?.homeOdds;
						const awayOdds = snapshotGameOdds?.away?.odds || storedOdds?.awayOdds;

						if (homeOdds || awayOdds) {
							return {
								...game,
								home: { ...game.home, odds: homeOdds },
								away: { ...game.away, odds: awayOdds }
							};
						}
						return game;
					});
				} catch (oddsError) {
					console.error('[WeeklyPicks] Error fetching odds:', oddsError);
				}
			}

			setGames(weeklyGames);
			return weeklyGames;
		} catch (error) {
			console.error('[WeeklyPicks] Error loading weekly games:', error);
			// Keep showing the last good data if a background refresh fails
			if (silent) return null;
			setGames([]);
			setError('Error loading games');
			return [];
		} finally {
			if (!silent) setLoading(false);
		}
	};

	const loadExistingPicks = async (gamesList: Game[] = games) => {
		if (sessionStatus !== 'authenticated' || !leagueId) {
			setPicksLoaded(true);
			return;
		}

		try {
			const response = await fetch(`/api/picks?week=${currentWeek}&leagueId=${leagueId}`);
			const data = await response.json();

			if (data) {
				const loadedPicks: Pick[] = data.picks || [];
				const loadedTfsGame = data.tfsGame || '';
				const loadedTfsScore = data.tfsScore?.toString() || '';
				const loadedLock: string | null = typeof data.lockGameId === 'string' && loadedPicks.some(p => p.gameId === data.lockGameId) ? data.lockGameId : null;

				setPicks(loadedPicks);
				setLockGameId(loadedLock);
				setTfsGame(loadedTfsGame);
				setTfsScore(loadedTfsScore);
				setHasExistingPicks(true);

				// Update last saved ref to match loaded data
				lastSavedRef.current = { picks: [...loadedPicks], tfsGame: loadedTfsGame, tfsScore: loadedTfsScore, lockGameId: loadedLock };

				// Only lock the slate once all picked games have started; edits are allowed until then
				setSubmitted(haveAllPickedGamesStarted(loadedPicks, gamesList));
			} else {
				setPicks([]);
				setLockGameId(null);
				setTfsGame('');
				setTfsScore('');
				setSubmitted(false);
				setHasExistingPicks(false);
				lastSavedRef.current = null;
			}

			// Mark initial load as complete after a short delay
			setTimeout(() => {
				initialLoadRef.current = false;
			}, 500);
		} catch (error) {
			console.error('[WeeklyPicks] Error loading picks:', error);
			setError('Error loading picks');
		} finally {
			setPicksLoaded(true);
		}
	};

	const loadLeaguePicks = async () => {
		if (!leagueId) return;

		try {
			const response = await fetch(`/api/picks/league?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' });
			if (response.ok) {
				const data = await response.json();
				setLeaguePicks(data);
			}
		} catch (error) {
			console.error('[WeeklyPicks] Error loading league picks:', error);
		}
	};

	const validateTfsScore = (value: string): string | null => {
		if (!value || value.trim() === '') return 'Total Final Score is required';
		const numValue = parseInt(value);
		if (isNaN(numValue)) return 'Please enter a valid number';
		if (numValue < 0) return 'Score cannot be negative';
		if (numValue > 200) return 'Score seems unrealistically high (max 200)';
		if (!Number.isInteger(parseFloat(value))) return 'Score must be a whole number';
		return null;
	};

	const handleTfsScoreChange = (value: string) => {
		setTfsScore(value);
		setTfsError(value ? validateTfsScore(value) : null);
	};

	// The lock must be one of the current picks (the server enforces this too)
	const activeLock = lockGameId && picks.some(p => p.gameId === lockGameId) ? lockGameId : null;

	const buildRequestBody = () => {
		const requestBody: {
			week: number;
			picks: Pick[];
			leagueId: string;
			lockGameId: string | null;
			tfsGame?: string;
			tfsScore?: number;
		} = {
			week: currentWeek,
			picks,
			leagueId: leagueId as string,
			lockGameId: activeLock
		};

		// Only include TFS for Steve mode
		if (leagueMode === 'steve') {
			requestBody.tfsGame = tfsGame;
			requestBody.tfsScore = parseInt(tfsScore);
		}
		return requestBody;
	};

	const dispatchRefreshEvents = () => {
		window.dispatchEvent(new CustomEvent('refreshLeaderboard'));
		window.dispatchEvent(new CustomEvent('refreshSeasonStats'));
	};

	const autoSave = async (isUpdate: boolean = false) => {
		// For Steve mode, require TFS. For Standard mode, don't require it
		const hasRequiredFields = leagueMode === 'steve' ? picks.length === MAX_PICKS && tfsGame && !isNaN(parseInt(tfsScore)) : picks.length === MAX_PICKS;

		if (!session || !leagueId || !hasRequiredFields) return; // Don't save if incomplete

		// Check if picks have actually changed
		const currentState = JSON.stringify({ picks, tfsGame, tfsScore, lockGameId: activeLock });
		if (lastSavedRef.current) {
			const { picks: savedPicks, tfsGame: savedTfsGame, tfsScore: savedTfsScore, lockGameId: savedLock } = lastSavedRef.current;
			const lastSavedState = JSON.stringify({ picks: savedPicks, tfsGame: savedTfsGame, tfsScore: savedTfsScore, lockGameId: savedLock });
			if (currentState === lastSavedState) return; // No changes, skip save
		}

		try {
			setIsSaving(true);
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildRequestBody())
			});

			if (response.ok) {
				setHasExistingPicks(true);
				toast.success(isUpdate ? 'Picks updated successfully!' : 'Picks saved!');

				// Update last saved ref to prevent loop
				lastSavedRef.current = { picks: [...picks], tfsGame, tfsScore, lockGameId: activeLock };

				// Dispatch refresh events (don't reload picks to avoid triggering loop)
				dispatchRefreshEvents();
			} else {
				const { error } = await response.json();
				toast.error(error || 'Failed to save picks');
			}
		} catch (err) {
			console.error('[WeeklyPicks] Error auto-saving picks:', err);
			toast.error('Error saving picks');
		} finally {
			setIsSaving(false);
		}
	};

	const handleTeamSelect = (gameId: string, selectedTeam: string, opponent: string, isHome: boolean, odds?: number) => {
		if (!session) {
			setError('Please sign in to make picks');
			return;
		}

		const nextPick: Pick = { gameId, team: selectedTeam, opponent, isHome, odds };

		// Slate is full and this is a new game: ask which pick to swap out
		if (picks.length >= MAX_PICKS && !picks.some(p => p.gameId === gameId)) {
			setSwapCandidate(nextPick);
			return;
		}
		setSwapCandidate(null);

		// Unpicking the locked game clears the lock
		const existingPick = picks.find(p => p.gameId === gameId);
		if (existingPick && existingPick.team === selectedTeam && lockGameId === gameId) setLockGameId(null);

		setPicks(current => {
			const existing = current.findIndex(p => p.gameId === gameId);
			// If clicking already selected team, remove it
			if (existing !== -1 && current[existing].team === selectedTeam) {
				return current.filter((_, i) => i !== existing);
			}
			// Otherwise update/add pick
			if (existing !== -1) {
				const newPicks = [...current];
				newPicks[existing] = nextPick;
				return newPicks;
			}
			if (current.length >= MAX_PICKS) return current;
			return [...current, nextPick];
		});
	};

	const handleSwap = (index: number) => {
		if (!swapCandidate) return;
		const incoming = swapCandidate;
		const outgoing = picks[index];
		setPicks(current => current.map((p, i) => (i === index ? incoming : p)));
		// The TFS game must be one of the picks
		if (outgoing && tfsGame === outgoing.gameId) setTfsGame('');
		// So must the lock
		if (outgoing && lockGameId === outgoing.gameId) setLockGameId(null);
		setSwapCandidate(null);
	};

	// Auto-save when picks, TFS game, or score changes (only if we have existing picks)
	useEffect(() => {
		// For Steve mode, require TFS. For Standard mode, don't require it
		const hasRequiredFields = leagueMode === 'steve' ? picks.length === MAX_PICKS && tfsGame && tfsScore && !isNaN(parseInt(tfsScore)) : picks.length === MAX_PICKS;

		// Don't auto-save on initial load or if incomplete
		if (initialLoadRef.current || !hasExistingPicks || !hasRequiredFields || isSaving) return;

		// Clear any pending auto-save
		if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

		// Debounce auto-save
		saveTimeoutRef.current = setTimeout(() => {
			autoSave(true); // Pass true to indicate this is an update
		}, 1000);

		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [picks, tfsGame, tfsScore, lockGameId, hasExistingPicks]);

	const toggleLock = (gameId: string) => setLockGameId(current => (current === gameId ? null : gameId));

	const handleSubmit = async () => {
		if (!session) {
			setError('Please sign in to submit picks');
			return;
		}

		if (picks.length !== MAX_PICKS) {
			toast.error('Please select exactly 5 games');
			return;
		}

		// TFS validation only for Steve mode
		if (leagueMode === 'steve') {
			if (!tfsGame) {
				toast.error('Please select a TFS game');
				return;
			}

			const tfsValidationError = validateTfsScore(tfsScore);
			if (tfsValidationError) {
				setTfsError(tfsValidationError);
				toast.error(tfsValidationError);
				return;
			}
		}

		if (!leagueId) {
			toast.error('League ID is missing');
			return;
		}

		// Clear any pending auto-save
		if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

		try {
			setIsSaving(true);
			const response = await fetch('/api/picks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildRequestBody())
			});

			if (response.ok) {
				setHasExistingPicks(true);
				setError(null);
				toast.success(hasExistingPicks ? 'Picks updated successfully!' : 'Picks locked in. Good luck!');
				if (!hasExistingPicks) import('@/lib/confetti').then(m => m.picksLockedConfetti());

				// Update last saved ref to prevent duplicate saves
				lastSavedRef.current = { picks: [...picks], tfsGame, tfsScore, lockGameId: activeLock };

				// Reload games and picks (silently) to check if all games have started
				const refreshed = await loadWeeklyGames(true);
				await loadExistingPicks(refreshed ?? games);

				// Trigger Leaderboard and Stats refresh (once)
				dispatchRefreshEvents();
				await refreshStats();
			} else {
				const { error } = await response.json();
				toast.error(error || 'Failed to submit picks');
			}
		} catch (err) {
			console.error('[WeeklyPicks] Error submitting picks:', err);
			toast.error('An unexpected error occurred');
		} finally {
			setIsSaving(false);
		}
	};

	if (sessionStatus === 'loading' || loading || !picksLoaded) {
		return <WeeklyPicksSkeleton />;
	}

	if (!session) {
		return <EmptyState icon={LogIn} title='Sign in to play' description='Please sign in to make picks.' />;
	}

	const isSteve = leagueMode === 'steve';
	const pickCount = picks.length;
	const slateFull = pickCount === MAX_PICKS;
	const totalPotential = isSteve
		? picks.reduce((total, pick) => total + ScoringService.pointsForPick(pick, 'steve', undefined, pick.gameId === activeLock), 0) + (tfsGame ? TFS_MAX : 0)
		: picks.reduce((total, pick) => total + potentialPoints(pick, games.find(g => g.id === pick.gameId), pick.gameId === activeLock), 0);
	// Picks (and the lock) can be changed until the first picked game kicks off (server rule)
	const slateEditable = !picks.some(p => {
		const game = games.find(g => g.id === p.gameId);
		return !!game && hasGameStarted(game);
	});
	const lockedPick = activeLock ? picks.find(p => p.gameId === activeLock) : undefined;
	const tfsReady = !!tfsGame && !!tfsScore && !tfsError;
	const canSubmit = slateFull && !isSaving && (!isSteve || tfsReady);
	// Saved picks auto-save; show where that stands instead of a redundant Update button
	const saved = lastSavedRef.current;
	const isDirty = !!saved && JSON.stringify({ picks, tfsGame, tfsScore, lockGameId: activeLock }) !== JSON.stringify({ picks: saved.picks, tfsGame: saved.tfsGame, tfsScore: saved.tfsScore, lockGameId: saved.lockGameId });
	const saveState: 'saving' | 'saved' | 'incomplete' | 'pending' = isSaving ? 'saving' : !isDirty ? 'saved' : canSubmit ? 'pending' : 'incomplete';
	const showActionBar = !submitted && (pickCount > 0 || !!swapCandidate);

	const renderPickCard = (pick: Pick, index: number, game: Game) => {
		const gameFinished = hasGameFinished(game);
		const gameInProgress = isLiveStatus(game.status);
		const isCorrect = gradePick(pick, game);
		return (
			<PickGameCard
				key={game.id}
				game={game}
				pick={pick}
				pickIndex={index}
				gameFinished={gameFinished}
				gameInProgress={gameInProgress}
				showScores
				isCorrect={isCorrect}
				pickPoints={gameFinished && isCorrect ? ScoringService.pointsForPick(pick, leagueMode, calculatePointsFromOdds, pick.gameId === activeLock) : 0}
				isLock={pick.gameId === activeLock}
				leaguePicks={gameFinished || gameInProgress ? leaguePicks[game.id] : undefined}
				leagueMode={leagueMode}
				variant='results'
			/>
		);
	};

	const renderGameCard = (game: Game) => {
		const pickIndex = picks.findIndex(p => p.gameId === game.id);
		const pick = pickIndex !== -1 ? picks[pickIndex] : undefined;
		const gameStarted = hasGameStarted(game);
		const gameFinished = hasGameFinished(game);

		// Finished game with a pick: show the graded pick card
		if (gameFinished && pick) return renderPickCard(pick, pickIndex, game);

		// When browsing all games with a full slate, unpicked games stay tappable to start a swap
		const lockedBySlate = slateFull && !pick && !showAllGames;
		const isSwapTarget = swapCandidate?.gameId === game.id;
		const isLock = !!pick && pick.gameId === activeLock;

		return (
			<div
				key={game.id}
				className={cn(
					'glass rounded-2xl transition-shadow duration-300',
					pick && !isLock && 'border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_18px_40px_-24px_hsl(var(--primary)/0.6)]',
					isLock && 'border-warning/40 shadow-[0_0_0_1px_hsl(var(--warning)/0.2),0_18px_40px_-24px_hsl(var(--warning)/0.6)]',
					isSwapTarget && 'border-warning/40 ring-1 ring-warning/40'
				)}
			>
				<GameCard
					game={game}
					selected={pick?.team}
					onSelect={handleTeamSelect}
					disabled={gameStarted || lockedBySlate}
					showScores={gameStarted}
					leaguePicks={gameStarted || gameFinished ? leaguePicks[game.id] : undefined}
					leagueMode={leagueMode}
					lockedTeam={isLock ? pick.team : undefined}
				/>
				{pick && slateEditable && (
					<div className='flex items-center justify-between gap-3 border-t border-white/[0.06] py-2 pl-4 pr-3'>
						<p className={cn('min-w-0 truncate text-xs', isLock ? 'font-semibold text-warning' : 'text-muted-foreground')}>
							{isLock ? `${(pick.isHome ? game.home : game.away).abbreviation} is your Lock of the Week` : 'Lock it in for double points'}
						</p>
						<LockToggle active={isLock} team={pick.team} onToggle={() => toggleLock(pick.gameId)} />
					</div>
				)}
			</div>
		);
	};

	// When 5 picks are made, only show picked games to reduce clutter (unless the user asks for all)
	const gamesToShow = slateFull && !showAllGames ? games.filter(g => picks.some(p => p.gameId === g.id)) : games;
	const groups = [
		// Pickable games first; started games can't be picked any more
		{ key: 'upcoming', title: 'Upcoming', live: false, games: gamesToShow.filter(g => isUpcomingStatus(g.status)) },
		{ key: 'live', title: 'Live', live: true, games: gamesToShow.filter(g => isLiveStatus(g.status)) },
		{ key: 'final', title: 'Final', live: false, games: gamesToShow.filter(g => isFinalStatus(g.status)) }
	].filter(group => group.games.length > 0);

	const actionHint = (() => {
		if (!slateFull) return hasExistingPicks ? `Pick ${MAX_PICKS - pickCount} more to save your changes` : `Pick ${MAX_PICKS - pickCount} more game${MAX_PICKS - pickCount === 1 ? '' : 's'}`;
		if (isSteve) {
			if (!tfsGame) return 'Choose your TFS game below';
			if (!tfsScore || tfsError) return 'Enter your total score below';
			if (!activeLock && slateEditable) return LOCK_HINT;
			return `TFS locked in: ${tfsScore}`;
		}
		if (!activeLock && slateEditable) return LOCK_HINT;
		return hasExistingPicks ? 'Changes save automatically' : 'Ready to submit';
	})();

	return (
		<section className='space-y-5'>
			{/* Header */}
			<div className='glass relative overflow-hidden rounded-2xl p-4 sm:p-5'>
				<div className='pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl' />
				<div className='relative flex items-center justify-between gap-3'>
					<div className='min-w-0'>
						<p className='eyebrow mb-1'>{submitted ? 'Your slate' : 'Make your picks'}</p>
						<h2 className='font-display text-2xl font-extrabold uppercase italic leading-none tracking-tight sm:text-4xl'>
							Week <span className='text-primary tabular'>{currentWeek}</span>
						</h2>
						{!submitted && <p className='mt-1.5 text-xs text-muted-foreground'>Tap a team to pick it. You can change picks until your first picked game kicks off.</p>}
					</div>
					<div className='flex shrink-0 flex-col items-end gap-1.5'>
						{isSteve ? (
							<Pill tone='warning'>
								<Target className='h-3 w-3' /> Steve · TFS
							</Pill>
						) : (
							<Pill tone='primary'>
								<TrendingUp className='h-3 w-3' /> Standard · Odds
							</Pill>
						)}
						{submitted && (
							<Pill tone='muted'>
								<Lock className='h-3 w-3' /> Locked
							</Pill>
						)}
					</div>
				</div>
				<div className='relative mt-3 flex items-center gap-3'>
					<PickProgress count={pickCount} className='flex-1' />
					<span className='text-xs font-semibold text-muted-foreground tabular'>
						<span className='text-foreground'>{pickCount}</span>/{MAX_PICKS}
					</span>
				</div>
			</div>

			{error && (
				<Alert variant='destructive' className='flex items-start justify-between gap-3'>
					<AlertDescription>{error}</AlertDescription>
					<button type='button' onClick={() => setError(null)} className='-m-1 rounded p-1 text-destructive/80 hover:text-destructive' aria-label='Dismiss'>
						<X className='h-4 w-4' />
					</button>
				</Alert>
			)}

			{/* Season Ended Banner */}
			{seasonStatus && !seasonStatus.canSubmitPicks && (
				<Alert variant='warning'>
					<CalendarX />
					<AlertDescription>{seasonStatus.message || 'The NFL regular season has ended. Check out the League History to see past season standings!'}</AlertDescription>
				</Alert>
			)}

			{submitted ? (
				<div className='space-y-3'>
					{picks.map((pick, index) => {
						const game = games.find(g => g.id === pick.gameId);
						if (!game) return null;
						return (
							<div key={pick.gameId} className='animate-slide-up' style={{ animationDelay: `${index * 50}ms` }}>
								{renderPickCard(pick, index, game)}
							</div>
						);
					})}
					{!haveAllPickedGamesStarted(picks, games) && (
						<div className='space-y-3 pt-1'>
							<Alert variant='info'>
								<AlertDescription>Some games haven&apos;t started yet. You can still edit your picks.</AlertDescription>
							</Alert>
							<Button
								variant='outline'
								className='w-full'
								onClick={() => {
									setSubmitted(false);
									setError(null);
								}}
							>
								<Pencil /> Edit picks
							</Button>
						</div>
					)}
				</div>
			) : games.length === 0 ? (
				<EmptyState icon={CalendarX} title='No games yet' description={`There are no games scheduled for week ${currentWeek}.`} />
			) : (
				<>
					{slateFull && (
						<div className='flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2'>
							<p className='text-xs text-muted-foreground'>
								{showAllGames ? 'Tap a new game to swap it in for one of your picks.' : 'Slate full — showing your 5 picks.'}
							</p>
							<Button variant='ghost' size='sm' className='shrink-0' onClick={() => {
								setShowAllGames(v => !v);
								setSwapCandidate(null);
							}}>
								{showAllGames ? <EyeOff /> : <Eye />}
								{showAllGames ? 'My picks' : 'Show all games'}
							</Button>
						</div>
					)}

					{groups.map(group => (
						<div key={group.key}>
							<GroupLabel title={group.title} count={group.games.length} live={group.live} />
							<div className='space-y-3'>
								{group.games.map((game, index) => (
									<div key={game.id} className='animate-slide-up' style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
										{renderGameCard(game)}
									</div>
								))}
							</div>
						</div>
					))}

					{/* Standard mode: potential score breakdown */}
					{slateFull && !isSteve && (
						<div className='glass rounded-2xl p-4 sm:p-5'>
							<p className='eyebrow mb-3'>Your potential score</p>
							<ul className='space-y-1.5'>
								{picks.map((pick, index) => {
									const game = games.find(g => g.id === pick.gameId);
									const team = pick.isHome ? game?.home : game?.away;
									const isLock = pick.gameId === activeLock;
									return (
										<li
											key={pick.gameId}
											className={cn('flex items-center gap-2.5 rounded-xl px-2 py-1.5 sm:gap-3', isLock ? 'bg-warning/[0.08] ring-1 ring-warning/30' : 'hover:bg-white/[0.04]')}
										>
											<span className='w-3 text-xs font-semibold text-muted-foreground tabular'>{index + 1}</span>
											<TeamLogo src={team?.logo} alt={pick.team} size={28} />
											<span className='min-w-0 flex-1 truncate text-sm font-medium'>{team?.abbreviation ?? pick.team}</span>
											{team?.odds !== undefined && (
												<span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold', getOddsBadgeClass(team.odds))}>{formatOdds(team.odds)}</span>
											)}
											<span className={cn('min-w-14 text-right text-sm font-bold tabular', isLock ? 'text-warning' : 'text-primary')}>
												{isLock && <span className='mr-1 text-[10px] font-extrabold'>{LOCK_MULTIPLIER}×</span>}
												{potentialPoints(pick, game, isLock)} pts
											</span>
											{slateEditable && <LockToggle compact active={isLock} team={pick.team} onToggle={() => toggleLock(pick.gameId)} />}
										</li>
									);
								})}
							</ul>
							{!lockedPick && slateEditable && (
								<p className='mt-3 flex items-center gap-1.5 text-xs text-muted-foreground'>
									<Lock className='h-3 w-3 text-warning' aria-hidden /> Tap a lock to double one pick: it scores {LOCK_MULTIPLIER}× if it wins.
								</p>
							)}
							<div className='mt-3 flex items-baseline justify-between border-t border-white/[0.07] pt-3'>
								<span className='text-sm font-semibold'>Total if all win</span>
								<span className='font-display text-3xl font-extrabold italic text-primary tabular'>{totalPotential} pts</span>
							</div>
						</div>
					)}

					{/* Steve mode: TFS prediction + scoring */}
					{slateFull && isSteve && (
						<div className='glass space-y-5 rounded-2xl p-4 sm:p-5'>
							<div>
								<p className='eyebrow mb-1'>Total final score</p>
								<p className='text-sm text-muted-foreground'>Pick one of your games and predict the combined final score of both teams.</p>
							</div>

							<div className='grid grid-cols-1 gap-2 sm:grid-cols-2' role='radiogroup' aria-label='TFS game'>
								{picks.map(pick => {
									const game = games.find(g => g.id === pick.gameId);
									if (!game) return null;
									const active = tfsGame === pick.gameId;
									return (
										<button
											key={pick.gameId}
											type='button'
											role='radio'
											aria-checked={active}
											onClick={() => setTfsGame(pick.gameId)}
											className={cn(
												'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ease-out-expo active:scale-[0.98]',
												active ? 'border-primary/70 bg-primary/[0.12] shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]' : 'border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
											)}
										>
											<TeamLogo src={game.away.logo} alt={game.away.team} size={26} />
											<span className='font-display text-sm font-bold uppercase italic tracking-tight'>{game.away.abbreviation}</span>
											<span className='text-xs text-muted-foreground'>@</span>
											<span className='font-display text-sm font-bold uppercase italic tracking-tight'>{game.home.abbreviation}</span>
											<TeamLogo src={game.home.logo} alt={game.home.team} size={26} />
											<span className={cn('ml-auto grid h-5 w-5 place-items-center rounded-full', active ? 'bg-primary text-primary-foreground' : 'border border-white/15')}>
												{active && <Check className='h-3 w-3' strokeWidth={3} />}
											</span>
										</button>
									);
								})}
							</div>

							<div className='space-y-1.5'>
								<label htmlFor='tfs-score' className='text-xs font-semibold text-muted-foreground'>
									Predicted total score
								</label>
								<Input
									id='tfs-score'
									type='number'
									inputMode='numeric'
									placeholder='e.g. 45'
									value={tfsScore}
									onChange={e => handleTfsScoreChange(e.target.value)}
									className={cn('font-display text-lg font-bold italic tabular', tfsError && 'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/30')}
									aria-invalid={!!tfsError}
								/>
								{tfsError && <p className='text-xs font-medium text-destructive'>{tfsError}</p>}
							</div>

							<div className='grid gap-3 sm:grid-cols-2'>
								<div className='rounded-xl border border-white/[0.07] bg-white/[0.03] p-3'>
									<p className='eyebrow mb-2'>TFS points</p>
									<ul className='space-y-1 text-xs'>
										{TFS_SCALE.map(row => (
											<li key={row.label} className='flex justify-between'>
												<span className='text-muted-foreground'>{row.label}</span>
												<span className='font-semibold text-primary tabular'>
													{row.points} pt{row.points === 1 ? '' : 's'}
												</span>
											</li>
										))}
									</ul>
								</div>
								<div className='rounded-xl border border-white/[0.07] bg-white/[0.03] p-3'>
									<p className='eyebrow mb-2'>Potential weekly score</p>
									<ul className='space-y-1 text-xs'>
										<li className='flex justify-between'>
											<span className='text-muted-foreground'>
												{MAX_PICKS} picks × {STEVE_PICK_POINTS} pts
											</span>
											<span className='font-semibold text-primary tabular'>{MAX_PICKS * STEVE_PICK_POINTS}</span>
										</li>
										<li className='flex justify-between gap-2'>
											<span className={cn('flex min-w-0 items-center gap-1.5', lockedPick ? 'text-warning' : 'text-muted-foreground')}>
												<Lock className='h-3 w-3 shrink-0' aria-hidden />
												<span className='truncate'>{lockedPick ? `Lock bonus · ${lockedPick.team}` : 'Lock bonus (no lock yet)'}</span>
											</span>
											<span className={cn('font-semibold tabular', lockedPick ? 'text-warning' : 'text-muted-foreground')}>
												{lockedPick ? `+${STEVE_PICK_POINTS * (LOCK_MULTIPLIER - 1)}` : '0'}
											</span>
										</li>
										<li className='flex justify-between'>
											<span className='text-muted-foreground'>TFS bonus</span>
											<span className='font-semibold text-primary tabular'>{TFS_MAX}</span>
										</li>
									</ul>
									<div className='mt-2 flex items-baseline justify-between border-t border-white/[0.07] pt-2'>
										<span className='text-xs font-semibold'>Max total</span>
										<span className='font-display text-2xl font-extrabold italic text-primary tabular'>
											{MAX_PICKS * STEVE_PICK_POINTS + (lockedPick ? STEVE_PICK_POINTS * (LOCK_MULTIPLIER - 1) : 0) + TFS_MAX}
										</span>
									</div>
								</div>
							</div>
						</div>
					)}
				</>
			)}

			{/* Sticky action bar: above the mobile bottom nav, pinned to the column bottom on desktop */}
			{showActionBar && (
				<div className='sticky bottom-[5.25rem] z-30 animate-slide-up lg:bottom-4'>
					<div className='dock rounded-2xl p-2.5 pl-4 sm:p-4'>
						{swapCandidate ? (
							<div className='space-y-2.5'>
								<div className='flex items-center justify-between gap-2'>
									<p className='flex min-w-0 items-center gap-2 text-sm font-semibold'>
										<ArrowLeftRight className='h-4 w-4 shrink-0 text-warning' />
										<span className='truncate'>
											Swap in <span className='text-warning'>{swapCandidate.team}</span> for…
										</span>
									</p>
									<Button variant='ghost' size='sm' onClick={() => setSwapCandidate(null)}>
										Cancel
									</Button>
								</div>
								<div className='flex flex-wrap gap-1.5'>
									{picks.map((pick, index) => {
										const game = games.find(g => g.id === pick.gameId);
										const locked = !!game && hasGameStarted(game);
										const team = pick.isHome ? game?.home : game?.away;
										return (
											<button
												key={pick.gameId}
												type='button'
												disabled={locked}
												onClick={() => handleSwap(index)}
												className='inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-2.5 text-xs font-semibold transition-colors hover:border-warning/50 hover:bg-warning/10 disabled:opacity-40'
											>
												<TeamLogo src={team?.logo} alt={pick.team} size={20} />
												{team?.abbreviation ?? pick.team}
												{locked && <Lock className='h-3 w-3 text-muted-foreground' />}
											</button>
										);
									})}
								</div>
							</div>
						) : (
							<div className='flex items-center gap-3'>
								<div className='min-w-0 flex-1'>
									<div className='flex items-baseline gap-2'>
										<span className='font-display text-[1.65rem] font-extrabold italic leading-none tabular'>
											{pickCount}
											<span className='text-muted-foreground'>/{MAX_PICKS}</span>
										</span>
										<span className='eyebrow'>picked</span>
										{totalPotential > 0 && (
											<span className='ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground sm:ml-2'>
												{activeLock && <Lock className='h-3 w-3 text-warning' aria-label='Includes your lock' />}
												up to <span className='text-primary tabular'>{totalPotential}</span> pts
											</span>
										)}
									</div>
									<PickProgress count={pickCount} className='mt-1.5' />
									{/* Only hints that add something beyond the count above */}
									{(slateFull || (hasExistingPicks && isDirty)) && (
										<p className={cn('mt-1 flex min-w-0 items-center gap-1 text-[11px]', actionHint === LOCK_HINT ? 'text-warning' : 'text-muted-foreground')}>
											{actionHint === LOCK_HINT && <Lock className='h-3 w-3 shrink-0' aria-hidden />}
											<span className='truncate'>{actionHint}</span>
										</p>
									)}
								</div>
								{hasExistingPicks ? (
									<span
										role='status'
										className={cn(
											'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold uppercase tracking-wider',
											saveState === 'saved' && 'bg-accent/10 text-accent',
											(saveState === 'saving' || saveState === 'pending') && 'bg-white/[0.05] text-muted-foreground',
											saveState === 'incomplete' && 'bg-warning/10 text-warning'
										)}
									>
										{saveState === 'saved' ? <Check className='h-4 w-4' /> : saveState === 'incomplete' ? <TriangleAlert className='h-4 w-4' /> : <RefreshCw className='h-3.5 w-3.5 animate-spin' />}
										{saveState === 'saved' ? 'Saved' : saveState === 'incomplete' ? 'Not saved' : 'Saving'}
									</span>
								) : (
									<Button className='h-11 shrink-0 px-5' disabled={!canSubmit} onClick={handleSubmit}>
										{isSaving ? 'Saving…' : 'Submit'}
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</section>
	);
}
