// src/components/games/GameCard.tsx
import { Button } from '@/components/ui/button';

interface TeamInfo {
	team: string;
	abbreviation: string;
	logo: string;
	record: string;
	score?: number;
}

interface Game {
	id: string;
	home: TeamInfo;
	away: TeamInfo;
	date: Date;
	status?: string;
}

interface GameCardProps {
	game: Game;
	selected?: string;
	onSelect?: (gameId: string, team: string, opponent: string, isHome: boolean) => void;
	showScores?: boolean;
	disabled?: boolean;
	isCorrect?: boolean | null; // Add this prop to show if pick was correct
}

export function GameCard({ game, selected, onSelect, showScores, disabled, isCorrect }: GameCardProps) {
	// Function to determine button variant based on selection and correctness
	const getButtonVariant = (isSelected: boolean) => {
		if (!isSelected) return 'outline';
		if (isCorrect === undefined || isCorrect === null) return 'default';
		return isCorrect ? 'success' : 'destructive';
	};

	return (
		<div className='border rounded-lg p-4 bg-white hover:shadow-md transition-shadow'>
			<div className='flex justify-between items-center'>
				{/* Away Team */}
				<div className='flex-1'>
					<Button variant={getButtonVariant(selected === game.away.team)} onClick={() => onSelect?.(game.id, game.away.team, game.home.team, false)} disabled={disabled} className='w-full h-auto py-2 px-4'>
						<div className='flex items-center space-x-3'>
							<img src={game.away.logo} alt={game.away.team} className='w-8 h-8 object-contain' />
							<div className='text-left'>
								<div className='font-medium'>{game.away.team}</div>
								<div className='text-xs text-gray-500'>{game.away.record}</div>
								{showScores && game.away.score !== undefined && <div className='text-lg font-bold mt-1'>{game.away.score}</div>}
							</div>
						</div>
					</Button>
				</div>

				{/* Game Info */}
				<div className='flex flex-col items-center mx-4 min-w-20'>
					<span className='text-sm font-medium'>@</span>
					<span className='text-xs text-gray-500'>{new Date(game.date).toLocaleDateString()}</span>
					{game.status && <span className='text-xs text-gray-500 mt-1'>{game.status}</span>}
				</div>

				{/* Home Team */}
				<div className='flex-1'>
					<Button variant={getButtonVariant(selected === game.home.team)} onClick={() => onSelect?.(game.id, game.home.team, game.away.team, true)} disabled={disabled} className='w-full h-auto py-2 px-4'>
						<div className='flex items-center space-x-3'>
							<img src={game.home.logo} alt={game.home.team} className='w-8 h-8 object-contain' />
							<div className='text-left'>
								<div className='font-medium'>{game.home.team}</div>
								<div className='text-xs text-gray-500'>{game.home.record}</div>
								{showScores && game.home.score !== undefined && <div className='text-lg font-bold mt-1'>{game.home.score}</div>}
							</div>
						</div>
					</Button>
				</div>
			</div>
		</div>
	);
}

export type { Game, GameCardProps, TeamInfo };
