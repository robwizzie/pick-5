'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Link as LinkIcon, Trophy, CheckCircle2, Clock, Crown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { NFLService } from '@/services/nflService';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import CountUp from 'react-countup';
import Image from 'next/image';

interface League {
	_id: string;
	name: string;
	sport: string;
	creatorId?: string;
	inviteCode?: string;
	mode?: string;
	members?: string[];
}

interface ActiveLeaguesProps {
	leagues: League[];
	userId?: string;
}

interface LeagueStats {
	hasPicks: boolean;
	currentWeekPoints: number;
	rank: number | null;
	totalMembers: number;
	seasonPoints: number;
	pickedTeams?: Array<{ team: string; abbreviation: string; logo: string; gameStatus: 'scheduled' | 'in_progress' | 'final'; isCorrect: boolean | null }>;
	tfsPoints?: number;
}

export default function ActiveLeagues({ leagues, userId }: ActiveLeaguesProps) {
	const router = useRouter();
	const [copiedLeagueId, setCopiedLeagueId] = useState<string | null>(null);
	const [leagueStats, setLeagueStats] = useState<Map<string, LeagueStats>>(new Map());
	const [currentWeek, setCurrentWeek] = useState<number | null>(null);
	const isLoadingRef = useRef(false);

	useEffect(() => {
		const loadCurrentWeek = async () => {
			const week = await NFLService.getCurrentWeek();
			setCurrentWeek(week);
		};
		loadCurrentWeek();
	}, []);

	useEffect(() => {
		const loadLeagueStats = async () => {
			// Prevent multiple simultaneous loads
			if (isLoadingRef.current) return;

			isLoadingRef.current = true;
			const statsMap = new Map<string, LeagueStats>();

			for (const league of leagues) {
				try {
					// Fetch leaderboard data for this league
					const response = await fetch(`/api/leaderboard?week=${currentWeek}&leagueId=${league._id}`);
					if (response.ok) {
						const data = await response.json();

						// Find user's data in weekly results
						const userWeeklyData = data.weeklyResults?.find((r: { userId?: string; player?: string; points?: number; hasPicks?: boolean; pickedTeams?: string[]; tfsPoints?: number }) => r.userId === userId);
						const userSeasonData = data.seasonStats?.find((s: { player?: string; totalPoints?: number }) => s.player === userWeeklyData?.player);

						// Calculate user's season rank (based on total season points)
						const sortedSeasonStats = [...(data.seasonStats || [])].sort((a: { totalPoints?: number }, b: { totalPoints?: number }) => (b.totalPoints || 0) - (a.totalPoints || 0));
						const userRank = sortedSeasonStats.findIndex((s: { player?: string }) => s.player === userWeeklyData?.player) + 1;

						statsMap.set(league._id, {
							hasPicks: userWeeklyData?.hasPicks || false,
							currentWeekPoints: userWeeklyData?.points || 0,
							rank: userRank > 0 ? userRank : null,
							totalMembers: data.weeklyResults?.length || league.members?.length || 0,
							seasonPoints: userSeasonData?.totalPoints || 0,
							pickedTeams: userWeeklyData?.pickedTeams || [],
							tfsPoints: userWeeklyData?.tfsPoints || 0
						});
					}
				} catch (error) {
					console.error(`Error loading stats for league ${league._id}:`, error);
				}
			}

			setLeagueStats(statsMap);
			isLoadingRef.current = false;
		};

		if (leagues.length > 0 && userId && currentWeek !== null) {
			loadLeagueStats();
		}
	}, [leagues, userId, currentWeek]);

	const handleCopyInviteLink = (e: React.MouseEvent, league: League) => {
		e.stopPropagation();
		if (!league.inviteCode) return;

		const inviteUrl = `${window.location.origin}/league/join/${league.inviteCode}`;
		navigator.clipboard.writeText(inviteUrl);

		setCopiedLeagueId(league._id);
		setTimeout(() => setCopiedLeagueId(null), 2000);
	};

	const handleDropdownClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	// Helper functions for top 3 styling
	const getRankBadgeStyle = (rank: number | null) => {
		if (rank === 1) return 'bg-yellow-500/20 text-yellow-400';
		if (rank === 2) return 'bg-gray-400/20 text-gray-300';
		if (rank === 3) return 'bg-orange-500/20 text-orange-400';
		return 'bg-primary/10 text-primary/80';
	};

	const getTop3BorderStyle = (rank: number | null) => {
		if (rank === 1) return 'border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.25)]';
		if (rank === 2) return 'border-gray-400/30 shadow-[0_0_15px_rgba(156,163,175,0.15)] hover:shadow-[0_0_25px_rgba(156,163,175,0.25)]';
		if (rank === 3) return 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)]';
		return 'border-primary/20 hover:border-primary/40';
	};

	const getGradientBackground = (rank: number | null) => {
		if (rank === 1) return 'bg-gradient-to-br from-yellow-500/10 via-transparent to-yellow-500/5';
		if (rank === 2) return 'bg-gradient-to-br from-gray-400/10 via-transparent to-gray-400/5';
		if (rank === 3) return 'bg-gradient-to-br from-orange-500/10 via-transparent to-orange-500/5';
		return '';
	};

	const getRankGradientText = (rank: number | null) => {
		if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 bg-clip-text text-transparent';
		if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 bg-clip-text text-transparent';
		if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600 bg-clip-text text-transparent';
		return 'text-primary';
	};

	return (
		<div className='grid grid-cols-1 gap-4'>
			{leagues.map((league, index) => {
				const isCommissioner = userId && league.creatorId === userId;
				const stats = leagueStats.get(league._id);
				const isLoading = !stats && leagues.length > 0;
				const rank = stats?.rank || null;
				const isTop3 = rank !== null && rank <= 3;

				return (
					<motion.div
						key={league._id}
						className='relative'
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							duration: 0.3,
							delay: index * 0.05,
							ease: 'easeOut'
						}}
						whileHover={{ scale: 1.01 }}
						whileTap={{ scale: 0.99 }}
					>
						<button
							onClick={() => router.push(`/league/${league._id}`)}
							className={`relative overflow-hidden w-full p-5 sm:p-6 glass border-2 rounded-xl text-left transition-all duration-300 hover:bg-card/80 group ${getTop3BorderStyle(rank)} ${getGradientBackground(rank)}`}
						>
							<div className='flex items-start gap-4 sm:gap-6'>
								{/* Large Rank Number on Left */}
								{rank && (
									<div className='flex-shrink-0'>
										<div className={`text-6xl sm:text-7xl font-bold font-mono leading-none ${getRankGradientText(rank)}`}>
											#{rank}
										</div>
									</div>
								)}

								{/* Middle Section: League Info */}
								<div className='flex-1 min-w-0 space-y-3'>
									{/* League Name & Mode Badge */}
									<div className='flex items-center gap-2.5 flex-wrap'>
										<h3 className='font-oswald text-lg sm:text-xl uppercase tracking-wider text-foreground group-hover:text-primary transition-colors font-bold'>
											{league.name}
										</h3>
										{league.mode && (
											<span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
												league.mode === 'steve'
													? 'bg-green-500/20 text-green-400'
													: 'bg-blue-500/20 text-blue-400'
											}`}>
												{league.mode === 'steve' ? 'Steve' : 'Standard'}
											</span>
										)}
									</div>

									{/* Status & Stats Row */}
									{isLoading ? (
										<div className='flex items-center gap-3'>
											<Skeleton className='h-4 w-28' />
											<Skeleton className='h-4 w-20' />
										</div>
									) : stats ? (
										<div className='flex flex-wrap items-center gap-3 text-sm'>
											{/* Picks Status */}
											<div className='flex items-center gap-1.5'>
												{stats.hasPicks ? (
													<>
														<div className='px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 flex items-center gap-1.5'>
															<CheckCircle2 className='h-3.5 w-3.5 text-green-400 flex-shrink-0' />
															<span className='text-green-400 font-semibold text-xs'>Picks In</span>
														</div>
													</>
												) : (
													<>
														<div className='px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center gap-1.5'>
															<Clock className='h-3.5 w-3.5 text-orange-400 flex-shrink-0' />
															<span className='text-orange-400 font-semibold text-xs'>Picks Needed</span>
														</div>
													</>
												)}
											</div>

											{/* Members Count */}
											<span className='text-xs text-muted-foreground'>
												{stats.totalMembers} {stats.totalMembers === 1 ? 'member' : 'members'}
											</span>
										</div>
									) : null}

									{/* Team Logos - Always at bottom */}
									{!isLoading && stats?.hasPicks && stats.pickedTeams && stats.pickedTeams.length > 0 && (
										<div className='flex flex-wrap items-center gap-2'>
											{stats.pickedTeams.map((teamData, idx) => {
												// Determine background color based on game status and result
												let bgClass = 'bg-white/10 border-white/20';
												if (teamData.gameStatus === 'in_progress') {
													bgClass = 'bg-blue-400/30 border-blue-400/50';
												} else if (teamData.gameStatus === 'final') {
													if (teamData.isCorrect === true) {
														bgClass = 'bg-green-500/30 border-green-500/50';
													} else if (teamData.isCorrect === false) {
														bgClass = 'bg-red-500/30 border-red-500/50';
													}
												}

												return (
													<div key={idx} className={`w-9 h-9 sm:w-10 sm:h-10 relative rounded-md p-1 border-2 ${bgClass} transition-all duration-200 hover:scale-110`}>
														<Image
															src={teamData.logo}
															alt={teamData.abbreviation}
															width={40}
															height={40}
															className='rounded-sm object-contain'
															unoptimized
														/>
													</div>
												);
											})}
											{/* TFS Badge for Steve mode */}
											{league.mode === 'steve' && stats.tfsPoints !== undefined && stats.tfsPoints > 0 && (
												<span className='text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold whitespace-nowrap border border-purple-500/30'>
													{stats.tfsPoints} TFS
												</span>
											)}
										</div>
									)}
								</div>

								{/* Right Side: Points Display */}
								<div className='flex-shrink-0 flex items-start gap-3'>
									{isLoading ? (
										<div className='text-right space-y-1'>
											<Skeleton className='h-10 w-20' />
											<Skeleton className='h-3 w-24' />
										</div>
									) : stats ? (
										<div className='text-right space-y-1'>
											<div className='flex items-center justify-end gap-1.5'>
												<span className='text-4xl sm:text-5xl font-bold text-primary tabular-nums font-mono leading-none'>
													<CountUp end={stats.seasonPoints} duration={0.5} />
												</span>
												<span className='text-sm text-muted-foreground self-end mb-1 font-medium'>pts</span>
											</div>
											{stats.currentWeekPoints > 0 && (
												<p className='text-xs text-green-400 tabular-nums font-mono font-bold'>
													+<CountUp end={stats.currentWeekPoints} duration={0.5} /> this week
												</p>
											)}
										</div>
									) : null}

									{/* Commissioner Menu */}
									{isCommissioner && (
										<div onClick={handleDropdownClick} className='flex-shrink-0'>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant='ghost' size='sm' className='h-8 w-8 p-0 hover:bg-primary/20'>
														<MoreVertical className='h-4 w-4' />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align='end' className='glass border-white/10 backdrop-blur-xl'>
													<DropdownMenuItem onClick={e => handleCopyInviteLink(e, league)} className='cursor-pointer hover:bg-primary/10'>
														<LinkIcon className='h-4 w-4 mr-2' />
														{copiedLeagueId === league._id ? 'Copied!' : 'Copy League Link'}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									)}
								</div>
							</div>
						</button>
					</motion.div>
				);
			})}
		</div>
	);
}
