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
	noHover?: boolean;
}

export function GameCard({ game, selected, onSelect, showScores, disabled, isCorrect, noHover }: GameCardProps) {
	if (!game) return null;

	const getTeamButtonStyle = (isTeamSelected: boolean, isTeamCorrect: boolean | null) => {
		const fontWeight = isTeamSelected ? 'font-bold' : 'font-normal';
		const baseStyle = `${fontWeight} !hover:bg-transparent !hover:border-current !active:scale-100`;

		if (!isTeamSelected) return `border-primary/20 text-white ${baseStyle}`;
		if (isTeamCorrect === true) return `bg-[#22c55e] text-black border-[#22c55e] ${baseStyle}`;
		if (isTeamCorrect === false) return `bg-destructive text-black border-destructive ${baseStyle}`;
		return `bg-primary text-black border-primary ${baseStyle}`;
	};

	const buttonProps = noHover
		? {
				variant: 'outline' as const,
				className: `w-full h-auto py-2 px-4 !ring-0 !ring-offset-0`,
				onClick: undefined,
				disabled: false
		  }
		: {
				variant: 'outline' as const,
				className: 'w-full h-auto py-2 px-4',
				onClick: () => onSelect?.(game.id, game.away.team, game.home.team, false),
				disabled
		  };

	return (
		<div className='relative'>
			{/* GameCard Container */}
			<div className='rounded-lg p-4 bg-card transition-all'>
				<div className='flex flex-col xl:flex-row xl:justify-between xl:items-center'>
					{/* Away Team */}
					<div className='flex-1 xl:mr-4'>
						<Button {...buttonProps} className={`${buttonProps.className} ${getTeamButtonStyle(selected === game.away.team, selected === game.away.team ? isCorrect ?? null : null)}`}>
							<div className='flex items-center space-x-3'>
								<div className='relative w-6 h-6 xl:w-8 xl:h-8'>
									<Image src={game.away.logo} alt={game.away.team} fill className='object-contain' unoptimized />
								</div>
								<div className='text-left'>
									<div className={`font-oswald uppercase tracking-wide ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>{game.away.team}</div>
									<div className={`text-xs ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>{game.away.record}</div>
									{showScores && game.away.score !== undefined && <div className={`text-lg mt-1 ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>{game.away.score}</div>}
								</div>
							</div>
						</Button>
					</div>

					{/* Center Section */}
					<div className='flex flex-row justify-center items-center my-4 xl:my-0 xl:mx-4 xl:flex-col min-w-[80px]'>
						<span className='text-sm font-medium text-accent'>@</span>
					</div>

					{/* Home Team */}
					<div className='flex-1 xl:ml-4'>
						<Button {...buttonProps} onClick={noHover ? undefined : () => onSelect?.(game.id, game.home.team, game.away.team, true)} className={`${buttonProps.className} ${getTeamButtonStyle(selected === game.home.team, selected === game.home.team ? isCorrect ?? null : null)}`}>
							<div className='flex items-center space-x-3'>
								<div className='relative w-6 h-6 xl:w-8 xl:h-8'>
									<Image src={game.home.logo} alt={game.home.team} fill className='object-contain' unoptimized />
								</div>
								<div className='text-left'>
									<div className={`font-oswald uppercase tracking-wide ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>{game.home.team}</div>
									<div className={`text-xs ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>{game.home.record}</div>
									{showScores && game.home.score !== undefined && <div className={`text-lg mt-1 ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>{game.home.score}</div>}
								</div>
							</div>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

export type { Game, GameCardProps, TeamInfo };
