import Image from 'next/image';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { calculatePointsFromOdds, formatOdds, getOddsColorClass } from '@/utils/oddsUtils';

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
	periodDisplay?: string; // e.g., "1st", "2nd", "3rd", "4th", "OT"
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
}

// Component to render stacked avatars
function PickedByAvatars({ picks, maxVisible = 4 }: { picks: UserPick[]; maxVisible?: number }) {
	if (!picks || picks.length === 0) return null;

	const visiblePicks = picks.slice(0, maxVisible);
	const remainingCount = picks.length - maxVisible;
	const remainingNames = picks.slice(maxVisible).map(p => p.name).join(', ');

	return (
		<div className='flex items-center gap-0.5 mt-2'>
			<div className='flex -space-x-2'>
				{visiblePicks.map((pick, index) => (
					<div
						key={pick.userId}
						title={pick.name}
						className='cursor-help relative'
						style={{ zIndex: maxVisible - index }}
					>
						<Avatar className='w-6 h-6 border-2 border-card pointer-events-none'>
							<AvatarImage src={pick.image || undefined} alt={pick.name} />
							<AvatarFallback className='bg-primary/20 text-primary text-[10px] font-semibold'>
								{pick.name
									.split(' ')
									.map(n => n[0])
									.join('')
									.toUpperCase()
									.slice(0, 2)}
							</AvatarFallback>
						</Avatar>
					</div>
				))}
			</div>
			{remainingCount > 0 && (
				<span
					className='text-xs text-black ml-1 cursor-help'
					title={remainingNames}
				>
					+{remainingCount}
				</span>
			)}
		</div>
	);
}

export function GameCard({ game, selected, onSelect, showScores, disabled, isCorrect, noHover, leaguePicks, leagueMode }: GameCardProps) {
	if (!game) return null;

	const isStandardMode = leagueMode === 'standard';

	// Helper function to format game date and time
	const formatGameDateTime = (date: Date) => {
		const gameDate = new Date(date);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());

		let dayText = '';
		if (gameDay.getTime() === today.getTime()) {
			dayText = 'Today';
		} else if (gameDay.getTime() === tomorrow.getTime()) {
			dayText = 'Tomorrow';
		} else {
			// Show day of week
			dayText = gameDate.toLocaleDateString('en-US', { weekday: 'short' });
		}

		const timeText = gameDate.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

		return { dayText, timeText, fullDate: gameDate };
	};

	// Helper function to get game status display
	const getGameStatus = () => {
		const status = game.status?.toLowerCase() || 'scheduled';
		const { dayText, timeText, fullDate } = formatGameDateTime(game.date);

		if (status === 'post' || status === 'final') {
			return {
				text: 'FINAL',
				color: 'text-muted-foreground',
				bgColor: 'bg-muted/30',
				dayText,
				timeText,
				fullDate
			};
		}

		if (status === 'in' || status === 'in_progress') {
			const periodText = game.periodDisplay || (game.period ? `Q${game.period}` : '');
			const clockText = game.clock || '';

			return {
				text: 'LIVE',
				color: 'text-green-400',
				bgColor: 'bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]',
				isLive: true,
				periodText,
				clockText,
				dayText,
				timeText,
				fullDate
			};
		}

		// Pre-game
		return {
			text: `${dayText} ${timeText}`,
			color: 'text-primary',
			bgColor: 'bg-primary/10',
			isScheduled: true,
			dayText,
			timeText,
			fullDate
		};
	};

	const statusInfo = getGameStatus();

	const getTeamButtonStyle = (isTeamSelected: boolean, isTeamCorrect: boolean | null) => {
		const fontWeight = isTeamSelected ? 'font-bold' : 'font-normal';
		const baseStyle = `${fontWeight} !hover:bg-transparent !hover:border-current !active:scale-100 backdrop-blur-sm`;

		if (!isTeamSelected) return `border-primary/20 text-white ${baseStyle}`;
		// Correct pick: Green with white text
		if (isTeamCorrect === true) return `bg-green-500 text-white border-green-500 ${baseStyle}`;
		// Incorrect pick: Red with white text
		if (isTeamCorrect === false) return `bg-red-500 text-white border-red-500 ${baseStyle}`;
		// Selected but not graded yet
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
				onClick: () => onSelect?.(game.id, game.away.team, game.home.team, false, game.away.odds),
				disabled
		  };

	// Determine winner if game is finished and scores are shown
	const isGameFinished = statusInfo.text === 'FINAL';
	const awayWon = showScores && isGameFinished && (game.away.score ?? 0) > (game.home.score ?? 0);
	const homeWon = showScores && isGameFinished && (game.home.score ?? 0) > (game.away.score ?? 0);

	// Check if this is an upset (underdog with +250 or worse odds won)
	const isUpset = isGameFinished && (
		(awayWon && (game.away.odds ?? 0) >= 250) ||
		(homeWon && (game.home.odds ?? 0) >= 250)
	);

	// Helper to get winner styling (for View All Games)
	const getWinnerStyle = (isWinner: boolean | undefined) => {
		if (!isWinner || !showScores || !isGameFinished) return '';
		return 'border-green-500/50 bg-green-500/10 backdrop-blur-sm';
	};

	return (
		<motion.div
			className='relative'
			initial={{ opacity: 0, y: 10 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-50px" }}
			transition={{ duration: 0.3 }}
		>
			{/* Upset Badge */}
			{isUpset && (
				<div className='absolute -top-2 -right-2 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse'>
					🔥 UPSET
				</div>
			)}

			{/* GameCard Container */}
			<div className='rounded-lg p-4 bg-card/80 backdrop-blur-sm transition-all shadow-sm hover:shadow-md'>
				<div className='flex flex-col xl:flex-row xl:justify-between xl:items-center'>
					{/* Away Team */}
					<div className='flex-1 xl:mr-4'>
						<Button {...buttonProps} className={`${buttonProps.className} ${getTeamButtonStyle(selected === game.away.team, selected === game.away.team ? isCorrect ?? null : null)} ${getWinnerStyle(awayWon)}`}>
							<div className='flex items-center space-x-3 w-full'>
								<div className='relative w-6 h-6 xl:w-8 xl:h-8 flex-shrink-0'>
									<Image src={game.away.logo} alt={game.away.team} fill className='object-contain' unoptimized />
								</div>
								<div className='text-left flex-1'>
									<div className={`font-oswald uppercase tracking-wide ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>{game.away.team}</div>
									<div className={`text-xs ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>{game.away.record}</div>
									{isStandardMode && game.away.odds !== undefined && (
										<div className='flex items-center gap-1.5 mt-1'>
											<span className={`text-xs font-semibold ${selected === game.away.team && isCorrect !== null ? 'text-white/90' : selected === game.away.team ? 'text-black/80' : getOddsColorClass(game.away.odds)}`}>{formatOdds(game.away.odds)}</span>
											<span className={`text-xs ${selected === game.away.team && isCorrect !== null ? 'text-white/70' : selected === game.away.team ? 'text-black/60' : 'text-muted-foreground'}`}>•</span>
											<span className={`text-xs font-bold ${selected === game.away.team && isCorrect !== null ? 'text-white' : selected === game.away.team ? 'text-black' : 'text-primary'}`}>{calculatePointsFromOdds(game.away.odds)} pts</span>
										</div>
									)}
									{showScores && game.away.score !== undefined && (
										<div className={`text-lg mt-1 font-mono ${selected === game.away.team ? 'font-bold' : 'font-medium'}`}>
											<CountUp end={game.away.score} duration={0.8} preserveValue />
										</div>
									)}
									{showScores && leaguePicks && <PickedByAvatars picks={leaguePicks.away} />}
								</div>
							</div>
						</Button>
					</div>

					{/* Center Section - Game Status & Time */}
					<div className='flex flex-col justify-center items-center my-4 xl:my-0 xl:mx-4 min-w-[120px] gap-2'>
						<span className='text-sm font-medium text-accent'>@</span>
						<div className={`px-3 py-1.5 rounded-full text-center ${statusInfo.bgColor} relative`}>
							{(statusInfo as any).isLive && (
								<span className='absolute -left-1 top-1/2 -translate-y-1/2 flex h-2 w-2'>
									<span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
									<span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
								</span>
							)}
							<div className={`text-xs font-semibold ${statusInfo.color} whitespace-nowrap`}>
								{statusInfo.isScheduled ? statusInfo.text : `${statusInfo.text}`}
							</div>
							<div className='text-[10px] text-muted-foreground mt-0.5'>
								{statusInfo.isScheduled ? (
									statusInfo.fullDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
								) : (statusInfo as any).isLive && (statusInfo as any).periodText ? (
									<div className='flex flex-col items-center gap-0.5'>
										<span className='text-green-400 font-semibold'>{(statusInfo as any).periodText}</span>
										{(statusInfo as any).clockText && <span className='text-primary font-mono'>{(statusInfo as any).clockText}</span>}
									</div>
								) : (
									`${statusInfo.dayText} ${statusInfo.timeText}`
								)}
							</div>
						</div>
					</div>

					{/* Home Team */}
					<div className='flex-1 xl:ml-4'>
						<Button {...buttonProps} onClick={noHover ? undefined : () => onSelect?.(game.id, game.home.team, game.away.team, true, game.home.odds)} className={`${buttonProps.className} ${getTeamButtonStyle(selected === game.home.team, selected === game.home.team ? isCorrect ?? null : null)} ${getWinnerStyle(homeWon)}`}>
							<div className='flex items-center space-x-3 w-full'>
								<div className='relative w-6 h-6 xl:w-8 xl:h-8 flex-shrink-0'>
									<Image src={game.home.logo} alt={game.home.team} fill className='object-contain' unoptimized />
								</div>
								<div className='text-left flex-1'>
									<div className={`font-oswald uppercase tracking-wide ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>{game.home.team}</div>
									<div className={`text-xs ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>{game.home.record}</div>
									{isStandardMode && game.home.odds !== undefined && (
										<div className='flex items-center gap-1.5 mt-1'>
											<span className={`text-xs font-semibold ${selected === game.home.team && isCorrect !== null ? 'text-white/90' : selected === game.home.team ? 'text-black/80' : getOddsColorClass(game.home.odds)}`}>{formatOdds(game.home.odds)}</span>
											<span className={`text-xs ${selected === game.home.team && isCorrect !== null ? 'text-white/70' : selected === game.home.team ? 'text-black/60' : 'text-muted-foreground'}`}>•</span>
											<span className={`text-xs font-bold ${selected === game.home.team && isCorrect !== null ? 'text-white' : selected === game.home.team ? 'text-black' : 'text-primary'}`}>{calculatePointsFromOdds(game.home.odds)} pts</span>
										</div>
									)}
									{showScores && game.home.score !== undefined && (
										<div className={`text-lg mt-1 font-mono ${selected === game.home.team ? 'font-bold' : 'font-medium'}`}>
											<CountUp end={game.home.score} duration={0.8} preserveValue />
										</div>
									)}
									{showScores && leaguePicks && <PickedByAvatars picks={leaguePicks.home} />}
								</div>
							</div>
						</Button>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

export type { Game, GameCardProps, TeamInfo };
