'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';

export function Leaderboard() {
	const { currentWeek } = useWeek();
	const { leagueId } = useLeague();
	const [weeklyResults, setWeeklyResults] = useState<Record<string, { player: string; points: number; correct: number; tfsPoints: number }>>({});
	const [seasonStats, setSeasonStats] = useState<
		Record<
			string,
			{
				player: string;
				totalPoints: number;
				correctPicks: number;
				totalPicks: number;
				totalTFSPoints: number;
				winPercentage: number;
			}
		>
	>({});
	const [loading, setLoading] = useState(true);
	const [waitingForResults, setWaitingForResults] = useState(false);
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

			// Check if all results are pending
			const allPending = data.weeklyResults.every((result: { points: number }) => result.points === 0);
			setWaitingForResults(allPending);
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

		// Poll for updates every 30 seconds for live standings
		const pollInterval = setInterval(() => {
			console.log('[Leaderboard Debug] 🔄 Auto-refreshing standings...');
			fetchLeaderboard(true);
		}, 30 * 1000); // 30 seconds

		return () => {
			window.removeEventListener('refreshLeaderboard', handleRefresh);
			clearInterval(pollInterval);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentWeek, leagueId]);

	// Generate leaderboard data
	const weeklyLeaderboard = Object.entries(weeklyResults)
		.map(([, stats]) => ({
			...stats
		}))
		.sort((a, b) => b.points - a.points);

	const seasonLeaderboard = Object.entries(seasonStats)
		.map(([key, stats]) => ({
			player: stats.player || `User ${key.slice(-4)}`,
			totalPoints: stats.totalPoints,
			correctPicks: stats.correctPicks,
			totalPicks: stats.totalPicks,
			totalTFSPoints: stats.totalTFSPoints,
			winPercentage: stats.winPercentage ? stats.winPercentage.toFixed(0) : '0'
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
							{waitingForResults ? (
								<div className='text-primary/80 text-center'>Results for this week are not yet available.</div>
							) : (
								<div className='space-y-2'>
									{weeklyLeaderboard.map((entry, index) => (
										<div key={index} className='flex justify-between items-center p-2 bg-card border-2 border-primary/20 rounded-lg'>
											<div className='flex items-center space-x-4'>
												<span className='text-lg font-bold w-8 text-primary/80'>{index + 1}.</span>
												<span className='text-primary'>{entry.player}</span>
											</div>
											<div className='flex space-x-4'>
												<div className='text-right'>
													<p className='text-sm text-primary/80'>Points</p>
													<p className='font-bold text-primary'>{entry.points}</p>
												</div>
												<div className='text-right'>
													<p className='text-sm text-primary/80'>TFS</p>
													<p className='font-bold text-primary'>{entry.tfsPoints}</p>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</TabsContent>

						<TabsContent value='season'>
							<div className='space-y-2'>
								{seasonLeaderboard.map((entry, index) => (
									<div key={index} className='flex justify-between items-center p-2 bg-card border-2 border-primary/20 rounded-lg'>
										<div className='flex items-center space-x-4'>
											<span className='text-lg font-bold w-8 text-primary/80'>{index + 1}.</span>
											<span className='text-primary'>{entry.player}</span>
										</div>
										<div className='flex space-x-4'>
											<div className='text-right'>
												<p className='text-sm text-primary/80'>Total</p>
												<p className='font-bold text-primary'>{entry.totalPoints}</p>
											</div>
											<div className='text-right'>
												<p className='text-sm text-primary/80'>Win %</p>
												<p className='font-bold text-primary'>{entry.winPercentage}%</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</TabsContent>
					</Tabs>
				)}
			</CardContent>
		</Card>
	);
}
