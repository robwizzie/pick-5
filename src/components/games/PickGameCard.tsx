import { GameCard, LockBadge } from './GameCard';
import type { Game } from './GameCard';
import { cn } from '@/lib/utils';

interface UserPick {
	userId: string;
	name: string;
	image: string | null;
}

interface GamePicksData {
	away: UserPick[];
	home: UserPick[];
}

interface PickGameCardProps {
	game: Game;
	pick: {
		gameId: string;
		team: string;
		opponent: string;
		isHome: boolean;
		odds?: number;
	};
	pickIndex: number;
	gameFinished?: boolean;
	gameInProgress?: boolean;
	showScores?: boolean;
	isCorrect?: boolean | null;
	pickPoints?: number;
	leaguePicks?: GamePicksData;
	leagueMode?: string;
	variant?: 'picks' | 'results'; // 'picks' for WeeklyPicks, 'results' for Results
	/** This pick is the player's lock of the week (pickPoints should already be doubled). */
	isLock?: boolean;
}

/** A game card framed as one of the user's five picks, with its result. */
export function PickGameCard({
	game,
	pick,
	pickIndex,
	gameFinished = false,
	gameInProgress = false,
	showScores = false,
	isCorrect = null,
	pickPoints = 0,
	leaguePicks,
	leagueMode = 'standard',
	variant = 'results',
	isLock = false
}: PickGameCardProps) {
	// Show the odds locked in when the pick was made, not today's line
	const gameCardData: Game = {
		...game,
		away: {
			...game.away,
			score: showScores && typeof game.away.score === 'number' ? game.away.score : undefined,
			odds: !pick.isHome && pick.odds !== undefined ? pick.odds : game.away.odds
		},
		home: {
			...game.home,
			score: showScores && typeof game.home.score === 'number' ? game.home.score : undefined,
			odds: pick.isHome && pick.odds !== undefined ? pick.odds : game.home.odds
		}
	};

	const graded = gameFinished && typeof isCorrect === 'boolean';
	const won = graded && isCorrect === true;

	return (
		<div
			className={cn(
				'glass relative overflow-hidden rounded-2xl',
				graded && (won ? 'border-accent/30' : 'border-accent-2/25'),
				gameInProgress && 'border-live/30',
				isLock && !graded && !gameInProgress && 'border-warning/30'
			)}
		>
			{/* Result accent bar */}
			<div className={cn('absolute inset-y-0 left-0 w-1', graded ? (won ? 'bg-accent' : 'bg-accent-2') : gameInProgress ? 'bg-live' : 'bg-primary/60')} />

			<div className='flex items-center justify-between gap-2 border-b border-white/[0.06] py-2.5 pl-5 pr-4'>
				<span className='flex items-center gap-2'>
					<span className='font-display text-sm font-bold uppercase italic tracking-wide text-muted-foreground'>
						Pick <span className='text-foreground tabular'>{pickIndex + 1}</span>
					</span>
					{isLock && <LockBadge />}
				</span>

				{variant === 'results' &&
					(gameFinished ? (
						<span
							className={cn(
								'rounded-full px-2.5 py-0.5 font-display text-sm font-bold italic tabular',
								pickPoints > 0 ? 'bg-accent/15 text-accent' : 'bg-white/[0.06] text-muted-foreground'
							)}
						>
							{pickPoints > 0 ? `+${pickPoints}` : '0'} pts
						</span>
					) : gameInProgress ? (
						<span className='inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-live'>
							<span className='live-dot' /> In play
						</span>
					) : (
						<span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>Pending</span>
					))}
			</div>

			<div className='pointer-events-none pl-1'>
				<GameCard
					game={gameCardData}
					selected={pick.team}
					showScores={showScores}
					disabled
					isCorrect={gameFinished ? isCorrect : null}
					noHover
					leaguePicks={gameFinished || gameInProgress ? leaguePicks : undefined}
					leagueMode={leagueMode}
					lockedTeam={isLock ? pick.team : undefined}
				/>
			</div>
		</div>
	);
}
