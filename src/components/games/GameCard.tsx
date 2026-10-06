'use client';

import CountUp from 'react-countup';
import { Check, X, Flame } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TeamLogo } from '@/components/ui/team-logo';
import { cn } from '@/lib/utils';
import { calculatePointsFromOdds, formatOdds, getOddsBadgeClass } from '@/utils/oddsUtils';

interface TeamInfo {
	team: string;
	abbreviation: string;
	logo: string;
	record: string;
	score?: number;
	odds?: number;
}

interface Game {
	id: string;
	home: TeamInfo;
	away: TeamInfo;
	date: Date;
	status?: string;
	clock?: string; // Time remaining (e.g., "12:34")
	period?: number; // Quarter/period number (1-4)
	periodDisplay?: string; // e.g., "Q1", "OT"
}

interface UserPick {
	userId: string;
	name: string;
	image: string | null;
}

interface GamePicksData {
	away: UserPick[];
	home: UserPick[];
}

interface GameCardProps {
	game?: Game;
	selected?: string;
	onSelect?: (gameId: string, team: string, opponent: string, isHome: boolean, odds?: number) => void;
	showScores?: boolean;
	disabled?: boolean;
	isCorrect?: boolean | null;
	noHover?: boolean;
	leaguePicks?: GamePicksData;
	leagueMode?: string;
	forceShowOdds?: boolean; // Always show odds regardless of league mode
}

type GamePhase = 'pre' | 'live' | 'final';

const UPSET_ODDS = 250;

function getPhase(status?: string): GamePhase {
	const s = status?.toLowerCase();
	if (s === 'post' || s === 'final') return 'final';
	if (s === 'in' || s === 'in_progress') return 'live';
	return 'pre';
}

function formatKickoff(date: Date) {
	const d = new Date(date);
	const today = new Date();
	const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const diffDays = Math.round((startOfDay(d) - startOfDay(today)) / 86_400_000);
	const day = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
	const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	return { day, time, monthDay };
}

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

function PickedByAvatars({ picks, maxVisible = 4 }: { picks: UserPick[]; maxVisible?: number }) {
	if (!picks?.length) return null;
	const visible = picks.slice(0, maxVisible);
	const hidden = picks.slice(maxVisible);

	return (
		<div className='flex items-center gap-1.5' title={picks.map(p => p.name).join(', ')}>
			<div className='flex -space-x-1.5'>
				{visible.map((pick, i) => (
					<Avatar key={pick.userId} className='h-6 w-6 ring-2 ring-[hsl(var(--surface))]' style={{ zIndex: maxVisible - i }}>
						<AvatarImage src={pick.image || undefined} alt={pick.name} />
						<AvatarFallback className='bg-primary/20 text-[9px] font-bold text-primary'>{initials(pick.name)}</AvatarFallback>
					</Avatar>
				))}
			</div>
			{hidden.length > 0 && <span className='text-[11px] font-semibold text-muted-foreground tabular'>+{hidden.length}</span>}
		</div>
	);
}

function StatusBar({ game, phase }: { game: Game; phase: GamePhase }) {
	if (phase === 'live') {
		const period = game.periodDisplay || (game.period ? `Q${game.period}` : '');
		return (
			<div className='flex items-center gap-2 text-xs font-semibold'>
				<span className='live-dot' />
				<span className='uppercase tracking-wider text-live'>Live</span>
				{period && <span className='text-foreground'>{period}</span>}
				{game.clock && <span className='font-mono text-muted-foreground'>{game.clock}</span>}
			</div>
		);
	}

	const { day, time, monthDay } = formatKickoff(game.date);
	if (phase === 'final') {
		return (
			<div className='flex items-center gap-2 text-xs font-semibold'>
				<span className='uppercase tracking-wider text-muted-foreground'>Final</span>
				<span className='text-muted-foreground/60'>·</span>
				<span className='text-muted-foreground/80'>
					{day} {monthDay}
				</span>
			</div>
		);
	}

	return (
		<div className='flex items-center gap-2 text-xs font-semibold'>
			<span className='text-foreground'>{day}</span>
			<span className='text-primary'>{time}</span>
			<span className='text-muted-foreground/60'>·</span>
			<span className='text-muted-foreground'>{monthDay}</span>
		</div>
	);
}

interface TeamTileProps {
	team: TeamInfo;
	side: 'away' | 'home';
	isSelected: boolean;
	result: boolean | null; // graded result for the selected team
	isWinner: boolean;
	isLoser: boolean;
	showScore: boolean;
	showOdds: boolean;
	interactive: boolean;
	dimmed: boolean;
	pickers?: UserPick[];
	onClick?: () => void;
}

function TeamTile({ team, side, isSelected, result, isWinner, isLoser, showScore, showOdds, interactive, dimmed, pickers, onClick }: TeamTileProps) {
	const graded = isSelected && typeof result === 'boolean';
	const tone = graded ? (result ? 'win' : 'loss') : isSelected ? 'selected' : isWinner ? 'winner' : 'idle';

	const toneClasses = {
		idle: 'border-white/[0.07] bg-white/[0.025]',
		winner: 'border-accent/25 bg-accent/[0.06]',
		selected: 'border-primary/70 bg-primary/[0.12] shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_12px_40px_-12px_hsl(var(--primary)/0.6)]',
		win: 'border-accent/60 bg-accent/[0.12] shadow-[0_0_0_1px_hsl(var(--accent)/0.3),0_12px_40px_-14px_hsl(var(--accent)/0.55)]',
		loss: 'border-accent-2/50 bg-accent-2/[0.10]'
	}[tone];

	const points = showOdds && team.odds !== undefined ? calculatePointsFromOdds(team.odds) : null;
	const Tag = interactive ? 'button' : 'div';

	return (
		<Tag
			{...(interactive ? { type: 'button' as const, onClick, 'aria-pressed': isSelected } : {})}
			className={cn(
				'group/tile relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-200 ease-out-expo sm:flex-row sm:gap-3 sm:p-3.5 sm:text-left',
				side === 'home' && 'sm:flex-row-reverse sm:text-right',
				toneClasses,
				interactive && !isSelected && 'hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.98]',
				interactive && 'cursor-pointer',
				dimmed && 'opacity-45',
				isLoser && !isSelected && 'opacity-60'
			)}
		>
			{/* Selection / result badge */}
			{(isSelected || graded) && (
				<span
					className={cn(
						'absolute -top-2 grid h-5 w-5 place-items-center rounded-full ring-2 ring-[hsl(var(--background))] animate-scale-in',
						side === 'away' ? '-left-1.5' : '-right-1.5',
						tone === 'win' ? 'bg-accent text-accent-foreground' : tone === 'loss' ? 'bg-accent-2 text-white' : 'bg-primary text-primary-foreground'
					)}
				>
					{tone === 'loss' ? <X className='h-3 w-3' strokeWidth={3} /> : <Check className='h-3 w-3' strokeWidth={3} />}
				</span>
			)}

			<TeamLogo src={team.logo} alt={team.team} size={44} />

			<div className={cn('flex min-w-0 flex-1 flex-col items-center sm:items-start', side === 'home' && 'sm:items-end')}>
				<span className='font-display text-xl font-bold uppercase italic leading-none tracking-tight sm:hidden'>{team.abbreviation}</span>
				<span className='hidden max-w-full truncate font-display text-lg font-bold uppercase italic leading-tight tracking-tight sm:block lg:text-xl'>{team.team}</span>
				{team.record && <span className='mt-0.5 text-[11px] font-medium text-muted-foreground tabular'>{team.record}</span>}

				{points !== null && team.odds !== undefined && (
					<div className={cn('mt-1.5 flex items-center gap-1.5', side === 'home' && 'sm:flex-row-reverse')}>
						<span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold', getOddsBadgeClass(team.odds))}>{formatOdds(team.odds)}</span>
						<span className={cn('text-[11px] font-bold tabular', isSelected ? 'text-foreground' : 'text-primary')}>{points} pts</span>
					</div>
				)}

				{pickers && pickers.length > 0 && (
					<div className='mt-2'>
						<PickedByAvatars picks={pickers} />
					</div>
				)}
			</div>

			{showScore && team.score !== undefined && (
				<span className={cn('font-display text-3xl font-extrabold italic leading-none tabular sm:text-4xl', isLoser ? 'text-muted-foreground' : 'text-foreground')}>
					<CountUp end={team.score} duration={0.8} preserveValue />
				</span>
			)}
		</Tag>
	);
}

export function GameCard({ game, selected, onSelect, showScores, disabled, isCorrect, noHover, leaguePicks, leagueMode, forceShowOdds }: GameCardProps) {
	if (!game) return null;

	const phase = getPhase(game.status);
	const showOdds = !!forceShowOdds || leagueMode === 'standard';
	const interactive = !noHover && !!onSelect && !disabled;

	const awayScore = game.away.score ?? 0;
	const homeScore = game.home.score ?? 0;
	const decided = !!showScores && phase === 'final' && awayScore !== homeScore;
	const awayWon = decided && awayScore > homeScore;
	const homeWon = decided && homeScore > awayScore;
	const isUpset = (awayWon && (game.away.odds ?? 0) >= UPSET_ODDS) || (homeWon && (game.home.odds ?? 0) >= UPSET_ODDS);

	// Grey out games the user can't pick (5 already chosen) but which haven't kicked off
	const dimmed = !!disabled && !noHover && !selected && phase === 'pre';

	const tile = (side: 'away' | 'home') => {
		const team = game[side];
		const opponent = side === 'away' ? game.home : game.away;
		const isSelected = selected === team.team;
		return (
			<TeamTile
				team={team}
				side={side}
				isSelected={isSelected}
				result={isSelected ? (isCorrect ?? null) : null}
				// Only highlight the winner when the viewer has no pick in this game
				isWinner={!selected && (side === 'away' ? awayWon : homeWon)}
				isLoser={side === 'away' ? homeWon : awayWon}
				showScore={!!showScores}
				showOdds={showOdds}
				interactive={interactive}
				dimmed={dimmed}
				pickers={leaguePicks?.[side]}
				onClick={() => onSelect?.(game.id, team.team, opponent.team, side === 'home', team.odds)}
			/>
		);
	};

	return (
		<div className={cn('relative rounded-2xl p-3 sm:p-4', phase === 'live' && 'bg-live/[0.04]')}>
			<div className='mb-3 flex items-center justify-between gap-2 px-1'>
				<StatusBar game={game} phase={phase} />
				{isUpset && (
					<span className='inline-flex items-center gap-1 rounded-full bg-brand-hot px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_6px_20px_-6px_rgba(255,61,90,0.8)]'>
						<Flame className='h-3 w-3' /> Upset
					</span>
				)}
			</div>

			<div className='flex items-stretch gap-2 sm:gap-3'>
				{tile('away')}
				<div className='flex w-5 shrink-0 flex-col items-center justify-center sm:w-6'>
					<span className='font-display text-sm font-bold italic text-muted-foreground/70'>@</span>
				</div>
				{tile('home')}
			</div>
		</div>
	);
}

export type { Game, GameCardProps, TeamInfo };
