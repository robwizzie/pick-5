import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const week = parseInt(searchParams.get('week') || '0', 10);

		await connectDB();

		console.log(`Fetching leaderboard for week ${week}`);

		// Fetch all users
		const allUsers = await User.find({}, 'name totalPoints totalTFSPoints correctPicks totalPicks');

		// Aggregate weekly results
		const weeklyResults = await Pick.aggregate([
			{ $match: { week } },
			{
				$group: {
					_id: '$userId',
					points: { $sum: '$weeklyPoints' },
					correct: { $sum: '$correctPicks' },
					tfsPoints: { $sum: '$tfsPoints' }
				}
			}
		]);

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

		// Populate season stats directly from the user data
		const seasonStatsFormatted = allUsers.map(user => ({
			player: user.name || 'Unknown Player',
			totalPoints: user.totalPoints || 0,
			totalTFSPoints: user.totalTFSPoints || 0,
			winPercentage: user.totalPicks > 0 ? (user.correctPicks / user.totalPicks) * 100 : 0
		}));

		return NextResponse.json({
			weeklyResults: resultsWithUsernames,
			seasonStats: seasonStatsFormatted
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
	}
}
