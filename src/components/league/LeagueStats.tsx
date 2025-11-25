'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Target, Award, BarChart3, LineChart, User, Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CountUp from 'react-countup';
import Image from 'next/image';

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

				// Fetch leaderboard data
				const response = await fetch(`/api/leaderboard?leagueId=${leagueId}`);
				if (!response.ok) return;

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

				// Fetch weekly trend data for current user
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
				if (data.seasonStats && Array.isArray(data.seasonStats)) {
					const playersData: PlayerWeeklyData[] = await Promise.all(
						data.seasonStats.slice(0, 8).map(async (player: any, index: number) => {
							try {
								// Note: We need an API endpoint that can fetch picks for any user
								// For now, we'll use the weekly results from the leaderboard data
								const weeklyResults = data.weeklyResults?.filter(
									(w: any) => w.player === player.player
								) || [];

								const weeks = weeklyResults
									.sort((a: any, b: any) => a.week - b.week)
									.slice(-5)
									.map((w: any) => ({
										week: w.week,
										points: w.weeklyPoints || 0
									}));

								return {
									player: player.player,
									image: player.image || null,
									weeks,
									color: playerColors[index % playerColors.length]
								};
							} catch {
								return {
									player: player.player,
									image: player.image || null,
									weeks: [],
									color: playerColors[index % playerColors.length]
								};
							}
						})
					);

					setAllPlayersData(playersData.filter(p => p.weeks.length > 0));
				}

				setLoading(false);
			} catch (error) {
				console.error('Error fetching league stats:', error);
				setLoading(false);
			}
		};

		if (leagueId && session?.user?.name) {
			fetchStats();
		}
	}, [leagueId, session]);

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
		: Array.from(new Set(allPlayersData.flatMap(p => p.weeks.map(w => w.week)))).sort((a, b) => a - b).slice(-5);

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
									<CountUp end={stats.rank} duration={0.5} />
									{stats.rank === 1 && '🥇'}
									{stats.rank === 2 && '🥈'}
									{stats.rank === 3 && '🥉'}
								</>
							) : '—'}
						</span>
						{stats.rank <= 3 && stats.rank > 0 && (
							<span className='text-xs text-muted-foreground'>
								{stats.rank === 1 ? 'st' : stats.rank === 2 ? 'nd' : 'rd'}
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
					<div className='flex items-center gap-2 mt-3'>
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
				<CardContent>
					{(viewMode === 'me' ? weeklyTrend.length > 0 : allPlayersData.length > 0) ? (
						<div className='space-y-4'>
							{/* Bar Chart View */}
							{chartType === 'bar' && (
								<div className='space-y-3'>
									{viewMode === 'me' ? (
										// Single user bar chart
										<div className='h-48 flex items-end gap-3 px-2'>
											{weeklyTrend.map((data) => {
												const height = maxPoints > 0 ? (data.points / maxPoints) * 100 : 0;
												return (
													<div key={data.week} className='flex-1 flex flex-col items-center gap-2'>
														<div className='relative w-full group'>
															<div
																className='w-full bg-gradient-to-t from-primary via-primary/80 to-primary/50 rounded-t-lg transition-all duration-300 hover:from-primary hover:via-primary/90 hover:to-primary/60 shadow-lg shadow-primary/20'
																style={{
																	height: `${Math.max(height, 3)}%`,
																	minHeight: data.points > 0 ? '12px' : '4px'
																}}
															>
																{/* Point Label on Bar */}
																{data.points > 0 && (
																	<div className='absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold font-mono text-primary'>
																		{data.points}
																	</div>
																)}

																{/* Hover Tooltip */}
																<div className='absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10'>
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
									) : (
										// Multi-user grouped bar chart
										<div className='h-56 flex items-end gap-4 px-2 overflow-x-auto'>
											{allWeeks.map((week) => (
												<div key={week} className='flex flex-col items-center gap-2 min-w-[80px]'>
													<div className='flex items-end gap-1 h-48'>
														{allPlayersData.map((player) => {
															const weekData = player.weeks.find(w => w.week === week);
															const points = weekData?.points || 0;
															const height = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
															const isCurrentUser = player.player === session?.user?.name;

															return (
																<div key={player.player} className='flex-1 min-w-[8px] group relative'>
																	<div
																		className='w-full rounded-t transition-all duration-300 hover:opacity-80'
																		style={{
																			backgroundColor: player.color,
																			height: `${Math.max(height, 2)}%`,
																			minHeight: points > 0 ? '8px' : '2px',
																			opacity: isCurrentUser ? 1 : 0.7,
																			boxShadow: isCurrentUser ? `0 4px 12px ${player.color}40` : 'none'
																		}}
																	>
																		{/* Hover Tooltip */}
																		<div className='absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap'>
																			<div className='bg-card border border-white/20 rounded-lg px-2 py-1.5 text-xs shadow-xl'>
																				<div className='font-semibold' style={{ color: player.color }}>{player.player}</div>
																				<div className='text-primary font-bold font-mono'>{points} pts</div>
																			</div>
																		</div>
																	</div>
																</div>
															);
														})}
													</div>
													<span className='text-xs text-muted-foreground font-semibold'>W{week}</span>
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{/* Line Chart View */}
							{chartType === 'line' && (
								<div className='space-y-3'>
									{viewMode === 'me' ? (
										// Single user line chart
										<div className='h-48 relative'>
											<svg className='w-full h-full' viewBox='0 0 300 150' preserveAspectRatio='none'>
												{/* Grid lines */}
												<line x1='0' y1='0' x2='300' y2='0' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />
												<line x1='0' y1='75' x2='300' y2='75' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />
												<line x1='0' y1='150' x2='300' y2='150' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />

												{/* Line path */}
												{weeklyTrend.length > 1 && (
													<>
														{/* Gradient fill under line */}
														<defs>
															<linearGradient id='lineGradient' x1='0' x2='0' y1='0' y2='1'>
																<stop offset='0%' stopColor='rgb(var(--primary))' stopOpacity='0.3' />
																<stop offset='100%' stopColor='rgb(var(--primary))' stopOpacity='0' />
															</linearGradient>
														</defs>
														<path
															d={`M ${weeklyTrend.map((d, i) => {
																const x = (i / (weeklyTrend.length - 1)) * 300;
																const y = 150 - ((d.points / maxPoints) * 140);
																return `${x},${y}`;
															}).join(' L ')} L 300,150 L 0,150 Z`}
															fill='url(#lineGradient)'
														/>
														<path
															d={`M ${weeklyTrend.map((d, i) => {
																const x = (i / (weeklyTrend.length - 1)) * 300;
																const y = 150 - ((d.points / maxPoints) * 140);
																return `${x},${y}`;
															}).join(' L ')}`}
															fill='none'
															stroke='rgb(var(--primary))'
															strokeWidth='3'
															strokeLinecap='round'
															strokeLinejoin='round'
														/>
													</>
												)}

												{/* Data points */}
												{weeklyTrend.map((d, i) => {
													const x = weeklyTrend.length === 1 ? 150 : (i / (weeklyTrend.length - 1)) * 300;
													const y = 150 - ((d.points / maxPoints) * 140);
													return (
														<g key={d.week}>
															<circle
																cx={x}
																cy={y}
																r='5'
																fill='rgb(var(--primary))'
																stroke='rgb(var(--card))'
																strokeWidth='2'
																className='hover:r-7 transition-all cursor-pointer'
															/>
															<text
																x={x}
																y={y - 12}
																textAnchor='middle'
																className='text-xs font-bold fill-primary'
																style={{ fontSize: '10px' }}
															>
																{d.points}
															</text>
														</g>
													);
												})}
											</svg>

											{/* Week labels */}
											<div className='flex justify-between px-2 mt-2'>
												{weeklyTrend.map((d) => (
													<span key={d.week} className='text-xs text-muted-foreground font-semibold'>
														W{d.week}
													</span>
												))}
											</div>
										</div>
									) : (
										// Multi-user line chart
										<div className='space-y-3'>
											<div className='h-56 relative'>
												<svg className='w-full h-full' viewBox={`0 0 ${Math.max(allWeeks.length * 60, 300)} 180`} preserveAspectRatio='none'>
													{/* Grid lines */}
													<line x1='0' y1='0' x2='100%' y2='0' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />
													<line x1='0' y1='90' x2='100%' y2='90' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />
													<line x1='0' y1='180' x2='100%' y2='180' stroke='currentColor' strokeWidth='0.5' className='text-muted-foreground/20' />

													{/* Lines for each player */}
													{allPlayersData.map((player) => {
														const playerWeeks = allWeeks.map(week => {
															const weekData = player.weeks.find(w => w.week === week);
															return { week, points: weekData?.points || 0 };
														});

														const isCurrentUser = player.player === session?.user?.name;
														const strokeWidth = isCurrentUser ? 3 : 2;
														const opacity = isCurrentUser ? 1 : 0.7;

														return (
															<g key={player.player}>
																{/* Line path */}
																{playerWeeks.length > 1 && (
																	<path
																		d={`M ${playerWeeks.map((d, i) => {
																			const x = (i / (allWeeks.length - 1)) * 100;
																			const y = 180 - ((d.points / maxPoints) * 160);
																			return `${x}%,${y}`;
																		}).join(' L ')}`}
																		fill='none'
																		stroke={player.color}
																		strokeWidth={strokeWidth}
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		opacity={opacity}
																	/>
																)}

																{/* Data points */}
																{playerWeeks.map((d, i) => {
																	const x = playerWeeks.length === 1 ? 50 : (i / (allWeeks.length - 1)) * 100;
																	const y = 180 - ((d.points / maxPoints) * 160);
																	return (
																		<circle
																			key={`${player.player}-${d.week}`}
																			cx={`${x}%`}
																			cy={y}
																			r={isCurrentUser ? '5' : '4'}
																			fill={player.color}
																			stroke='rgb(var(--card))'
																			strokeWidth='2'
																			opacity={opacity}
																		/>
																	);
																})}
															</g>
														);
													})}
												</svg>

												{/* Week labels */}
												<div className='flex justify-between px-2 mt-2'>
													{allWeeks.map((week) => (
														<span key={week} className='text-xs text-muted-foreground font-semibold'>
															W{week}
														</span>
													))}
												</div>
											</div>

											{/* Legend */}
											<div className='flex flex-wrap gap-3 pt-2 border-t border-white/10'>
												{allPlayersData.map((player) => {
													const isCurrentUser = player.player === session?.user?.name;
													return (
														<div key={player.player} className='flex items-center gap-2'>
															<div
																className='w-3 h-3 rounded-full'
																style={{
																	backgroundColor: player.color,
																	boxShadow: isCurrentUser ? `0 0 8px ${player.color}` : 'none'
																}}
															/>
															<span className={`text-xs ${isCurrentUser ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
																{player.player}
																{isCurrentUser && ' (You)'}
															</span>
														</div>
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

			{/* Mini Leaderboard */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle className='text-lg font-display flex items-center gap-2'>
						<Award className='h-5 w-5 text-primary' />
						Mini Leaderboard
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-2'>
					{leaderboard.length > 0 ? (
						leaderboard.map((entry, index) => (
							<div
								key={entry.player}
								className='flex items-center gap-3 p-2 rounded-lg bg-card/50 hover:bg-card/80 transition-colors'
							>
								{/* Rank Badge */}
								<div className='flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs'>
									{index + 1}
								</div>

								{/* Avatar */}
								<div className='relative w-8 h-8 rounded-full overflow-hidden bg-primary/20 flex-shrink-0'>
									{entry.image ? (
										<Image
											src={entry.image}
											alt={entry.player}
											fill
											className='object-cover'
										/>
									) : (
										<div className='w-full h-full flex items-center justify-center text-primary font-semibold text-xs'>
											{entry.player.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
										</div>
									)}
								</div>

								{/* Name */}
								<span className='flex-1 text-sm font-medium text-foreground truncate'>
									{entry.player}
								</span>

								{/* Points */}
								<span className='text-sm font-bold font-mono text-primary'>
									{entry.totalPoints}
								</span>
							</div>
						))
					) : (
						<p className='text-sm text-muted-foreground text-center py-4'>
							No rankings yet
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
