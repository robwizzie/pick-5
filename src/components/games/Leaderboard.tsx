'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { NFLService } from '@/services/nflService';
import { UserPicksModal } from './UserPicksModal';
import { Crown } from 'lucide-react';

export function Leaderboard() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const [weeklyResults, setWeeklyResults] = useState<Array<{ userId: string; player: string; image: string | null; points: number; correct: number; tfsPoints: number; hasPicks: boolean }>>([]);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	const [showUserPicks, setShowUserPicks] = useState(false);
	const [seasonStats, setSeasonStats] = useState<
		Record<
			string,
			{
				player: string;
				image: string | null;
				totalPoints: number;
				correctPicks: number;
				totalPicks: number;
				totalTFSPoints: number;
				winPercentage: number;
			}
		>
	>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [key, setKey] = useState(0); // Force rerender mechanism
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	// Fetch leaderboard data
	const fetchLeaderboard = async (isPolling = false) => {
		if (!leagueId) {
			setError('League ID is missing');
			return;
		}
		try {
			if (isPolling) {
				setIsUpdating(true);
			} else {
				setLoading(true);
			}
			setError(null);

			const response = await fetch(`/api/leaderboard?week=${currentWeek}&leagueId=${leagueId}`, { cache: 'no-store' });
			if (!response.ok) throw new Error('Failed to fetch leaderboard data');

			const data = await response.json();
			console.log('[Leaderboard Debug] Fetched leaderboard data:', data);

			setWeeklyResults(data.weeklyResults);
			setSeasonStats(data.seasonStats);
			setLastUpdated(new Date());
		} catch (err) {
			console.error('Failed to load leaderboard data:', err);
			setError('Failed to load leaderboard data.');
		} finally {
			setLoading(false);
			setIsUpdating(false);
		}
	};

	useEffect(() => {
		fetchLeaderboard(false); // Initial load

		const handleRefresh = () => {
			console.log('[Leaderboard Debug] Event triggered refresh');
			fetchLeaderboard(true);
			setKey(prev => prev + 1); // Trigger a rerender
		};

		window.addEventListener('refreshLeaderboard', handleRefresh);

		// Use smart polling interval (2 min during games, 5 min outside)
		const pollingInterval = NFLService.getPollingInterval();
		console.log(`[Leaderboard] Using ${pollingInterval / 1000 / 60} minute polling interval`);

		const pollInterval = setInterval(() => {
			console.log('[Leaderboard Debug] 🔄 Auto-refreshing standings...');
			fetchLeaderboard(true);
		}, pollingInterval);

		return () => {
			window.removeEventListener('refreshLeaderboard', handleRefresh);
			clearInterval(pollInterval);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeek, leagueId]);

	// Generate leaderboard data
	const weeklyLeaderboard = [...weeklyResults].sort((a, b) => {
		// Sort by points, then by hasPicks (those with picks first)
		if (b.points !== a.points) return b.points - a.points;
		return b.hasPicks ? 1 : -1;
	});

	const handleUserClick = (userId: string) => {
		setSelectedUserId(userId);
		setShowUserPicks(true);
	};

	const seasonLeaderboard = Object.entries(seasonStats)
		.map(([key, stats]) => ({
			player: stats.player || `User ${key.slice(-4)}`,
			image: stats.image,
			totalPoints: stats.totalPoints,
			correctPicks: stats.correctPicks,
			totalPicks: stats.totalPicks,
			totalTFSPoints: stats.totalTFSPoints,
			winPercentage: stats.winPercentage ? parseFloat(stats.winPercentage.toFixed(0)) : 0
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);

	// Helper function to format time ago
	const getTimeAgo = (date: Date | null) => {
		if (!date) return '';
		const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	};

	return (
		<Card key={key}>
			<CardHeader>
				<div className='flex items-center justify-between'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Leaderboard</CardTitle>
					<div className='flex items-center gap-2'>
						{isUpdating && (
							<div className='flex items-center gap-1 text-xs text-primary/80'>
								<div className='h-2 w-2 rounded-full bg-primary animate-pulse' />
								<span>Updating...</span>
							</div>
						)}
						{!isUpdating && lastUpdated && (
							<div className='flex items-center gap-1 text-xs text-muted-foreground'>
								<div className='h-2 w-2 rounded-full bg-green-500' />
								<span>Live • {getTimeAgo(lastUpdated)}</span>
							</div>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{loading && <Spinner />}
				{error && <p className='text-destructive'>{error}</p>}
				{!loading && !error && (
					<Tabs defaultValue='weekly'>
						<TabsList className='mb-4'>
							<TabsTrigger value='weekly'>Week {currentWeek}</TabsTrigger>
							<TabsTrigger value='season'>Season</TabsTrigger>
						</TabsList>

						<TabsContent value='weekly'>
							{weeklyLeaderboard.length === 0 ? (
								<div className='text-primary/80 text-center'>No users in this league yet.</div>
							) : (
								<div className='space-y-3'>
									{weeklyLeaderboard.map((entry, index) => {
										// Calculate actual rank considering ties
										let rank = 1;
										for (let i = 0; i < index; i++) {
											if (weeklyLeaderboard[i].points > entry.points) {
												rank = i + 2;
											}
										}

										const isFirstPlace = entry.points === weeklyLeaderboard[0].points && entry.points > 0;
										const getRankBadgeStyle = () => {
											if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 font-bold';
											if (rank === 2) return 'bg-gray-400/20 text-gray-300 font-bold';
											if (rank === 3) return 'bg-orange-500/20 text-orange-400 font-bold';
											return 'bg-primary/10 text-primary/80';
										};

										// Get special styling for top 3
										const getTop3Style = () => {
											if (rank === 1) return 'border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.25)]';
											if (rank === 2) return 'border-gray-400/30 shadow-[0_0_15px_rgba(156,163,175,0.15)] hover:shadow-[0_0_25px_rgba(156,163,175,0.25)]';
											if (rank === 3) return 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)]';
											return 'border-primary/20';
										};

										return (
											<div key={entry.userId || index} className={`flex items-start p-4 bg-card border-2 rounded-lg gap-3 transition-all duration-300 ${getTop3Style()} ${entry.hasPicks ? 'cursor-pointer hover:border-primary/50 hover:shadow-lg' : ''}`} onClick={() => entry.hasPicks && handleUserClick(entry.userId)}>
												{/* Rank with crown */}
												<div className='flex flex-col items-center gap-1 pt-1'>
													{isFirstPlace && <Crown className='w-5 h-5 text-yellow-400 animate-pulse' fill='currentColor' />}
													<span className={`text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center ${getRankBadgeStyle()}`}>{rank}</span>
												</div>

												{/* Main Content */}
												<div className='flex-1 min-w-0'>
													{/* Avatar + Name */}
													<div className='flex items-center gap-3 mb-2'>
														<Avatar className='w-10 h-10 flex-shrink-0'>
															<AvatarImage src={entry.image || undefined} alt={entry.player} />
															<AvatarFallback className='bg-primary/20 text-primary font-semibold'>{entry.player.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
														</Avatar>
														<span className='text-primary font-semibold truncate'>{entry.player}</span>
													</div>

													{/* Status Badge */}
													<div className='mb-2'>
														<span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block ${entry.hasPicks ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
															{entry.hasPicks ? 'Picks In' : 'Needs Pick'}
														</span>
													</div>

													{/* Points and TFS */}
													<div className='flex gap-6'>
														<div>
															<p className='text-xs text-primary/60 uppercase tracking-wide mb-1'>Points</p>
															<p className='text-2xl font-bold text-primary'>{entry.points}</p>
														</div>
														<div>
															<p className='text-xs text-primary/60 uppercase tracking-wide mb-1'>TFS</p>
															<p className='text-2xl font-bold text-accent'>{entry.tfsPoints}</p>
														</div>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</TabsContent>

						<TabsContent value='season'>
							<div className='space-y-3'>
								{seasonLeaderboard.map((entry, index) => {
									// Calculate actual rank considering ties
									let rank = 1;
									for (let i = 0; i < index; i++) {
										if (seasonLeaderboard[i].totalPoints > entry.totalPoints) {
											rank = i + 2;
										}
									}

									const isFirstPlace = entry.totalPoints === seasonLeaderboard[0].totalPoints && entry.totalPoints > 0;
									const getRankBadgeStyle = () => {
										if (rank === 1) return 'bg-yellow-500/20 text-yellow-400 font-bold';
										if (rank === 2) return 'bg-gray-400/20 text-gray-300 font-bold';
										if (rank === 3) return 'bg-orange-500/20 text-orange-400 font-bold';
										return 'bg-primary/10 text-primary/80';
									};

									// Get special styling for top 3
									const getTop3Style = () => {
										if (rank === 1) return 'border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:shadow-[0_0_30px_rgba(234,179,8,0.25)]';
										if (rank === 2) return 'border-gray-400/30 shadow-[0_0_15px_rgba(156,163,175,0.15)] hover:shadow-[0_0_25px_rgba(156,163,175,0.25)]';
										if (rank === 3) return 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)]';
										return 'border-primary/20 hover:border-primary/40';
									};

									return (
										<div key={index} className={`flex items-start p-4 bg-card border-2 rounded-lg gap-3 transition-all duration-300 ${getTop3Style()}`}>
											{/* Rank with crown */}
											<div className='flex flex-col items-center gap-1 pt-1'>
												{isFirstPlace && <Crown className='w-5 h-5 text-yellow-400 animate-pulse' fill='currentColor' />}
												<span className={`text-lg font-bold w-8 h-8 rounded-full flex items-center justify-center ${getRankBadgeStyle()}`}>{rank}</span>
											</div>

											{/* Main Content */}
											<div className='flex-1 min-w-0'>
												{/* Avatar + Name */}
												<div className='flex items-center gap-3 mb-3'>
													<Avatar className='w-10 h-10 flex-shrink-0'>
														<AvatarImage src={entry.image || undefined} alt={entry.player} />
														<AvatarFallback className='bg-primary/20 text-primary font-semibold'>{entry.player.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
													</Avatar>
													<span className='text-primary font-semibold truncate'>{entry.player}</span>
												</div>

												{/* Season Stats */}
												<div className='flex gap-6'>
													<div>
														<p className='text-xs text-primary/60 uppercase tracking-wide mb-1'>Total Points</p>
														<p className='text-2xl font-bold text-primary'>{entry.totalPoints}</p>
													</div>
													<div>
														<p className='text-xs text-primary/60 uppercase tracking-wide mb-1'>Win %</p>
														<p className='text-2xl font-bold text-accent'>{Math.round(entry.winPercentage)}%</p>
													</div>
													<div>
														<p className='text-xs text-primary/60 uppercase tracking-wide mb-1'>Record</p>
														<p className='text-lg font-bold text-muted-foreground'>{entry.correctPicks}-{entry.totalPicks - entry.correctPicks}</p>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</TabsContent>
					</Tabs>
				)}
			</CardContent>
			{showUserPicks && selectedUserId && leagueId && (
				<UserPicksModal
					userId={selectedUserId}
					playerName={weeklyLeaderboard.find(e => e.userId === selectedUserId)?.player || 'Unknown'}
					week={currentWeek}
					leagueId={leagueId}
					onClose={() => {
						setShowUserPicks(false);
						setSelectedUserId(null);
					}}
				/>
			)}
		</Card>
	);
}
