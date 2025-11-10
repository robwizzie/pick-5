'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Link as LinkIcon, Trophy, CheckCircle2, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { NFLService } from '@/services/nflService';

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
						const userWeeklyData = data.weeklyResults?.find((r: any) => r.userId === userId);
						const userSeasonData = data.seasonStats?.find((s: any) => s.player === userWeeklyData?.player);

						// Calculate user's rank
						const sortedResults = [...(data.weeklyResults || [])].sort((a, b) => b.points - a.points);
						const userRank = sortedResults.findIndex((r: any) => r.userId === userId) + 1;

						statsMap.set(league._id, {
							hasPicks: userWeeklyData?.hasPicks || false,
							currentWeekPoints: userWeeklyData?.points || 0,
							rank: userRank > 0 ? userRank : null,
							totalMembers: data.weeklyResults?.length || league.members?.length || 0,
							seasonPoints: userSeasonData?.totalPoints || 0
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

	return (
		<div className='grid grid-cols-1 gap-4'>
			{leagues.map(league => {
				const isCommissioner = userId && league.creatorId === userId;
				const stats = leagueStats.get(league._id);
				const isLoading = !stats && leagues.length > 0;

				return (
					<div key={league._id} className='relative'>
						<button
							onClick={() => router.push(`/league/${league._id}`)}
							className='w-full p-4 sm:p-6 bg-card border-2 border-primary/20 rounded-lg text-left transition-all hover:bg-primary/10 hover:border-primary/40 group'
						>
							{/* Mobile Layout: Stack vertically */}
							<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6'>
								{/* Top Section on Mobile, Left on Desktop: League Info */}
								<div className='flex-1 min-w-0'>
									{/* League Name & Mode Badge */}
									<div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap'>
										<h3 className='font-oswald text-xl sm:text-2xl uppercase tracking-wide text-primary group-hover:text-primary/80 transition-colors'>
											{league.name}
										</h3>
										{league.mode && (
											<span className='text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary/80 font-medium whitespace-nowrap'>
												{league.mode === 'steve' ? 'Steve' : 'Standard'}
											</span>
										)}
									</div>

									{/* Status & Stats */}
									{isLoading ? (
										<div className='flex items-center gap-3 sm:gap-4'>
											<div className='h-4 w-28 sm:w-32 bg-muted/20 rounded animate-pulse' />
											<div className='h-4 w-20 sm:w-24 bg-muted/20 rounded animate-pulse' />
										</div>
									) : stats ? (
										<div className='flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm'>
											{/* Picks Status */}
											<div className='flex items-center gap-1.5 sm:gap-2'>
												{stats.hasPicks ? (
													<>
														<CheckCircle2 className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400 flex-shrink-0' />
														<span className='text-green-400 font-medium'>Picks In</span>
													</>
												) : (
													<>
														<Clock className='h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400 flex-shrink-0' />
														<span className='text-orange-400 font-medium'>Picks Needed</span>
													</>
												)}
											</div>

											{/* Rank & Members */}
											{stats.rank && (
												<div className='flex items-center gap-1.5 text-muted-foreground'>
													<Trophy className='h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0' />
													<span className='whitespace-nowrap'>#{stats.rank} of {stats.totalMembers}</span>
												</div>
											)}
										</div>
									) : null}
								</div>

								{/* Bottom Section on Mobile, Right on Desktop: Points & Menu */}
								<div className='flex items-center justify-between sm:justify-end gap-4 sm:gap-6'>
									{/* Points Display */}
									{isLoading ? (
										<div className='text-right space-y-1'>
											<div className='h-6 sm:h-8 w-12 sm:w-16 bg-muted/20 rounded animate-pulse mb-1' />
											<div className='h-3 w-16 sm:w-20 bg-muted/20 rounded animate-pulse' />
										</div>
									) : stats ? (
										<div className='text-left sm:text-right space-y-0.5 sm:space-y-1'>
											<div className='flex items-center sm:justify-end gap-1.5 sm:gap-2'>
												<span className='text-2xl sm:text-3xl font-bold text-primary tabular-nums'>{stats.currentWeekPoints}</span>
												<span className='text-xs text-muted-foreground self-end mb-0.5'>pts</span>
											</div>
											<p className='text-xs text-muted-foreground'>Week {currentWeek}</p>
											{stats.seasonPoints > 0 && (
												<p className='text-xs text-muted-foreground/70 tabular-nums'>{stats.seasonPoints} Season</p>
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
					</div>
				);
			})}
		</div>
	);
}
