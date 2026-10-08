'use client';

import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import { useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, Award, BarChart3, Crown, Flame, Loader2, Medal, Minus, Rocket, Moon, Share2, Sparkles, Target, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp, Trophy, Users, Zap, CalendarX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { RecapAwards } from '@/lib/recapAwards';
import { formatOdds } from '@/utils/oddsUtils';
import { shareRecapCard, type RecapCardData } from '@/lib/recapCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState, Pill, SectionHeader, StatTile } from '@/components/ui/page';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { cn } from '@/lib/utils';
import { GameCard } from './GameCard';
import type { Game } from './GameCard';

interface LeagueUser {
	userId: string;
	name: string;
	image: string | null;
}

interface LeaguePicks {
	away: LeagueUser[];
	home: LeagueUser[];
}

interface WeeklyResult {
	userId: string;
	player: string;
	image: string | null;
	points: number;
	correct: number;
	tfsPoints: number;
	hasPicks: boolean;
}

type HighlightTone = 'primary' | 'accent' | 'hot' | 'warning';

interface Highlight {
	icon: LucideIcon;
	tone: HighlightTone;
	text: string;
}

interface StandingRow {
	userId: string;
	player: string;
	image: string | null;
	points: number;
	correct: number;
	rank: number;
	/** Places gained (+) or lost (-) vs the previous week's ranking; null when unknown. */
	change: number | null;
}

interface RecapData {
	// User's performance
	userStats: {
		rank: number;
		points: number;
		correct: number;
		total: number;
		tfsPoints?: number;
		rankChange?: number; // Compared to previous week
	};
	// Top performers
	topPerformers: Array<{
		player: string;
		image: string | null;
		points: number;
		correct: number;
	}>;
	// Biggest upsets with full game data
	upsets: Array<{
		gameId: string;
		game: Game;
		team: string;
		opponent: string;
		odds: number;
		points: number;
		pickCount: number;
		correctPickers: LeagueUser[];
		leaguePicks: LeaguePicks;
	}>;
	// Most picked correct games
	mostPickedCorrect: Array<{
		gameId: string;
		game: Game;
		winningTeam: string;
		losingTeam: string;
		pickCount: number;
		totalPicks: number;
		pickers: LeagueUser[];
		leaguePicks: LeaguePicks;
	}>;
	// Most picked incorrect games
	mostPickedIncorrect: Array<{
		gameId: string;
		game: Game;
		losingTeam: string;
		winningTeam: string;
		pickCount: number;
		totalPicks: number;
		pickers: LeagueUser[];
		leaguePicks: LeaguePicks;
	}>;
	// Perfect week users
	perfectWeek: Array<{
		player: string;
		image: string | null;
		points: number;
	}>;
	// Best TFS performers (Steve mode only)
	bestTFS: Array<{
		player: string;
		image: string | null;
		tfsPoints: number;
	}>;
	// League stats
	leagueStats: {
		totalPlayers: number;
		avgPoints: number;
		avgCorrect: number;
		accuracy: number;
		highScore: number;
	};
	// Week highlights
	highlights: Highlight[];
	// Full week standings with movement
	standings: StandingRow[];
	// Weekly awards (null when they couldn't be computed)
	awards: RecapAwards | null;
}

interface RecapAnalytics {
	hasPicks?: boolean;
	weekCompleted?: boolean;
	upsets: RecapData['upsets'];
	mostPickedCorrect: RecapData['mostPickedCorrect'];
	mostPickedIncorrect: RecapData['mostPickedIncorrect'];
	awards?: RecapAwards | null;
}

const MEDAL_TEXT = ['text-[#FFD66B]', 'text-[#D5DCE6]', 'text-[#E7A16B]'];
const MEDAL_RING = ['ring-[#FFD66B]', 'ring-[#D5DCE6]', 'ring-[#E7A16B]'];

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

/** Competition ranks ("1, 1, 3") keyed by userId. */
function rankMap(results: Array<{ userId: string; points: number }>) {
	const sorted = [...results].sort((a, b) => b.points - a.points);
	const ranks = new Map<string, number>();
	sorted.forEach((r, i) => {
		const prev = sorted[i - 1];
		ranks.set(r.userId, i > 0 && prev.points === r.points ? (ranks.get(prev.userId) ?? i + 1) : i + 1);
	});
	return ranks;
}

// Helper function to check if recap is available for a week
export async function isRecapAvailable(week: number, leagueId: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/recap?week=${week}&leagueId=${leagueId}&check=1`, { cache: 'no-store' });
		if (!response.ok) return false;
		const data = await response.json();
		return data.hasPicks && data.weekCompleted;
	} catch {
		return false;
	}
}

function calculateRecapData(weeklyResults: WeeklyResult[], previousWeekResults: Array<{ userId: string; points: number }>, recapAnalytics: RecapAnalytics, currentUserId: string, mode: string): RecapData {
	// Sort by points
	const sorted = [...weeklyResults].sort((a, b) => b.points - a.points);
	const ranks = rankMap(weeklyResults);
	const prevRanks = previousWeekResults.length > 0 ? rankMap(previousWeekResults) : null;

	// User's stats
	const userResult = weeklyResults.find(r => r.userId === currentUserId);
	const userRank = ranks.get(currentUserId) ?? 0;
	let rankChange = 0;
	const prevUserRank = prevRanks?.get(currentUserId);
	if (prevUserRank && userRank) {
		rankChange = prevUserRank - userRank; // Positive = improved
	}

	const userStats = {
		rank: userRank,
		points: userResult?.points || 0,
		correct: userResult?.correct || 0,
		total: 5, // Always 5 picks
		tfsPoints: userResult?.tfsPoints || 0,
		rankChange
	};

	// Top 3 performers
	const topPerformers = sorted.slice(0, 3).map(r => ({ player: r.player, image: r.image, points: r.points, correct: r.correct }));

	// Perfect week (5/5 correct picks)
	const perfectWeek = sorted
		.filter(r => r.correct === 5)
		.slice(0, 5)
		.map(r => ({ player: r.player, image: r.image, points: r.points }));

	// Best TFS performers (Steve mode only) - sort by TFS points
	const tfsSorted = [...weeklyResults].sort((a, b) => (b.tfsPoints || 0) - (a.tfsPoints || 0));
	const bestTFSScore = tfsSorted[0]?.tfsPoints || 0;
	const bestTFS = tfsSorted
		.filter(r => r.tfsPoints === bestTFSScore && bestTFSScore > 0)
		.slice(0, 5)
		.map(r => ({ player: r.player, image: r.image, tfsPoints: r.tfsPoints || 0 }));

	// League stats
	const totalPlayers = weeklyResults.length;
	const totalPoints = weeklyResults.reduce((sum, r) => sum + r.points, 0);
	const totalCorrect = weeklyResults.reduce((sum, r) => sum + r.correct, 0);
	const totalPicks = totalPlayers * 5;

	const leagueStats = {
		totalPlayers,
		avgPoints: totalPlayers > 0 ? Math.round((totalPoints / totalPlayers) * 10) / 10 : 0,
		avgCorrect: totalPlayers > 0 ? Math.round((totalCorrect / totalPlayers) * 10) / 10 : 0,
		accuracy: totalPicks > 0 ? Math.round((totalCorrect / totalPicks) * 100) : 0,
		highScore: sorted[0]?.points || 0
	};

	// Generate highlights
	const highlights: Highlight[] = [];

	if (perfectWeek.length === 1) {
		highlights.push({ icon: Target, tone: 'accent', text: `${perfectWeek[0].player} went perfect with 5/5 correct picks!` });
	} else if (perfectWeek.length > 1) {
		highlights.push({ icon: Target, tone: 'accent', text: `${perfectWeek.length} players achieved a perfect week!` });
	}

	if (leagueStats.accuracy < 50) {
		highlights.push({ icon: Flame, tone: 'hot', text: `Upset city! League accuracy was only ${leagueStats.accuracy}% this week.` });
	} else if (leagueStats.accuracy > 70) {
		highlights.push({ icon: Sparkles, tone: 'primary', text: `The favorites dominated — league accuracy hit ${leagueStats.accuracy}%!` });
	}

	if (sorted[0] && sorted.length > 1) {
		const gap = sorted[0].points - (sorted[1]?.points || 0);
		if (gap >= 10) {
			highlights.push({ icon: Crown, tone: 'warning', text: `${sorted[0].player} dominated with a ${gap}-point lead!` });
		}
	}

	if (userStats.rankChange > 3) {
		highlights.push({ icon: TrendingUp, tone: 'accent', text: `You climbed ${userStats.rankChange} spots in the standings!` });
	} else if (userStats.rankChange < -3) {
		highlights.push({ icon: TrendingDown, tone: 'hot', text: `Tough week — you dropped ${Math.abs(userStats.rankChange)} spots.` });
	}

	const avgPointsRounded = Math.round(leagueStats.avgPoints);
	if (mode === 'standard') {
		if (avgPointsRounded < 8) {
			highlights.push({ icon: Moon, tone: 'primary', text: `Conservative week — average score was only ${avgPointsRounded} points.` });
		} else if (avgPointsRounded > 15) {
			highlights.push({ icon: Rocket, tone: 'hot', text: `Big upset week! Average score soared to ${avgPointsRounded} points.` });
		}
	}

	const standings: StandingRow[] = sorted.map(r => {
		const rank = ranks.get(r.userId) ?? 0;
		const prev = prevRanks?.get(r.userId);
		return { userId: r.userId, player: r.player, image: r.image, points: r.points, correct: r.correct, rank, change: prev ? prev - rank : null };
	});

	return {
		userStats,
		topPerformers,
		upsets: recapAnalytics.upsets || [],
		mostPickedCorrect: recapAnalytics.mostPickedCorrect || [],
		mostPickedIncorrect: recapAnalytics.mostPickedIncorrect || [],
		perfectWeek,
		bestTFS,
		leagueStats,
		highlights,
		standings,
		awards: recapAnalytics.awards ?? null
	};
}

/* ---------- Presentational pieces ---------- */

function PlayerAvatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
	return (
		<Avatar className={cn('h-10 w-10 ring-1 ring-white/10', className)}>
			<AvatarImage src={image || undefined} alt={name} />
			<AvatarFallback className='bg-primary/15 text-xs font-bold text-primary'>{initials(name)}</AvatarFallback>
		</Avatar>
	);
}

function AvatarStack({ users, max = 4 }: { users: LeagueUser[]; max?: number }) {
	if (users.length === 0) return null;
	return (
		<div className='flex items-center gap-1.5' title={users.map(u => u.name).join(', ')}>
			<div className='flex -space-x-1.5'>
				{users.slice(0, max).map((u, i) => (
					<Avatar key={u.userId} className='h-6 w-6 ring-2 ring-[hsl(var(--surface))]' style={{ zIndex: max - i }}>
						<AvatarImage src={u.image || undefined} alt={u.name} />
						<AvatarFallback className='bg-primary/20 text-[9px] font-bold text-primary'>{initials(u.name)}</AvatarFallback>
					</Avatar>
				))}
			</div>
			{users.length > max && <span className='text-[11px] font-semibold text-muted-foreground tabular'>+{users.length - max}</span>}
		</div>
	);
}

const TONE_CHIP: Record<HighlightTone, string> = {
	primary: 'bg-primary/10 text-primary',
	accent: 'bg-accent/10 text-accent',
	hot: 'bg-accent-2/10 text-accent-2',
	warning: 'bg-warning/10 text-warning'
};

function Movement({ change }: { change: number | null | undefined }) {
	if (change === null || change === undefined) return <span className='w-8 text-center text-[10px] font-semibold uppercase text-muted-foreground/60'>New</span>;
	if (change === 0)
		return (
			<span className='flex w-8 items-center justify-center text-muted-foreground/60'>
				<Minus className='h-3 w-3' />
			</span>
		);
	const up = change > 0;
	return (
		<span className={cn('flex w-8 items-center justify-center gap-0.5 text-[11px] font-bold tabular', up ? 'text-accent' : 'text-accent-2')}>
			{up ? <ArrowUp className='h-3 w-3' strokeWidth={3} /> : <ArrowDown className='h-3 w-3' strokeWidth={3} />}
			{Math.abs(change)}
		</span>
	);
}

/** A featured game with a one-line story caption above it. */
function GameStory({ title, caption, aside, game, leaguePicks, leagueMode, tone, delay }: { title: React.ReactNode; caption: React.ReactNode; aside?: React.ReactNode; game: Game; leaguePicks: LeaguePicks; leagueMode: string; tone: 'hot' | 'accent' | 'loss'; delay: number }) {
	const bar = tone === 'hot' ? 'bg-brand-hot' : tone === 'accent' ? 'bg-accent' : 'bg-accent-2';
	return (
		<div className='glass relative overflow-hidden rounded-2xl animate-slide-up' style={{ animationDelay: `${delay}ms` }}>
			<div className={cn('absolute inset-y-0 left-0 w-1', bar)} />
			<div className='flex items-start justify-between gap-3 border-b border-white/[0.06] py-3 pl-5 pr-4'>
				<div className='min-w-0'>
					<p className='font-display text-lg font-bold uppercase italic leading-tight tracking-tight'>{title}</p>
					<p className='mt-0.5 text-xs text-muted-foreground tabular'>{caption}</p>
				</div>
				{aside && <div className='shrink-0'>{aside}</div>}
			</div>
			<div className='pointer-events-none pl-1'>
				<GameCard game={game} showScores disabled noHover leagueMode={leagueMode} leaguePicks={leaguePicks} forceShowOdds />
			</div>
		</div>
	);
}

/** One line per weekly award, shared by the page and the share card. */
function awardRows(awards: RecapAwards | null, mode: string): Array<{ emoji: string; label: string; text: string; image?: string | null; name?: string }> {
	if (!awards) return [];
	const names = (list: Array<{ name: string }>) => (list.length <= 2 ? list.map(p => p.name).join(' & ') : `${list[0].name} +${list.length - 1}`);
	const rows: Array<{ emoji: string; label: string; text: string; image?: string | null; name?: string }> = [];
	if (awards.boldCall)
		rows.push({ emoji: '🎯', label: 'Bold call', text: `${awards.boldCall.name} hit ${awards.boldCall.team} at ${formatOdds(awards.boldCall.odds)} (+${awards.boldCall.points})`, image: awards.boldCall.image, name: awards.boldCall.name });
	if (awards.heater) rows.push({ emoji: '🔥', label: 'On a heater', text: `${awards.heater.name}: ${awards.heater.length} straight correct picks`, image: awards.heater.image, name: awards.heater.name });
	if (awards.worstBeat)
		rows.push({
			emoji: '😖',
			label: 'Worst beat',
			text: `${awards.worstBeat.name}’s ${awards.worstBeat.team}${awards.worstBeat.odds !== null && mode === 'standard' ? ` (${formatOdds(awards.worstBeat.odds)})` : ''} fell to ${awards.worstBeat.opponent}, ${awards.worstBeat.score}`,
			image: awards.worstBeat.image,
			name: awards.worstBeat.name
		});
	if (awards.lockBusts.length) rows.push({ emoji: '💀', label: 'Lock bust', text: `${names(awards.lockBusts)}: ${awards.lockBusts.map(l => l.team).join(', ')} lock went down`, image: awards.lockBusts[0].image, name: awards.lockBusts[0].name });
	if (awards.chalkEaters.length) rows.push({ emoji: '🍽️', label: 'Chalk eater', text: `${names(awards.chalkEaters)} took nothing but favorites`, image: awards.chalkEaters[0].image, name: awards.chalkEaters[0].name });
	if (awards.woodenSpoon.length) rows.push({ emoji: '🥄', label: 'Wooden spoon', text: `${names(awards.woodenSpoon)} with ${awards.woodenSpoon[0].points} pts`, image: awards.woodenSpoon[0].image, name: awards.woodenSpoon[0].name });
	return rows;
}

function AwardsSection({ rows }: { rows: ReturnType<typeof awardRows> }) {
	if (rows.length === 0) return null;
	return (
		<section>
			<SectionHeader title='Weekly Awards' icon={Medal} />
			<div className='grid gap-2 sm:grid-cols-2'>
				{rows.map((row, idx) => (
					<div key={row.label} className='flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 animate-slide-up' style={{ animationDelay: `${idx * 60}ms` }}>
						<span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xl' aria-hidden>
							{row.emoji}
						</span>
						<div className='min-w-0 flex-1'>
							<p className='eyebrow text-[10px]'>{row.label}</p>
							<p className='mt-0.5 text-sm leading-snug text-foreground'>{row.text}</p>
						</div>
						{row.name && <PlayerAvatar name={row.name} image={row.image ?? null} className='h-8 w-8' />}
					</div>
				))}
			</div>
		</section>
	);
}

function RecapSkeleton() {
	return (
		<div className='space-y-6'>
			<Skeleton className='h-56 rounded-3xl' />
			<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className='h-28 rounded-2xl' />
				))}
			</div>
			<Skeleton className='h-64 rounded-2xl' />
		</div>
	);
}

/* ---------- Main component ---------- */

export function Recap({ weekOverride }: { weekOverride?: number }) {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const { data: session } = useSession();
	// Use weekOverride if provided, otherwise use currentWeek from context
	const weekToDisplay = weekOverride || currentWeek;
	const [selectedWeek, setSelectedWeek] = useState<number>(0); // Will be set to most recent available week
	const [weeksResolved, setWeeksResolved] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [recapData, setRecapData] = useState<RecapData | null>(null);
	const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
	const [leagueMode, setLeagueMode] = useState<string>('standard');
	const [leagueName, setLeagueName] = useState('');
	const [sharing, setSharing] = useState(false);
	const [leagueModeLoaded, setLeagueModeLoaded] = useState(false);

	// Fetch league mode
	useEffect(() => {
		const fetchLeagueDetails = async () => {
			if (!leagueId) return;
			try {
				const response = await fetch(`/api/league/${leagueId}`, { cache: 'no-store' });
				if (response.ok) {
					const data = await response.json();
					setLeagueMode(data.mode || 'standard');
					setLeagueName(data.name || '');
				}
			} catch (error) {
				console.error('[Recap] Error fetching league details:', error);
			} finally {
				setLeagueModeLoaded(true);
			}
		};
		fetchLeagueDetails();
	}, [leagueId]);

	// Determine available weeks (weeks with completed games AND user picks)
	useEffect(() => {
		const determineAvailableWeeks = async () => {
			if (!leagueId) return;
			// Check weeks up to and including weekToDisplay (since that week might be completed), in parallel
			const candidates = Array.from({ length: Math.max(0, weekToDisplay) }, (_, i) => i + 1);
			const availability = await Promise.all(candidates.map(w => isRecapAvailable(w, leagueId)));
			const weeks = candidates.filter((_, i) => availability[i]);

			setAvailableWeeks(weeks);
			if (weekOverride && weeks.includes(weekOverride)) {
				setSelectedWeek(weekOverride);
			} else if (weeks.includes(weekToDisplay)) {
				setSelectedWeek(weekToDisplay);
			} else if (weeks.length > 0) {
				setSelectedWeek(weeks[weeks.length - 1]);
			} else {
				setSelectedWeek(0); // No weeks available
			}
			setWeeksResolved(true);
		};
		determineAvailableWeeks();
	}, [weekToDisplay, leagueId, weekOverride]);

	// Fetch and calculate recap data
	useEffect(() => {
		const fetchRecap = async () => {
			if (!leagueId || !session?.user?.id || !leagueModeLoaded) return;
			if (selectedWeek < 1) {
				// Nothing to show once we know there are no recap weeks
				if (weeksResolved) setLoading(false);
				return;
			}
			const userId = session.user.id;

			try {
				setLoading(true);
				setError(null);

				// Leaderboard, recap analytics and the previous week's standings are independent
				const [leaderboardResponse, recapResponse, prevResponse] = await Promise.all([
					fetch(`/api/leaderboard?week=${selectedWeek}&leagueId=${leagueId}`, { cache: 'no-store' }),
					fetch(`/api/recap?week=${selectedWeek}&leagueId=${leagueId}`, { cache: 'no-store' }),
					selectedWeek > 1 ? fetch(`/api/leaderboard?week=${selectedWeek - 1}&leagueId=${leagueId}`, { cache: 'no-store' }).catch(() => null) : Promise.resolve(null)
				]);

				if (!leaderboardResponse.ok || !recapResponse.ok) {
					throw new Error('Failed to fetch recap data');
				}

				const leaderboardData: { weeklyResults: WeeklyResult[] } = await leaderboardResponse.json();
				const recapAnalytics: RecapAnalytics = await recapResponse.json();

				// Check if recap is available
				if (!recapAnalytics.hasPicks || !recapAnalytics.weekCompleted) {
					setRecapData(null);
					setError('Recap not available for this week yet.');
					return;
				}

				let previousWeekResults: Array<{ userId: string; points: number }> = [];
				if (prevResponse?.ok) {
					try {
						const prevData = await prevResponse.json();
						previousWeekResults = prevData.weeklyResults || [];
					} catch {
						// Previous week data not available
					}
				}

				setRecapData(calculateRecapData(leaderboardData.weeklyResults || [], previousWeekResults, recapAnalytics, userId, leagueMode));
			} catch (err) {
				console.error('[Recap] Failed to load recap:', err);
				setRecapData(null);
				setError('Failed to load weekly recap.');
			} finally {
				setLoading(false);
			}
		};

		fetchRecap();
	}, [selectedWeek, leagueId, session?.user?.id, leagueMode, leagueModeLoaded, weeksResolved]);

	const currentUserId = session?.user?.id;

	const weekSelector = availableWeeks.length > 1 && (
		<div className='-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:flex-wrap sm:px-0'>
			{availableWeeks.map(week => {
				const label = week === currentWeek ? 'This week' : week === currentWeek - 1 ? 'Last week' : null;
				const active = selectedWeek === week;
				return (
					<button
						key={week}
						type='button'
						onClick={() => setSelectedWeek(week)}
						aria-pressed={active}
						className={cn(
							'flex shrink-0 flex-col items-start rounded-xl border px-3.5 py-2 text-left transition-all duration-200',
							active ? 'border-primary/60 bg-primary/[0.12] shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.7)]' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]'
						)}
					>
						<span className={cn('font-display text-base font-bold uppercase italic leading-none tracking-tight', active ? 'text-primary' : 'text-foreground')}>Week {week}</span>
						{label && <span className='mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>{label}</span>}
					</button>
				);
			})}
		</div>
	);

	if (loading) {
		return (
			<div className='space-y-5'>
				{weekSelector}
				<RecapSkeleton />
			</div>
		);
	}

	if (error || !recapData) {
		return (
			<div className='space-y-5'>
				{weekSelector}
				<EmptyState icon={CalendarX} title={selectedWeek > 0 ? `Week ${selectedWeek} Recap` : 'No recap yet'} description={error || 'No recap data available for this week.'} />
			</div>
		);
	}

	const { userStats, topPerformers, leagueStats } = recapData;
	const rows = awardRows(recapData.awards, leagueMode);

	const share = async () => {
		setSharing(true);
		try {
			const top = topPerformers[0];
			const card: RecapCardData = {
				leagueName: leagueName || 'Pick 5',
				week: selectedWeek,
				winner: top ? { name: topPerformers.filter(p => p.points === top.points).map(p => p.player).join(' & '), points: top.points, correct: top.correct } : null,
				rows: rows.map(({ emoji, label, text }) => ({ emoji, label, text })),
				site: window.location.host
			};
			const result = await shareRecapCard(card);
			if (result === 'downloaded') toast.success('Recap image saved — drop it in the group chat');
		} catch (err) {
			console.error('[Recap] Share failed:', err);
			toast.error('Couldn’t create the recap image');
		} finally {
			setSharing(false);
		}
	};
	const winner = topPerformers[0];
	const coWinners = topPerformers.filter(p => winner && p.points === winner.points).length;
	const runnersUp = topPerformers.slice(1);

	return (
		<div className='space-y-8'>
			{weekSelector}

			{/* Hero: week winner */}
			{winner && (
				<section className='gradient-border glass relative overflow-hidden rounded-3xl p-5 animate-slide-up sm:p-7'>
					<div aria-hidden className='pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#FFD66B]/10 blur-3xl' />
					<div aria-hidden className='pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl' />

					<div className='relative flex items-center justify-between gap-3'>
						<p className='eyebrow flex items-center gap-2'>
							<Trophy className='h-3.5 w-3.5 text-[#FFD66B]' />
							Week {selectedWeek} recap
						</p>
						<div className='flex items-center gap-2'>
							{coWinners > 1 && <Pill tone='warning'>{coWinners}-way tie</Pill>}
							<Button size='sm' variant='outline' onClick={share} disabled={sharing}>
								{sharing ? <Loader2 className='animate-spin' /> : <Share2 />} Share
							</Button>
						</div>
					</div>

					<div className='relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-4 sm:flex-nowrap sm:gap-6'>
						<div className='relative shrink-0'>
							<Crown className='absolute -top-6 left-1/2 h-6 w-6 -translate-x-1/2 text-[#FFD66B] drop-shadow-[0_0_10px_rgba(255,214,107,0.8)]' fill='currentColor' />
							<PlayerAvatar name={winner.player} image={winner.image} className='h-20 w-20 ring-2 ring-[#FFD66B] ring-offset-4 ring-offset-[hsl(var(--surface))] shadow-[0_0_40px_-6px_rgba(255,214,107,0.6)] sm:h-24 sm:w-24' />
						</div>
						<div className='min-w-0 flex-1 basis-0'>
							<p className='text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD66B]'>Week winner</p>
							<h2 className='display-heading mt-1 truncate text-3xl sm:text-5xl'>{winner.player}</h2>
							<p className='mt-1.5 text-sm text-muted-foreground tabular'>{winner.correct}/5 correct</p>
						</div>
						{/* Wraps under the name on phones, sits to the right on larger screens */}
						<div className='flex w-full items-baseline gap-2 sm:block sm:w-auto sm:shrink-0 sm:text-right'>
							<p className='display-heading text-5xl text-[#FFD66B] tabular sm:text-7xl'>
								<CountUp end={winner.points} duration={1} />
							</p>
							<p className='eyebrow sm:mt-1'>Points</p>
						</div>
					</div>

					{runnersUp.length > 0 && (
						<div className='relative mt-5 grid gap-2 sm:grid-cols-2'>
							{runnersUp.map((p, i) => (
								<div key={`${p.player}-${i}`} className='flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5'>
									<span className={cn('w-5 text-center font-display text-lg font-extrabold italic tabular', MEDAL_TEXT[i + 1])}>{i + 2}</span>
									<PlayerAvatar name={p.player} image={p.image} className={cn('h-9 w-9 ring-2', MEDAL_RING[i + 1])} />
									<div className='min-w-0 flex-1'>
										<p className='truncate text-sm font-semibold'>{p.player}</p>
										<p className='text-[11px] text-muted-foreground tabular'>{p.correct}/5 correct</p>
									</div>
									<span className={cn('font-display text-2xl font-extrabold italic tabular', MEDAL_TEXT[i + 1])}>{p.points}</span>
								</div>
							))}
						</div>
					)}
				</section>
			)}

			{/* Storylines */}
			{recapData.highlights.length > 0 && (
				<section>
					<SectionHeader title='Storylines' icon={Flame} />
					<div className='grid gap-2 sm:grid-cols-2'>
						{recapData.highlights.map((h, idx) => (
							<div key={idx} className='flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 animate-slide-up' style={{ animationDelay: `${idx * 70}ms` }}>
								<span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONE_CHIP[h.tone])}>
									<h.icon className='h-4 w-4' />
								</span>
								<p className='pt-1 text-sm leading-snug text-foreground'>{h.text}</p>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Weekly awards */}
			<AwardsSection rows={rows} />

			{/* Your week */}
			<section>
				<SectionHeader title='Your Week' icon={Target} />
				<div className={cn('grid grid-cols-2 gap-3', leagueMode === 'steve' ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
					<StatTile
						label='Rank'
						icon={Trophy}
						tone='primary'
						value={
							<span className={cn(userStats.rank >= 1 && userStats.rank <= 3 && MEDAL_TEXT[userStats.rank - 1])}>
								{userStats.rank > 0 ? (
									<>
										<span className='text-2xl text-muted-foreground sm:text-3xl'>#</span>
										<CountUp end={userStats.rank} duration={0.8} />
									</>
								) : (
									'–'
								)}
							</span>
						}
						sub={
							userStats.rankChange ? (
								<span className={cn('inline-flex items-center gap-1 font-semibold', userStats.rankChange > 0 ? 'text-accent' : 'text-accent-2')}>
									{userStats.rankChange > 0 ? <ArrowUp className='h-3 w-3' /> : <ArrowDown className='h-3 w-3' />}
									{Math.abs(userStats.rankChange)} vs last week
								</span>
							) : (
								'Same as last week'
							)
						}
					/>
					<StatTile label='Points' icon={Zap} tone='accent' value={<CountUp end={userStats.points} duration={0.8} />} sub={leagueStats.avgPoints ? `League avg ${leagueStats.avgPoints}` : undefined} />
					<StatTile
						label='Correct'
						icon={Target}
						tone='muted'
						value={
							<>
								<CountUp end={userStats.correct} duration={0.8} />
								<span className='text-2xl text-muted-foreground sm:text-3xl'>/{userStats.total}</span>
							</>
						}
						className={cn(leagueMode !== 'steve' && 'col-span-2 md:col-span-1')}
					/>
					{leagueMode === 'steve' && <StatTile label='TFS' icon={Award} tone='warning' value={<CountUp end={userStats.tfsPoints || 0} duration={0.8} />} />}
				</div>
			</section>

			{/* Awards: perfect week + best TFS */}
			{(recapData.perfectWeek.length > 0 || (leagueMode === 'steve' && recapData.bestTFS.length > 0)) && (
				<section className='grid gap-3 md:grid-cols-2'>
					{recapData.perfectWeek.length > 0 && (
						<Card className='border-accent/25 p-4 sm:p-5'>
							<div className='mb-3 flex items-center justify-between gap-2'>
								<p className='eyebrow flex items-center gap-2 text-accent'>
									<Target className='h-3.5 w-3.5' /> Perfect week club
								</p>
								<Pill tone='accent'>5/5</Pill>
							</div>
							<div className='flex flex-wrap gap-2'>
								{recapData.perfectWeek.map((p, idx) => (
									<div key={idx} className='flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.06] py-1 pl-1 pr-3'>
										<PlayerAvatar name={p.player} image={p.image} className='h-7 w-7' />
										<span className='text-sm font-semibold'>{p.player}</span>
										<span className='font-display text-sm font-bold italic text-accent tabular'>{p.points}</span>
									</div>
								))}
							</div>
						</Card>
					)}
					{leagueMode === 'steve' && recapData.bestTFS.length > 0 && (
						<Card className='border-warning/25 p-4 sm:p-5'>
							<div className='mb-3 flex items-center justify-between gap-2'>
								<p className='eyebrow flex items-center gap-2 text-warning'>
									<Award className='h-3.5 w-3.5' /> Best TFS
								</p>
								<Pill tone='warning'>{recapData.bestTFS[0].tfsPoints === 5 ? 'Perfect' : `${recapData.bestTFS[0].tfsPoints} pts · ${5 - recapData.bestTFS[0].tfsPoints} off perfect`}</Pill>
							</div>
							<div className='flex flex-wrap gap-2'>
								{recapData.bestTFS.map((p, idx) => (
									<div key={idx} className='flex items-center gap-2 rounded-full border border-warning/25 bg-warning/[0.06] py-1 pl-1 pr-3'>
										<PlayerAvatar name={p.player} image={p.image} className='h-7 w-7' />
										<span className='text-sm font-semibold'>{p.player}</span>
										<span className='font-display text-sm font-bold italic text-warning tabular'>{p.tfsPoints}</span>
									</div>
								))}
							</div>
						</Card>
					)}
				</section>
			)}

			{/* Craziest upsets */}
			{recapData.upsets.length > 0 && (
				<section>
					<SectionHeader title='Craziest Upsets' icon={Flame} />
					<div className='space-y-3'>
						{recapData.upsets.slice(0, 3).map((upset, idx) => (
							<GameStory
								key={upset.gameId}
								tone='hot'
								delay={idx * 80}
								game={upset.game}
								leaguePicks={upset.leaguePicks}
								leagueMode={leagueMode}
								title={
									<>
										<span className='text-accent-2'>{upset.team}</span> stun {upset.opponent}
									</>
								}
								caption={`+${upset.odds} · worth ${upset.points} pts`}
								aside={
									upset.correctPickers.length > 0 ? (
										<div className='flex flex-col items-end gap-1'>
											<span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>Called it</span>
											<AvatarStack users={upset.correctPickers} max={3} />
										</div>
									) : (
										<Pill tone='hot'>Nobody</Pill>
									)
								}
							/>
						))}
					</div>
				</section>
			)}

			{/* Crowd favorites (standard mode only) */}
			{leagueMode === 'standard' && (recapData.mostPickedCorrect.length > 0 || recapData.mostPickedIncorrect.length > 0) && (
				<section className='grid gap-8 xl:grid-cols-2 xl:gap-4'>
					{recapData.mostPickedCorrect.length > 0 && (
						<div>
							<SectionHeader title='Crowd Got It Right' icon={ThumbsUp} />
							<div className='space-y-3'>
								{recapData.mostPickedCorrect.slice(0, 2).map((pick, idx) => (
									<GameStory
										key={pick.gameId}
										tone='accent'
										delay={idx * 80}
										game={pick.game}
										leaguePicks={pick.leaguePicks}
										leagueMode={leagueMode}
										title={
											<>
												<span className='text-accent'>{pick.winningTeam}</span> beat {pick.losingTeam}
											</>
										}
										caption={`${pick.pickCount} of ${pick.totalPicks} players picked correctly`}
									/>
								))}
							</div>
						</div>
					)}
					{recapData.mostPickedIncorrect.length > 0 && (
						<div>
							<SectionHeader title='Crowd Got Burned' icon={ThumbsDown} />
							<div className='space-y-3'>
								{recapData.mostPickedIncorrect.slice(0, 2).map((pick, idx) => (
									<GameStory
										key={pick.gameId}
										tone='loss'
										delay={idx * 80}
										game={pick.game}
										leaguePicks={pick.leaguePicks}
										leagueMode={leagueMode}
										title={
											<>
												{pick.pickCount} took <span className='text-accent-2'>{pick.losingTeam}</span>
											</>
										}
										caption={`But ${pick.winningTeam} won`}
									/>
								))}
							</div>
						</div>
					)}
				</section>
			)}

			{/* Standings movement */}
			{recapData.standings.length > 0 && (
				<section>
					<SectionHeader title={`Week ${selectedWeek} Standings`} icon={TrendingUp} action={selectedWeek > 1 ? <span className='text-[11px] text-muted-foreground'>vs Week {selectedWeek - 1}</span> : undefined} />
					<Card className='p-2 sm:p-3'>
						<div className='space-y-1'>
							{recapData.standings.map((s, idx) => {
								const isMe = s.userId === currentUserId;
								return (
									<div
										key={s.userId}
										className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 animate-slide-up', isMe ? 'bg-primary/[0.08] ring-1 ring-primary/30' : 'hover:bg-white/[0.04]')}
										style={{ animationDelay: `${Math.min(idx, 12) * 35}ms` }}
									>
										<span className={cn('w-6 text-center font-display text-lg font-extrabold italic tabular', s.rank <= 3 ? MEDAL_TEXT[s.rank - 1] : 'text-muted-foreground')}>{s.rank}</span>
										<Movement change={selectedWeek > 1 ? s.change : 0} />
										<PlayerAvatar name={s.player} image={s.image} className='h-8 w-8' />
										<div className='min-w-0 flex-1'>
											<p className='flex items-center gap-1.5 text-sm font-semibold'>
												<span className='truncate'>{s.player}</span>
												{isMe && <span className='shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary'>You</span>}
											</p>
											<p className='text-[11px] text-muted-foreground tabular'>{s.correct}/5 correct</p>
										</div>
										<span className='font-display text-2xl font-extrabold italic tabular'>{s.points}</span>
									</div>
								);
							})}
						</div>
					</Card>
				</section>
			)}

			{/* League numbers */}
			<section>
				<SectionHeader title='League Numbers' icon={BarChart3} />
				<div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
					<StatTile label='Players' icon={Users} tone='muted' value={<CountUp end={leagueStats.totalPlayers} duration={0.8} />} />
					<StatTile label='Avg points' icon={TrendingUp} tone='primary' value={<CountUp end={leagueStats.avgPoints} duration={0.8} decimals={1} />} />
					<StatTile
						label='Accuracy'
						icon={Target}
						tone={leagueStats.accuracy >= 50 ? 'accent' : 'hot'}
						value={
							<>
								<CountUp end={leagueStats.accuracy} duration={0.8} />%
							</>
						}
					/>
					<StatTile label='High score' icon={Zap} tone='warning' value={<CountUp end={leagueStats.highScore} duration={0.8} />} />
				</div>
			</section>
		</div>
	);
}
