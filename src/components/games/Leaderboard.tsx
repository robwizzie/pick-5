// src/components/games/Leaderboard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeaderboardProps {
	weeklyResults: Record<
		string,
		{
			points: number;
			correct: number;
			tfsPoints: number;
		}
	>;
	seasonStats: Record<
		string,
		{
			totalPoints: number;
			winPercentage: number;
			totalTFSPoints: number;
		}
	>;
	currentWeek: number;
}

export function Leaderboard({ weeklyResults, seasonStats, currentWeek }: LeaderboardProps) {
	const weeklyLeaderboard = Object.entries(weeklyResults)
		.map(([player, stats]) => ({
			player,
			...stats
		}))
		.sort((a, b) => b.points - a.points);

	const seasonLeaderboard = Object.entries(seasonStats)
		.map(([player, stats]) => ({
			player,
			...stats
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Leaderboard</CardTitle>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue='weekly'>
					<TabsList className='mb-4'>
						<TabsTrigger value='weekly'>Week {currentWeek}</TabsTrigger>
						<TabsTrigger value='season'>Season</TabsTrigger>
					</TabsList>

					<TabsContent value='weekly'>
						<div className='space-y-2'>
							{weeklyLeaderboard.map((entry, index) => (
								<div key={entry.player} className='flex justify-between items-center p-2 bg-gray-50 rounded'>
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
								<div key={entry.player} className='flex justify-between items-center p-2 bg-gray-50 rounded'>
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
			</CardContent>
		</Card>
	);
}
