'use client';

import { SessionProvider } from 'next-auth/react';
import Image from 'next/image';
import { StatsProvider } from '@/contexts/StatsContext';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WeeklyPicks } from '@/components/games/WeeklyPicks';
import { Results } from '@/components/games/Results';
import { SeasonStats } from '@/components/games/SeasonStats';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Nav } from '@/components/games/Nav';

export default function Home() {
	const [currentWeek, setCurrentWeek] = useState(10);

	// Define seasonStats state
	const [seasonStats, setSeasonStats] = useState({
		totalPoints: 0,
		weeklyStats: {}, // Changed from weeklyScores
		correctPicks: 0,
		totalPicks: 0,
		totalTFSPoints: 0 // Changed from tfsPoints
	});

	return (
		<SessionProvider>
			<StatsProvider>
				<div className='min-h-screen bg-gray-50'>
					<Nav currentWeek={currentWeek} onWeekChange={setCurrentWeek} />
					<main className='py-8'>
						<div className='max-w-7xl mx-auto px-4'>
							{/* Header */}
							<Card className='mb-8'>
								<div className='flex flex-col items-center mt-3 mb-3'>
									<Image src='/pick-5-logo.png' alt='Pick 5 Logo' width={128} className='w-32'/>
								</div>
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
									<SeasonStats totalPoints={seasonStats.totalPoints} weeklyStats={seasonStats.weeklyStats} correctPicks={seasonStats.correctPicks} totalPicks={seasonStats.totalPicks} totalTFSPoints={seasonStats.totalTFSPoints} /> <Leaderboard currentWeek={currentWeek} />
								</div>
							</div>
						</div>
					</main>
				</div>
			</StatsProvider>
		</SessionProvider>
	);
}
