// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeeklyPicks } from '@/components/games/WeeklyPicks';
import { Results } from '@/components/games/Results';
import { SeasonStats } from '@/components/games/SeasonStats';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Nav } from '@/components/games/Nav';
import { StatsService } from '@/services/statsService';

export default function Home() {
	const [currentWeek, setCurrentWeek] = useState(10);
	const [seasonStats, setSeasonStats] = useState(() => {
		const storedStats = StatsService.getStoredStats();
		return {
			totalPoints: storedStats.totalPoints,
			weeklyScores: Object.fromEntries(Object.entries(storedStats.weeklyStats).map(([week, stats]) => [week, stats.weeklyPoints])),
			correctPicks: storedStats.correctPicks,
			totalPicks: storedStats.totalPicks,
			tfsPoints: storedStats.totalTFSPoints
		};
	});

	// Helper function to get weekly results for a specific week
	const getWeeklyResultsForWeek = (storedStats: any, week: number) => {
		const weekStats = storedStats.weeklyStats[week];
		return weekStats
			? {
					'Player 1': {
						points: weekStats.weeklyPoints || 0,
						correct: weekStats.correctPicks || 0,
						tfsPoints: weekStats.tfsPoints || 0
					}
			  }
			: {
					'Player 1': {
						points: 0,
						correct: 0,
						tfsPoints: 0
					}
			  };
	};

	const [weeklyResults, setWeeklyResults] = useState(() => {
		const storedStats = StatsService.getStoredStats();
		return getWeeklyResultsForWeek(storedStats, currentWeek);
	});

	const [seasonLeaderboard, setSeasonLeaderboard] = useState(() => {
		const storedStats = StatsService.getStoredStats();
		return {
			'Player 1': {
				totalPoints: storedStats.totalPoints,
				winPercentage: storedStats.winPercentage,
				totalTFSPoints: storedStats.totalTFSPoints
			}
		};
	});

	// Update weekly results when week changes
	useEffect(() => {
		const storedStats = StatsService.getStoredStats();
		setWeeklyResults(getWeeklyResultsForWeek(storedStats, currentWeek));
	}, [currentWeek]);

	// Optional: Add effect to update stats if they change
	useEffect(() => {
		const handleStorageChange = () => {
			const storedStats = StatsService.getStoredStats();

			setSeasonStats({
				totalPoints: storedStats.totalPoints,
				weeklyScores: Object.fromEntries(Object.entries(storedStats.weeklyStats).map(([week, stats]) => [week, stats.weeklyPoints])),
				correctPicks: storedStats.correctPicks,
				totalPicks: storedStats.totalPicks,
				tfsPoints: storedStats.totalTFSPoints
			});

			setWeeklyResults(getWeeklyResultsForWeek(storedStats, currentWeek));

			setSeasonLeaderboard({
				'Player 1': {
					totalPoints: storedStats.totalPoints,
					winPercentage: storedStats.winPercentage,
					totalTFSPoints: storedStats.totalTFSPoints
				}
			});
		};

		// Listen for storage changes (from other tabs/windows)
		window.addEventListener('storage', handleStorageChange);

		return () => {
			window.removeEventListener('storage', handleStorageChange);
		};
	}, [currentWeek]);

	return (
		<div className='min-h-screen bg-gray-50'>
			<Nav currentWeek={currentWeek} onWeekChange={setCurrentWeek} />

			<main className='py-8'>
				<div className='max-w-7xl mx-auto px-4'>
					{/* Header */}
					<Card className='mb-8'>
						<CardHeader>
							<CardTitle className='text-2xl text-center'>NFL Pick 5</CardTitle>
						</CardHeader>
						<CardContent>
							<p className='text-center text-gray-600'>Select 5 games and predict one total final score each week</p>
						</CardContent>
					</Card>

					{/* Main Content */}
					<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
						{/* Left Column - Weekly Picks & Results */}
						<div className='lg:col-span-2 space-y-8'>
							<Tabs defaultValue='picks'>
								<TabsList className='w-full'>
									<TabsTrigger value='picks' className='flex-1'>
										Make Picks
									</TabsTrigger>
									<TabsTrigger value='results' className='flex-1'>
										View Results
									</TabsTrigger>
								</TabsList>

								<TabsContent value='picks'>
									<WeeklyPicks currentWeek={currentWeek} />
								</TabsContent>

								<TabsContent value='results'>
									<Results currentWeek={currentWeek} />
								</TabsContent>
							</Tabs>
						</div>

						{/* Right Column - Stats & Leaderboard */}
						<div className='space-y-8'>
							<SeasonStats totalPoints={seasonStats.totalPoints} weeklyScores={seasonStats.weeklyScores} correctPicks={seasonStats.correctPicks} totalPicks={seasonStats.totalPicks} tfsPoints={seasonStats.tfsPoints} />
							<Leaderboard weeklyResults={weeklyResults} seasonStats={seasonLeaderboard} currentWeek={currentWeek} />
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
