import Image from 'next/image';
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
	game?: Game;
	selected?: string;
	onSelect?: (gameId: string, team: string, opponent: string, isHome: boolean) => void;
	showScores?: boolean;
	disabled?: boolean;
	isCorrect?: boolean | null;
}

export function GameCard({ game, selected, onSelect, showScores, disabled }: GameCardProps) {
	if (!game) {
		return <div className='border rounded-lg p-4 bg-white'>Loading game data...</div>;
	}

	return (
		<div className='border rounded-lg p-4 bg-white hover:shadow-md transition-shadow'>
			<div className='flex justify-between items-center relative'>
				{/* Away Team */}
				<div className='flex-1 relative'>
					<Button variant={selected === game.away.team ? 'default' : 'outline'} onClick={() => onSelect?.(game.id, game.away.team, game.home.team, false)} disabled={disabled} className='w-full h-auto py-2 px-4'>
						<div className='flex items-center space-x-3'>
							<div className='relative w-8 h-8'>
								<Image src={game.away.logo} alt={game.away.team} fill className='object-contain' unoptimized />
							</div>
							<div className='text-left'>
								<div className='font-medium'>{game.away.team}</div>
								<div className='text-xs text-gray-500'>{game.away.record}</div>
								{showScores && game.away.score !== undefined && <div className='text-lg font-bold mt-1'>{game.away.score}</div>}
							</div>
						</div>
					</Button>
					{/* Selected Badge */}
					{selected === game.away.team && <div className='absolute top-[-10px] right-[-15px] px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium'>Selected</div>}
				</div>

				{/* Game Info */}
				<div className='flex flex-col items-center mx-4 min-w-20'>
					<span className='text-sm font-medium'>@</span>
					<span className='text-xs text-gray-500'>{new Date(game.date).toLocaleDateString()}</span>
				</div>

				{/* Home Team */}
				<div className='flex-1 relative'>
					<Button variant={selected === game.home.team ? 'default' : 'outline'} onClick={() => onSelect?.(game.id, game.home.team, game.away.team, true)} disabled={disabled} className='w-full h-auto py-2 px-4'>
						<div className='flex items-center space-x-3'>
							<div className='relative w-8 h-8'>
								<Image src={game.home.logo} alt={game.home.team} fill className='object-contain' unoptimized />
							</div>
							<div className='text-left'>
								<div className='font-medium'>{game.home.team}</div>
								<div className='text-xs text-gray-500'>{game.home.record}</div>
								{showScores && game.home.score !== undefined && <div className='text-lg font-bold mt-1'>{game.home.score}</div>}
							</div>
						</div>
					</Button>
					{/* Selected Badge */}
					{selected === game.home.team && <div className='absolute top-[-10px] right-[-15px] px-3 py-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium'>Selected</div>}
				</div>
			</div>
		</div>
	);
}

export type { Game, GameCardProps, TeamInfo };
