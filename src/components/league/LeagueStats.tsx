'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Target, Award, BarChart3, LineChart, User, Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CountUp from 'react-countup';
import Image from 'next/image';
import { useWeek } from '@/contexts/WeekContext';

interface LeagueStatsProps {
	leagueId: string;
	userId?: string;
	leagueName: string;
}

interface WeeklyTrend {
	week: number;
	points: number;
}

interface PlayerWeeklyData {
	player: string;
	image: string | null;
	weeks: { week: number; points: number }[];
	color: string;
}

export default function LeagueStats({ leagueId, userId, leagueName }: LeagueStatsProps) {
	const { data: session } = useSession();
	const { currentWeek } = useWeek();
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState({
		rank: 0,
		totalPoints: 0,
		winRate: 0,
		correctPicks: 0,
		totalPicks: 0,
		tfsPoints: 0
	});
	const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
	const [leaderboard, setLeaderboard] = useState<any[]>([]);
	const [allPlayersData, setAllPlayersData] = useState<PlayerWeeklyData[]>([]);
	const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
	const [viewMode, setViewMode] = useState<'me' | 'everyone'>('me');
	const [hiddenPlayers, setHiddenPlayers] = useState<Set<string>>(new Set());
	const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

	// Toggle player visibility
	const togglePlayer = (playerName: string) => {
		setHiddenPlayers(prev => {
			const newSet = new Set(prev);
			if (newSet.has(playerName)) {
				newSet.delete(playerName);
			} else {
				newSet.add(playerName);
			}
			return newSet;
		});
	};

	// Color palette for different players
	const playerColors = [
		'#10b981', // green
		'#3b82f6', // blue
		'#f59e0b', // amber
		'#ef4444', // red
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#14b8a6', // teal
		'#f97316', // orange
	];

	useEffect(() => {
		const fetchStats = async () => {
			try {
				setLoading(true);

				// Fetch leaderboard data for current week to get season stats
				const response = await fetch(`/api/leaderboard?leagueId=${leagueId}&week=${currentWeek}`);
				if (!response.ok) {
					setLoading(false);
					return;
				}

				const data = await response.json();

				// Find current user's data by name (not ID)
				const userName = session?.user?.name;
				const userSeasonStats = data.seasonStats?.find(
					(entry: any) => entry.player === userName
				);

				if (userSeasonStats) {
					// Calculate rank
					const sortedStats = [...data.seasonStats].sort(
						(a: any, b: any) => (b.totalPoints || 0) - (a.totalPoints || 0)
					);
					const userIndex = sortedStats.findIndex(
						(entry: any) => entry.player === userName
					);
					const rank = userIndex !== -1 ? userIndex + 1 : 0;

					const winRate = userSeasonStats.totalPicks > 0
						? Math.round((userSeasonStats.correctPicks / userSeasonStats.totalPicks) * 100)
						: 0;

					setStats({
						rank,
						totalPoints: userSeasonStats.totalPoints || 0,
						winRate,
						correctPicks: userSeasonStats.correctPicks || 0,
						totalPicks: userSeasonStats.totalPicks || 0,
						tfsPoints: userSeasonStats.totalTFSPoints || 0
					});

					// Set top 4 leaderboard
					setLeaderboard(sortedStats.slice(0, 4));
				}

				// Fetch weekly trend data for current user (last 5 weeks)
				const picksResponse = await fetch(`/api/picks/user?leagueId=${leagueId}`);
				if (picksResponse.ok) {
					const picks = await picksResponse.json();

					// Group picks by week and calculate points
					const weeklyData = picks
						.sort((a: any, b: any) => a.week - b.week)
						.slice(-5)
						.map((pick: any) => ({
							week: pick.week,
							points: pick.weeklyPoints || 0
						}));

					setWeeklyTrend(weeklyData);
				}

				// Fetch all players' weekly data for "Everyone" view
				// We'll fetch the last 5 weeks of leaderboard data
				if (data.seasonStats && Array.isArray(data.seasonStats) && currentWeek) {
					const weeks = [];
					for (let i = Math.max(1, currentWeek - 4); i <= currentWeek; i++) {
						weeks.push(i);
					}

					// Fetch leaderboard for each week
					const weeklyDataByPlayer = new Map<string, PlayerWeeklyData>();

					await Promise.all(weeks.map(async (week) => {
						try {
							const weekResponse = await fetch(`/api/leaderboard?leagueId=${leagueId}&week=${week}`);
							if (!weekResponse.ok) return;

							const weekData = await weekResponse.json();

							weekData.weeklyResults?.forEach((result: any, index: number) => {
								if (!weeklyDataByPlayer.has(result.player)) {
									weeklyDataByPlayer.set(result.player, {
										player: result.player,
										image: result.image || null,
										weeks: [],
										color: playerColors[Array.from(weeklyDataByPlayer.keys()).length % playerColors.length]
									});
								}

								const playerData = weeklyDataByPlayer.get(result.player)!;
								playerData.weeks.push({
									week,
									points: result.points || 0
								});
							});
						} catch (error) {
							console.error(`Error fetching week ${week}:`, error);
						}
					}));

					// Convert to array and sort weeks
					const playersArray = Array.from(weeklyDataByPlayer.values())
						.map(player => ({
							...player,
							weeks: player.weeks.sort((a, b) => a.week - b.week)
						}))
						.filter(p => p.weeks.length > 0)
						.slice(0, 8); // Limit to 8 players

					setAllPlayersData(playersArray);
				}

				setLoading(false);
			} catch (error) {
				console.error('Error fetching league stats:', error);
				setLoading(false);
			}
		};

		if (leagueId && session?.user?.name && currentWeek) {
			fetchStats();
		}
	}, [leagueId, session, currentWeek]);

	if (loading) {
		return (
			<div className='space-y-6'>
				<Card className='glass border-white/10'>
					<CardContent className='p-6'>
						<Spinner />
					</CardContent>
				</Card>
			</div>
		);
	}

	// Calculate max points for chart scaling
	const maxPoints = viewMode === 'me'
		? Math.max(...weeklyTrend.map(w => w.points), 15)
		: Math.max(...allPlayersData.flatMap(p => p.weeks.map(w => w.points)), 15);

	// Get all unique weeks from data
	const allWeeks = viewMode === 'me'
		? weeklyTrend.map(w => w.week)
		: Array.from(new Set(allPlayersData.flatMap(p => p.weeks.map(w => w.week)))).sort((a, b) => a - b);

	return (
		<div className='space-y-6'>
			{/* My Rank */}
			<Card className='glass border-white/10'>
				<CardContent className='p-6'>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wide'>My Rank</h3>
						<Trophy className='h-5 w-5 text-primary' />
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-5xl font-bold font-mono text-primary'>
							{stats.rank > 0 ? (
								<>
									{stats.rank === 1 && '🥇'}
									{stats.rank === 2 && '🥈'}
									{stats.rank === 3 && '🥉'}
									{stats.rank > 3 && <CountUp end={stats.rank} duration={0.5} />}
								</>
							) : '—'}
						</span>
						{stats.rank > 3 && (
							<span className='text-xs text-muted-foreground'>
								{stats.rank === 4 ? 'th' : stats.rank % 10 === 1 && stats.rank !== 11 ? 'st' : stats.rank % 10 === 2 && stats.rank !== 12 ? 'nd' : stats.rank % 10 === 3 && stats.rank !== 13 ? 'rd' : 'th'}
							</span>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Season Statistics */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='text-lg font-display flex items-center gap-2'>
						<Target className='h-5 w-5 text-primary' />
						Season Statistics
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					{/* Total Points */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Total Points</span>
						<span className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.totalPoints} duration={0.5} />
						</span>
					</div>

					{/* Win % */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Win %</span>
						<span className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.winRate} duration={0.5} />%
						</span>
					</div>

					{/* Correct Picks */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-muted-foreground'>Correct Picks</span>
						<span className='text-xl font-bold font-mono text-foreground'>
							<CountUp end={stats.correctPicks} duration={0.5} />/{stats.totalPicks}
						</span>
					</div>

					{/* TFS Points (if applicable) */}
					{stats.tfsPoints > 0 && (
						<div className='flex items-center justify-between'>
							<span className='text-sm text-muted-foreground'>TFS Points</span>
							<span className='text-xl font-bold font-mono text-purple-400'>
								<CountUp end={stats.tfsPoints} duration={0.5} />
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Weekly Trend */}
			<Card className='glass border-white/10'>
				<CardHeader className='pb-3'>
					<div className='flex items-center justify-between'>
						<CardTitle className='text-lg font-display flex items-center gap-2'>
							<TrendingUp className='h-5 w-5 text-primary' />
							Weekly Trend
						</CardTitle>
					</div>

					{/* Toggle Controls */}
					<div className='flex items-center gap-2 mt-3 flex-wrap'>
						{/* Chart Type Toggle */}
						<div className='flex items-center gap-1 bg-card/50 rounded-lg p-1'>
							<button
								onClick={() => setChartType('bar')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
									chartType === 'bar'
										? 'bg-primary text-black'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<BarChart3 className='h-3.5 w-3.5' />
								<span className='text-xs font-medium'>Bar</span>
							</button>
							<button
								onClick={() => setChartType('line')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
									chartType === 'line'
										? 'bg-primary text-black'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<LineChart className='h-3.5 w-3.5' />
								<span className='text-xs font-medium'>Line</span>
							</button>
						</div>

						{/* View Mode Toggle */}
						<div className='flex items-center gap-1 bg-card/50 rounded-lg p-1'>
							<button
								onClick={() => setViewMode('me')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
									viewMode === 'me'
										? 'bg-primary text-black'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<User className='h-3.5 w-3.5' />
								<span className='text-xs font-medium'>Me</span>
							</button>
							<button
								onClick={() => setViewMode('everyone')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
									viewMode === 'everyone'
										? 'bg-primary text-black'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Users className='h-3.5 w-3.5' />
								<span className='text-xs font-medium'>All</span>
							</button>
						</div>
					</div>
				</CardHeader>
				<CardContent className='pt-4'>
					{(viewMode === 'me' ? weeklyTrend.length > 0 : allPlayersData.length > 0) ? (
						<div className='space-y-4'>
							{/* Bar Chart View */}
							{chartType === 'bar' && (
								<div className='space-y-3'>
									{viewMode === 'me' ? (
										// Single user bar chart
										<div className='relative px-4 py-3'>
											{/* Y-axis labels */}
											<div className='absolute left-0 top-0 bottom-12 flex flex-col justify-between text-[10px] text-muted-foreground font-mono'>
												<span>{maxPoints}</span>
												<span>{Math.round(maxPoints / 2)}</span>
												<span>0</span>
											</div>

											{/* Chart area */}
											<div className='ml-6' style={{ height: '220px' }}>
												<div className='relative h-full pb-8'>
													{/* Baseline */}
													<div className='absolute bottom-8 left-0 right-0 h-px bg-border'></div>

													{/* Bars */}
													<div className='h-full flex items-end justify-around gap-4 pb-8'>
														{weeklyTrend.map((data) => {
															const heightPx = maxPoints > 0 ? (data.points / maxPoints) * 170 : 0;
															return (
																<div key={data.week} className='flex-1 flex flex-col items-center gap-3' style={{ maxWidth: '70px' }}>
																	<div className='relative w-full group flex flex-col items-center'>
																		{/* Point Label Above Bar */}
																		{data.points > 0 && (
																			<div className='mb-2 text-sm font-bold font-mono text-primary'>
																				{data.points}
																			</div>
																		)}

																		{/* Bar */}
																		<div
																			className='w-full bg-gradient-to-t from-primary via-primary/90 to-primary/60 rounded-t-lg transition-all duration-300 hover:from-primary hover:via-primary hover:to-primary/70 shadow-lg shadow-primary/20 relative'
																			style={{
																				height: `${Math.max(heightPx, data.points > 0 ? 12 : 4)}px`
																			}}
																		>
																			{/* Hover Tooltip */}
																			<div className='absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10'>
																				<div className='bg-card border border-primary/30 rounded-lg px-3 py-2 text-xs font-mono font-bold whitespace-nowrap shadow-xl'>
																					<div className='text-primary'>{data.points} pts</div>
																					<div className='text-muted-foreground text-[10px]'>Week {data.week}</div>
																				</div>
																			</div>
																		</div>
																	</div>
																	<span className='text-xs text-muted-foreground font-semibold'>W{data.week}</span>
																</div>
															);
														})}
													</div>
												</div>
											</div>
										</div>
									) : (
										// Multi-user grouped bar chart
										<div className='overflow-x-auto px-4 py-3'>
											{/* Y-axis labels */}
											<div className='flex mb-2'>
												<div className='w-8 flex-shrink-0'></div>
												<div className='flex-1'></div>
											</div>

											<div className='flex'>
												{/* Y-axis */}
												<div className='w-8 flex-shrink-0 flex flex-col justify-between text-[10px] text-muted-foreground font-mono' style={{ height: '240px', paddingBottom: '36px' }}>
													<span>{maxPoints}</span>
													<span>{Math.round(maxPoints / 2)}</span>
													<span>0</span>
												</div>

												{/* Chart area */}
												<div className='flex-1 overflow-x-auto'>
													<div className='inline-flex items-end gap-8 min-w-full' style={{ height: '240px', paddingBottom: '36px' }}>
														{allWeeks.map((week) => (
															<div key={week} className='flex flex-col items-center gap-3 min-w-[120px]'>
																{/* Bar group */}
																<div className='relative' style={{ height: '204px' }}>
																	{/* Baseline */}
																	<div className='absolute bottom-0 left-0 right-0 h-px bg-border'></div>

																	{/* Bars */}
																	<div className='h-full flex items-end gap-1.5 justify-center px-2'>
																		{allPlayersData.map((player) => {
																			const weekData = player.weeks.find(w => w.week === week);
																			const points = weekData?.points || 0;
																			const heightPx = maxPoints > 0 ? (points / maxPoints) * 190 : 0;
																			const isCurrentUser = player.player === session?.user?.name;

																			return (
																				<div key={player.player} className='group relative' style={{ width: '14px' }}>
																					<div
																						className='w-full rounded-t-md transition-all duration-300 hover:opacity-90'
																						style={{
																							backgroundColor: player.color,
																							height: `${Math.max(heightPx, points > 0 ? 8 : 2)}px`,
																							opacity: isCurrentUser ? 1 : 0.8,
																							boxShadow: isCurrentUser ? `0 0 10px ${player.color}80` : 'none',
																							filter: isCurrentUser ? 'brightness(1.15)' : 'none'
																						}}
																					>
																						{/* Hover Tooltip */}
																						<div className='absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 whitespace-nowrap'>
																							<div className='bg-card border border-white/20 rounded-lg px-2 py-1.5 text-xs shadow-xl'>
																								<div className='font-semibold text-[10px]' style={{ color: player.color }}>
																									{player.player.length > 12 ? player.player.substring(0, 12) + '...' : player.player}
																								</div>
																								<div className='text-primary font-bold font-mono text-xs'>{points} pts</div>
																							</div>
																						</div>
																					</div>
																				</div>
																			);
																		})}
																	</div>
																</div>
																<span className='text-xs text-muted-foreground font-semibold'>W{week}</span>
															</div>
														))}
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							)}

							{/* Line Chart View */}
							{chartType === 'line' && (
								<div className='space-y-4'>
									{viewMode === 'me' ? (
										// Single user line chart
										<div className='px-4 py-3'>
											<div className='relative' style={{ height: '200px' }}>
												{/* Y-axis labels */}
												<div className='absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-[10px] text-muted-foreground font-mono'>
													<span>{maxPoints}</span>
													<span>{Math.round(maxPoints / 2)}</span>
													<span>0</span>
												</div>

												{/* SVG Chart */}
												<div className='ml-8 h-full'>
													<svg className='w-full h-full' viewBox='0 0 400 200' preserveAspectRatio='xMidYMid meet'>
														{/* Grid lines */}
														<line x1='0' y1='20' x2='400' y2='20' stroke='currentColor' strokeWidth='0.8' className='text-muted-foreground/30' strokeDasharray='4 4' />
														<line x1='0' y1='110' x2='400' y2='110' stroke='currentColor' strokeWidth='0.8' className='text-muted-foreground/30' strokeDasharray='4 4' />
														<line x1='0' y1='180' x2='400' y2='180' stroke='currentColor' strokeWidth='1' className='text-border' />

														{/* Gradient fill */}
														<defs>
															<linearGradient id='lineGradient' x1='0' x2='0' y1='0' y2='1'>
																<stop offset='0%' stopColor='currentColor' stopOpacity='0.25' className='text-primary' />
																<stop offset='100%' stopColor='currentColor' stopOpacity='0' className='text-primary' />
															</linearGradient>
														</defs>

														{/* Area fill */}
														{weeklyTrend.length > 0 && (
															<path
																d={`M ${weeklyTrend.map((d, i) => {
																	const x = weeklyTrend.length === 1 ? 200 : (i / (weeklyTrend.length - 1)) * 380 + 10;
																	const y = 180 - (maxPoints > 0 ? (d.points / maxPoints) * 150 : 0);
																	return `${x},${y}`;
																}).join(' L ')} L ${weeklyTrend.length === 1 ? 200 : 390},180 L 10,180 Z`}
																fill='url(#lineGradient)'
															/>
														)}

														{/* Line */}
														{weeklyTrend.length > 0 && (
															<path
																d={`M ${weeklyTrend.map((d, i) => {
																	const x = weeklyTrend.length === 1 ? 200 : (i / (weeklyTrend.length - 1)) * 380 + 10;
																	const y = 180 - (maxPoints > 0 ? (d.points / maxPoints) * 150 : 0);
																	return `${x},${y}`;
																}).join(' L ')}`}
																fill='none'
																stroke='currentColor'
																strokeWidth='3.5'
																strokeLinecap='round'
																strokeLinejoin='round'
																className='text-primary'
															/>
														)}

														{/* Data points */}
														{weeklyTrend.map((d, i) => {
															const x = weeklyTrend.length === 1 ? 200 : (i / (weeklyTrend.length - 1)) * 380 + 10;
															const y = 180 - (maxPoints > 0 ? (d.points / maxPoints) * 150 : 0);
															return (
																<g key={d.week}>
																	<circle
																		cx={x}
																		cy={y}
																		r='6'
																		fill='currentColor'
																		stroke='rgb(var(--card))'
																		strokeWidth='2.5'
																		className='text-primary'
																	/>
																	<text
																		x={x}
																		y={y - 14}
																		textAnchor='middle'
																		className='text-xs font-bold fill-primary'
																		style={{ fontSize: '12px' }}
																	>
																		{d.points}
																	</text>
																</g>
															);
														})}
													</svg>
												</div>

												{/* Week labels */}
												<div className='ml-8 flex justify-around px-2 mt-2'>
													{weeklyTrend.map((d) => (
														<span key={d.week} className='text-xs text-muted-foreground font-semibold'>
															W{d.week}
														</span>
													))}
												</div>
											</div>
										</div>
									) : (
										// Multi-user line chart
										<div className='px-4 py-3 space-y-4'>
											<div className='relative' style={{ height: '240px' }}>
												{/* Y-axis labels */}
												<div className='absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-[10px] text-muted-foreground font-mono'>
													<span>{maxPoints}</span>
													<span>{Math.round(maxPoints / 2)}</span>
													<span>0</span>
												</div>

												{/* SVG Chart */}
												<div className='ml-8 h-full'>
													<svg className='w-full h-full' viewBox='0 0 400 220' preserveAspectRatio='xMidYMid meet'>
														{/* Grid lines */}
														<line x1='0' y1='20' x2='400' y2='20' stroke='currentColor' strokeWidth='0.8' className='text-muted-foreground/30' strokeDasharray='4 4' />
														<line x1='0' y1='120' x2='400' y2='120' stroke='currentColor' strokeWidth='0.8' className='text-muted-foreground/30' strokeDasharray='4 4' />
														<line x1='0' y1='200' x2='400' y2='200' stroke='currentColor' strokeWidth='1' className='text-border' />

														{/* Lines for each player */}
														{allPlayersData.map((player) => {
															const playerWeeks = allWeeks.map(week => {
																const weekData = player.weeks.find(w => w.week === week);
																return { week, points: weekData?.points || 0 };
															});

															const isCurrentUser = player.player === session?.user?.name;
															const isHidden = hiddenPlayers.has(player.player);
															const isHovered = hoveredPlayer === player.player;

															// Don't render if hidden
															if (isHidden) return null;

															// Adjust appearance based on hover state
															let strokeWidth = isCurrentUser ? 3.5 : 2.5;
															let opacity = isCurrentUser ? 1 : 0.75;
															let circleRadius = isCurrentUser ? 6 : 5;

															// If a player is hovered, dim others
															if (hoveredPlayer && !isHovered) {
																opacity = 0.2;
																strokeWidth = isCurrentUser ? 2.5 : 1.5;
															} else if (isHovered) {
																opacity = 1;
																strokeWidth = isCurrentUser ? 4.5 : 3.5;
																circleRadius = isCurrentUser ? 7 : 6;
															}

															return (
																<g key={player.player}>
																	{/* Line path */}
																	{playerWeeks.length > 0 && (
																		<path
																			d={`M ${playerWeeks.map((d, i) => {
																				const x = allWeeks.length === 1 ? 200 : (i / (allWeeks.length - 1)) * 380 + 10;
																				const y = 200 - (maxPoints > 0 ? (d.points / maxPoints) * 170 : 0);
																				return `${x},${y}`;
																			}).join(' L ')}`}
																			fill='none'
																			stroke={player.color}
																			strokeWidth={strokeWidth}
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			opacity={opacity}
																			style={{ transition: 'all 0.2s ease' }}
																		/>
																	)}

																	{/* Data points */}
																	{playerWeeks.map((d, i) => {
																		const x = allWeeks.length === 1 ? 200 : (i / (allWeeks.length - 1)) * 380 + 10;
																		const y = 200 - (maxPoints > 0 ? (d.points / maxPoints) * 170 : 0);
																		return (
																			<circle
																				key={`${player.player}-${d.week}`}
																				cx={x}
																				cy={y}
																				r={circleRadius}
																				fill={player.color}
																				stroke='rgb(var(--card))'
																				strokeWidth='2.5'
																				opacity={opacity}
																				style={{ transition: 'all 0.2s ease' }}
																			/>
																		);
																	})}
																</g>
															);
														})}
													</svg>
												</div>

												{/* Week labels */}
												<div className='ml-8 flex justify-around px-2 mt-2'>
													{allWeeks.map((week) => (
														<span key={week} className='text-xs text-muted-foreground font-semibold'>
															W{week}
														</span>
													))}
												</div>
											</div>

											{/* Legend */}
											<div className='grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-white/10'>
												{allPlayersData.map((player) => {
													const isCurrentUser = player.player === session?.user?.name;
													const isHidden = hiddenPlayers.has(player.player);
													const isHovered = hoveredPlayer === player.player;
													return (
														<button
															key={player.player}
															className='flex items-center gap-2 min-w-0 text-left transition-all duration-200 hover:bg-card/30 rounded px-2 py-1.5 -mx-2 cursor-pointer'
															onClick={() => togglePlayer(player.player)}
															onMouseEnter={() => setHoveredPlayer(player.player)}
															onMouseLeave={() => setHoveredPlayer(null)}
														>
															<div
																className='w-3 h-3 rounded-full flex-shrink-0 transition-all duration-200'
																style={{
																	backgroundColor: player.color,
																	boxShadow: isCurrentUser ? `0 0 8px ${player.color}` : 'none',
																	opacity: isHidden ? 0.3 : 1,
																	transform: isHovered ? 'scale(1.2)' : 'scale(1)'
																}}
															/>
															<span className={`text-xs truncate transition-all duration-200 ${
																isHidden
																	? 'line-through opacity-50'
																	: isCurrentUser
																		? 'font-semibold text-foreground'
																		: 'text-muted-foreground'
															} ${isHovered ? 'font-semibold' : ''}`}>
																{player.player}{isCurrentUser && ' (You)'}
															</span>
														</button>
													);
												})}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					) : (
						<p className='text-sm text-muted-foreground text-center py-8'>
							No data yet
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
