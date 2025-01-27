import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '0', 10);
		const leagueId = searchParams.get('leagueId');

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		console.log(`[API Debug] Fetching leaderboard for week ${week} in league ${leagueId}`);

		// Fetch all users in the league
		const allUsers = await User.find({}, 'name totalPoints totalTFSPoints correctPicks totalPicks');
		console.log('[API Debug] All Users:', allUsers);

		// Aggregate weekly results specific to the league
		const weeklyResults = await Pick.aggregate([
			{ $match: { week, leagueId: new ObjectId(leagueId) } },
			{
				$group: {
					_id: '$userId',
					points: { $sum: '$weeklyPoints' },
					correct: { $sum: '$correctPicks' },
					tfsPoints: { $sum: '$tfsPoints' }
				}
			}
		]);

		console.log('[API Debug] Weekly Results:', weeklyResults);

		// Create a map of user results for quick lookup
		const weeklyResultsMap = new Map(weeklyResults.map(result => [result._id.toString(), result]));

		// Populate usernames for weekly results and include users without picks
		const resultsWithUsernames = allUsers.map(user => {
			const result = weeklyResultsMap.get(user._id.toString());
			return {
				player: user.name || 'Unknown Player',
				points: result?.points || 0,
				correct: result?.correct || 0,
				tfsPoints: result?.tfsPoints || 0
			};
		});

		// Aggregate season stats specific to the league
		const seasonStats = await Pick.aggregate([
			{ $match: { leagueId: new ObjectId(leagueId) } },
			{
				$group: {
					_id: '$userId',
					totalPoints: { $sum: '$weeklyPoints' },
					totalTFSPoints: { $sum: '$tfsPoints' },
					correctPicks: { $sum: '$correctPicks' },
					totalPicks: { $sum: { $size: '$picks' } }
				}
			}
		]);

		console.log('[API Debug] Season Stats:', seasonStats);

		// Create a map for season stats
		const seasonStatsMap = new Map(seasonStats.map(stat => [stat._id.toString(), stat]));

		// Format season stats with usernames
		const seasonStatsFormatted = allUsers.map(user => {
			const stat = seasonStatsMap.get(user._id.toString());
			return {
				player: user.name || 'Unknown Player',
				totalPoints: stat?.totalPoints || 0,
				totalTFSPoints: stat?.totalTFSPoints || 0,
				totalPicks: stat?.totalPicks || 0,
				correctPicks: stat?.correctPicks || 0,
				winPercentage: stat?.totalPicks > 0 ? (stat.correctPicks / stat.totalPicks) * 100 : 0
			};
		});

		return NextResponse.json({
			weeklyResults: resultsWithUsernames,
			seasonStats: seasonStatsFormatted
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
	}
}
