import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeaderboardProps {
	currentWeek: number;
}

export function Leaderboard({ currentWeek }: LeaderboardProps) {
	const [weeklyResults, setWeeklyResults] = useState<Record<string, { player: string; points: number; correct: number; tfsPoints: number }>>({});
	const [seasonStats, setSeasonStats] = useState<Record<string, { player: string; totalPoints: number; winPercentage: number; totalTFSPoints: number }>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchLeaderboard = async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch(`/api/leaderboard?week=${currentWeek}`);
			if (!response.ok) {
				throw new Error('Failed to fetch leaderboard data');
			}
			const data = await response.json();
			console.log('Leaderboard API response:', data); // Debugging log
			setWeeklyResults(data.weeklyResults);
			setSeasonStats(data.seasonStats);
		} catch (err) {
			setError('Failed to load leaderboard data.');
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchLeaderboard();
	}, [currentWeek]);

	const weeklyLeaderboard = Object.entries(weeklyResults)
		.map(([key, stats]) => ({
			...stats
		}))
		.sort((a, b) => b.points - a.points);

	const seasonLeaderboard = Object.entries(seasonStats)
		.map(([key, stats]) => ({
			player: stats.player || `User ${key.slice(-4)}`, // Fallback to part of user ID if no player name
			...stats
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Leaderboard</CardTitle>
			</CardHeader>
			<CardContent>
				{loading && <p>Loading...</p>}
				{error && <p className='text-red-500'>{error}</p>}
				{!loading && !error && (
					<Tabs defaultValue='weekly'>
						<TabsList className='mb-4'>
							<TabsTrigger value='weekly'>Week {currentWeek}</TabsTrigger>
							<TabsTrigger value='season'>Season</TabsTrigger>
						</TabsList>

						<TabsContent value='weekly'>
							<div className='space-y-2'>
								{weeklyLeaderboard.map((entry, index) => (
									<div key={index} className='flex justify-between items-center p-2 bg-gray-50 rounded'>
										<div className='flex items-center space-x-4'>
											<span className='text-lg font-bold w-8'>{index + 1}.</span>
											<span>{entry.player}</span>
										</div>
										<div className='flex space-x-4'>
											<div className='text-right'>
												<p className='text-sm text-gray-500'>Points</p>
												<p className='font-bold'>{entry.points}</p>
											</div>
											<div className='text-right'>
												<p className='text-sm text-gray-500'>TFS</p>
												<p className='font-bold'>{entry.tfsPoints}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</TabsContent>

						<TabsContent value='season'>
							<div className='space-y-2'>
								{seasonLeaderboard.map((entry, index) => (
									<div key={index} className='flex justify-between items-center p-2 bg-gray-50 rounded'>
										<div className='flex items-center space-x-4'>
											<span className='text-lg font-bold w-8'>{index + 1}.</span>
											<span>{entry.player}</span>
										</div>
										<div className='flex space-x-4'>
											<div className='text-right'>
												<p className='text-sm text-gray-500'>Total</p>
												<p className='font-bold'>{entry.totalPoints}</p>
											</div>
											<div className='text-right'>
												<p className='text-sm text-gray-500'>Win %</p>
												<p className='font-bold'>{entry.winPercentage.toFixed(1)}%</p>
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
