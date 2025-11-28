'use client';

import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { useEffect, useState } from 'react';
import { NFLService } from '@/services/nflService';

export function SeasonStats() {
	const { setCurrentWeek } = useWeek();
	const { leagueId } = useLeague();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<{
		totalPoints: number;
		weeklyStats: Record<string, { weeklyPoints: number }>;
		correctPicks: number;
		totalPicks: number;
		totalTFSPoints: number;
		weeksWon: number;
	}>({
		totalPoints: 0,
		weeklyStats: {},
		correctPicks: 0,
		totalPicks: 0,
		totalTFSPoints: 0,
		weeksWon: 0
	});
	const [key, setKey] = useState(0); // Force rerender
	const [isUpdating, setIsUpdating] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const winPercentage = stats.totalPicks > 0 ? ((stats.correctPicks / stats.totalPicks) * 100).toFixed(0) : '0';

	useEffect(() => {
		const fetchStats = async (isPolling = false) => {
			try {
				if (!leagueId) {
					setError('League ID is missing');
					return;
				}
				if (isPolling) {
					setIsUpdating(true);
				} else {
					setLoading(true);
				}
				const response = await fetch(`/api/seasonStats?leagueId=${leagueId}`, { cache: 'no-store' });
				if (!response.ok) {
					throw new Error('Failed to fetch stats');
				}
				const data = await response.json();
				setStats(data);
				setLastUpdated(new Date());
				console.log('[SeasonStats Debug] Updated stats:', data);
			} catch (err) {
				setError('Failed to load stats.');
				console.error(err);
			} finally {
				setLoading(false);
				setIsUpdating(false);
			}
		};

		fetchStats(false); // Initial load

		// Refresh stats on custom event
		const handleRefresh = () => {
			console.log('[SeasonStats Debug] Event triggered refresh');
			fetchStats(true);
			setKey(prev => prev + 1); // Force rerender
		};
		window.addEventListener('refreshSeasonStats', handleRefresh);

		// Use smart polling interval (2 min during games, 5 min outside)
		const pollingInterval = NFLService.getPollingInterval();
		console.log(`[SeasonStats] Using ${pollingInterval / 1000 / 60} minute polling interval`);

		const pollInterval = setInterval(() => {
			console.log('[SeasonStats Debug] 🔄 Auto-refreshing stats...');
			fetchStats(true);
		}, pollingInterval);

		return () => {
			window.removeEventListener('refreshSeasonStats', handleRefresh);
			clearInterval(pollInterval);
		};
	}, [leagueId]);

	const handleWeekClick = (week: string) => {
		const weekNumber = parseInt(week, 10);
		setCurrentWeek(weekNumber);
	};

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

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Season Statistics</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-2 gap-4 mb-6'>
						{[...Array(4)].map((_, i) => (
							<Skeleton key={i} className='h-24 rounded-lg' shimmer />
						))}
					</div>
					<Skeleton className='h-48 rounded-lg' shimmer />
				</CardContent>
			</Card>
		);
	}

	if (error) return <div className='text-destructive'>{error}</div>;

	return (
		<Card key={key}>
			<CardHeader>
				<div className='flex items-center justify-between'>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Season Statistics</CardTitle>
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
				<div className='grid grid-cols-2 gap-4 mb-6'>
					<motion.div
						className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.3, delay: 0 }}
						whileHover={{ scale: 1.02 }}
					>
						<p className='text-primary/80 text-sm font-medium'>Total Points</p>
						<p className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.totalPoints} duration={1} preserveValue />
						</p>
					</motion.div>
					<motion.div
						className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.3, delay: 0.05 }}
						whileHover={{ scale: 1.02 }}
					>
						<p className='text-primary/80 text-sm font-medium'>Win Percentage</p>
						<p className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={parseFloat(winPercentage)} duration={1} preserveValue />%
						</p>
					</motion.div>
					<motion.div
						className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.3, delay: 0.1 }}
						whileHover={{ scale: 1.02 }}
					>
						<p className='text-primary/80 text-sm font-medium'>Weeks Won</p>
						<p className='text-2xl font-bold font-mono text-yellow-400'>
							<CountUp end={stats.weeksWon} duration={1} preserveValue />
						</p>
					</motion.div>
					<motion.div
						className='bg-card/80 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-primary/20 hover:border-primary/30 transition-all'
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-50px" }}
						transition={{ duration: 0.3, delay: 0.15 }}
						whileHover={{ scale: 1.02 }}
					>
						<p className='text-primary/80 text-sm font-medium'>Correct Picks</p>
						<p className='text-2xl font-bold font-mono text-primary'>
							<CountUp end={stats.correctPicks} duration={1} preserveValue />/<CountUp end={stats.totalPicks} duration={1} preserveValue />
						</p>
					</motion.div>
				</div>

				<div>
					<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-3'>Weekly Performance</h3>
					<div className='grid grid-cols-4 gap-2'>
						{stats.weeklyStats &&
							Object.entries(stats.weeklyStats)
								.sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
								.map(([week, weeklyStat], index) => (
									<motion.div
										key={week}
										className='bg-card/80 backdrop-blur-sm border-2 border-primary/20 p-2 rounded text-center cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-all'
										onClick={() => handleWeekClick(week)}
										initial={{ opacity: 0, scale: 0.9 }}
										whileInView={{ opacity: 1, scale: 1 }}
										viewport={{ once: true, margin: "-50px" }}
										transition={{ duration: 0.2, delay: index * 0.03 }}
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
									>
										<p className='text-primary/80 text-xs font-medium'>Week {week}</p>
										<p className='font-bold font-mono text-primary'>
											<CountUp end={weeklyStat.weeklyPoints} duration={0.8} preserveValue />
										</p>
									</motion.div>
								))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
