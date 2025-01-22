// src/components/games/SeasonStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SeasonStats as SeasonStatsType } from '@/services/statsService';

interface SeasonStatsProps {
	totalPoints: number;
	weeklyScores: Record<string, number>;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

export function SeasonStats({ totalPoints, weeklyScores, correctPicks, totalPicks, tfsPoints }: SeasonStatsProps) {
	const winPercentage = totalPicks > 0 ? ((correctPicks / totalPicks) * 100).toFixed(1) : '0.0';

	return (
		<Card>
			<CardHeader>
				<CardTitle>Season Statistics</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='grid grid-cols-2 gap-4 mb-6'>
					<div>
						<p className='text-sm text-gray-500'>Total Points</p>
						<p className='text-2xl font-bold'>{totalPoints}</p>
					</div>
					<div>
						<p className='text-sm text-gray-500'>Win Percentage</p>
						<p className='text-2xl font-bold'>{winPercentage}%</p>
					</div>
					<div>
						<p className='text-sm text-gray-500'>Correct Picks</p>
						<p className='text-2xl font-bold'>
							{correctPicks}/{totalPicks}
						</p>
					</div>
					<div>
						<p className='text-sm text-gray-500'>TFS Points</p>
						<p className='text-2xl font-bold'>{tfsPoints}</p>
					</div>
				</div>

				<div>
					<h3 className='text-lg font-medium mb-3'>Weekly Performance</h3>
					<div className='grid grid-cols-4 gap-2'>
						{Object.entries(weeklyScores)
							.sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
							.map(([week, score]) => (
								<div key={week} className='bg-gray-50 p-2 rounded text-center'>
									<p className='text-xs text-gray-500'>Week {week}</p>
									<p className='font-bold'>{score}</p>
								</div>
							))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
