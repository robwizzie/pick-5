'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeek } from '@/contexts/WeekContext';
import { useLeague } from '@/contexts/LeagueContext';
import { useEffect, useState } from 'react';

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
	}>({
		totalPoints: 0,
		weeklyStats: {},
		correctPicks: 0,
		totalPicks: 0,
		totalTFSPoints: 0
	});

	const winPercentage = stats.totalPicks > 0 ? ((stats.correctPicks / stats.totalPicks) * 100).toFixed(0) : '0';

	useEffect(() => {
		const fetchStats = async () => {
			try {
				if (!leagueId) {
					setError('League ID is missing');
					return;
				}
				setLoading(true);
				const response = await fetch(`/api/seasonStats?leagueId=${leagueId}`);
				if (!response.ok) {
					throw new Error('Failed to fetch stats');
				}
				const data = await response.json();
				setStats(data);
			} catch (err) {
				setError('Failed to load stats.');
				console.error(err);
			} finally {
				setLoading(false);
			}
		};

		fetchStats();
	}, [leagueId]);

	const handleWeekClick = (week: string) => {
		const weekNumber = parseInt(week, 10);
		setCurrentWeek(weekNumber);
	};

	if (loading) return <div>Loading stats...</div>;
	if (error) return <div className='text-destructive'>{error}</div>;

	return (
		<Card>
			<CardHeader>
				<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary'>Season Statistics</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='grid grid-cols-2 gap-4 mb-6'>
					<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
						<p className='text-primary/80 text-sm font-medium'>Total Points</p>
						<p className='text-2xl font-bold text-primary'>{stats.totalPoints}</p>
					</div>
					<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
						<p className='text-primary/80 text-sm font-medium'>Win Percentage</p>
						<p className='text-2xl font-bold text-primary'>{winPercentage}%</p>
					</div>
					<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
						<p className='text-primary/80 text-sm font-medium'>Correct Picks</p>
						<p className='text-2xl font-bold text-primary'>
							{stats.correctPicks}/{stats.totalPicks}
						</p>
					</div>
					<div className='bg-card rounded-lg p-4 text-center border-2 border-primary/20'>
						<p className='text-primary/80 text-sm font-medium'>TFS Points</p>
						<p className='text-2xl font-bold text-primary'>{stats.totalTFSPoints}</p>
					</div>
				</div>

				<div>
					<h3 className='text-lg font-oswald uppercase tracking-wide text-primary mb-3'>Weekly Performance</h3>
					<div className='grid grid-cols-4 gap-2'>
						{stats.weeklyStats &&
							Object.entries(stats.weeklyStats)
								.sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
								.map(([week, weeklyStat]) => (
									<div key={week} className='bg-card border-2 border-primary/20 p-2 rounded text-center cursor-pointer hover:bg-primary/10 transition' onClick={() => handleWeekClick(week)}>
										<p className='text-primary/80 text-xs font-medium'>Week {week}</p>
										<p className='font-bold text-primary'>{weeklyStat.weeklyPoints}</p>
									</div>
								))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
