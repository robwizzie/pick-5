import { GameCard } from './GameCard';
import type { Game } from './GameCard';

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
}

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
	variant = 'results'
}: PickGameCardProps) {
	const badgeStyle = 'absolute px-2 py-1 rounded-full text-xs font-medium border';

	const getPointsColor = (points: number) => {
		if (points > 0) return 'bg-[#22c55e] text-black';
		if (points < 0) return 'bg-destructive text-white';
		return 'bg-muted text-muted-foreground';
	};

	// Build game data with scores and odds
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

	return (
		<div className='relative rounded-lg overflow-hidden border-2 bg-card border-primary/20 pointer-events-none'>
			{/* Left Badge: Pick Number */}
			<div className={`${badgeStyle} top-2 left-2 z-10 bg-primary text-black`}>
				Pick {pickIndex + 1}
			</div>

			{/* Center Badge: Date */}
			<div className='absolute top-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full bg-primary text-black text-xs font-medium shadow-md z-10'>
				{new Date(game.date).toLocaleDateString()}
			</div>

			{/* Right Badge: Points/Status (only for Results variant) */}
			{variant === 'results' && (
				<>
					{gameFinished ? (
						<div className={`${badgeStyle} top-2 right-2 z-10 ${getPointsColor(pickPoints)}`}>
							{pickPoints > 0 ? `+${pickPoints} pts` : '0 pts'}
						</div>
					) : gameInProgress ? (
						<div className={`${badgeStyle} top-2 right-2 z-10 bg-green-500/20 text-green-400 border-green-500/50`}>
							Live
						</div>
					) : (
						<div className={`${badgeStyle} top-2 right-2 z-10 bg-muted text-muted-foreground`}>
							Pending
						</div>
					)}
				</>
			)}

			{/* Game Card */}
			<div className='mt-8'>
				<GameCard
					game={gameCardData}
					selected={pick.team}
					showScores={showScores}
					disabled={true}
					isCorrect={gameFinished ? isCorrect : null}
					noHover={true}
					leaguePicks={gameFinished ? leaguePicks : undefined}
					leagueMode={leagueMode}
				/>
			</div>
		</div>
	);
}
