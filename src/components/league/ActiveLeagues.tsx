'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Link as LinkIcon, Users, Trophy, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
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
	const [currentWeek, setCurrentWeek] = useState<number>(1);

	useEffect(() => {
		const loadCurrentWeek = async () => {
			const week = await NFLService.getCurrentWeek();
			setCurrentWeek(week);
		};
		loadCurrentWeek();
	}, []);

	useEffect(() => {
		const loadLeagueStats = async () => {
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
		};

		if (leagues.length > 0 && userId && currentWeek) {
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

				return (
					<div key={league._id} className='relative'>
						<button
							onClick={() => router.push(`/league/${league._id}`)}
							className='w-full p-6 bg-card border-2 border-primary/20 rounded-lg text-left transition-all hover:bg-primary/10 hover:border-primary/40 group'
						>
							<div className='flex items-start justify-between gap-4'>
								{/* Left: League Name & Mode */}
								<div className='flex-1 space-y-3'>
									<div className='flex items-center gap-3'>
										<h3 className='font-oswald text-2xl uppercase tracking-wide text-primary group-hover:text-primary/80 transition-colors'>
											{league.name}
										</h3>
										{league.mode && (
											<span className='text-xs px-2 py-1 rounded-full bg-primary/10 text-primary/80 font-medium'>
												{league.mode === 'steve' ? 'Steve Mode' : 'Standard'}
											</span>
										)}
									</div>

									{/* Stats Row */}
									<div className='flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
										{/* Picks Status */}
										<div className='flex items-center gap-1.5'>
											{stats?.hasPicks ? (
												<>
													<CheckCircle2 className='h-4 w-4 text-green-400' />
													<span className='text-green-400'>Week {currentWeek} Picks In</span>
												</>
											) : (
												<>
													<Clock className='h-4 w-4 text-orange-400' />
													<span className='text-orange-400'>Week {currentWeek} Picks Needed</span>
												</>
											)}
										</div>

										{/* Rank */}
										{stats?.rank && (
											<div className='flex items-center gap-1.5'>
												<Trophy className='h-4 w-4' />
												<span>Rank #{stats.rank} of {stats.totalMembers}</span>
											</div>
										)}

										{/* Members */}
										{stats?.totalMembers && (
											<div className='flex items-center gap-1.5'>
												<Users className='h-4 w-4' />
												<span>{stats.totalMembers} {stats.totalMembers === 1 ? 'Member' : 'Members'}</span>
											</div>
										)}
									</div>
								</div>

								{/* Right: Points & Actions */}
								<div className='flex items-center gap-6'>
									{/* Points Display */}
									{stats && (
										<div className='text-right space-y-1'>
											<div className='flex items-center gap-2'>
												<TrendingUp className='h-4 w-4 text-primary' />
												<span className='text-2xl font-bold text-primary'>{stats.currentWeekPoints}</span>
											</div>
											<p className='text-xs text-muted-foreground'>This Week</p>
											{stats.seasonPoints > 0 && (
												<p className='text-xs text-muted-foreground'>{stats.seasonPoints} Season Total</p>
											)}
										</div>
									)}

									{/* Commissioner Menu */}
									{isCommissioner && (
										<div onClick={handleDropdownClick}>
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
