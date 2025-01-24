import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStats } from '@/contexts/StatsContext';

interface WeeklyStats {
	weeklyPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

interface SeasonStatsProps {
	totalPoints: number;
	weeklyStats: Record<string, WeeklyStats>;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
}

export function SeasonStats() {
	const { totalPoints, weeklyStats, correctPicks, totalPicks, totalTFSPoints, isLoading } = useStats();
	const winPercentage = totalPicks > 0 ? ((correctPicks / totalPicks) * 100).toFixed(1) : '0.0';

	if (isLoading) return <div>Loading stats...</div>;

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
						<p className='text-2xl font-bold'>{totalTFSPoints}</p>
					</div>
				</div>

				<div>
					<h3 className='text-lg font-medium mb-3'>Weekly Performance</h3>
					<div className='grid grid-cols-4 gap-2'>
						{weeklyStats &&
							Object.entries(weeklyStats)
								.sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
								.map(([week, stats]) => (
									<div key={week} className='bg-gray-50 p-2 rounded text-center'>
										<p className='text-xs text-gray-500'>Week {week}</p>
										<p className='font-bold'>{stats.weeklyPoints}</p>
									</div>
								))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
