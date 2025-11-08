import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

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

		// Fetch the league to get member list
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Fetch only users who are members of this league
		const allUsers = await User.find({ _id: { $in: league.members } }, 'name');
		console.log('[API Debug] League Members:', allUsers.map(u => ({ id: u._id.toString(), name: u.name })));

		// First, let's see ALL picks for this league and week (for debugging)
		const allPicksForWeek = await Pick.find({ week, leagueId }).lean();
		console.log('[API Debug] All Picks for Week:', JSON.stringify(allPicksForWeek, null, 2));

		// Aggregate weekly results specific to the league
		const weeklyResults = await Pick.aggregate([
			{ $match: { week, leagueId } },
			{
				$group: {
					_id: '$userId',
					points: { $sum: '$weeklyPoints' },
					correct: { $sum: '$correctPicks' },
					tfsPoints: { $sum: '$tfsPoints' }
				}
			}
		]);

		console.log('[API Debug] Weekly Results Aggregation:', JSON.stringify(weeklyResults, null, 2));

		// Create a map of user results for quick lookup
		const weeklyResultsMap = new Map(weeklyResults.map(result => [result._id.toString(), result]));

		// Check which users have submitted picks for this week
		const picksSubmitted = await Pick.find({ week, leagueId: new ObjectId(leagueId) }, 'userId');
		const userIdsWithPicks = new Set(picksSubmitted.map(p => p.userId.toString()));

		// Populate usernames for weekly results and include users without picks
		const resultsWithUsernames = allUsers.map(user => {
			const result = weeklyResultsMap.get(user._id.toString());
			const hasPicks = userIdsWithPicks.has(user._id.toString());
			return {
				userId: user._id.toString(),
				player: user.name || 'Unknown Player',
				points: result?.points || 0,
				correct: result?.correct || 0,
				tfsPoints: result?.tfsPoints || 0,
				hasPicks
			};
		});

		// First, let's see ALL picks for this league (for debugging season stats)
		const allPicksForSeason = await Pick.find({ leagueId }).lean();
		console.log('[API Debug] All Picks for Season (count):', allPicksForSeason.length);
		console.log('[API Debug] Sample Season Pick:', JSON.stringify(allPicksForSeason[0], null, 2));

		// Aggregate season stats specific to the league
		const seasonStats = await Pick.aggregate([
			{ $match: { leagueId } },
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

		console.log('[API Debug] Season Stats Aggregation:', JSON.stringify(seasonStats, null, 2));

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

		console.log('[API Debug] Final Weekly Results Being Returned:', JSON.stringify(resultsWithUsernames, null, 2));
		console.log('[API Debug] Final Season Stats Being Returned:', JSON.stringify(seasonStatsFormatted, null, 2));

		return NextResponse.json({
			weeklyResults: resultsWithUsernames,
			seasonStats: seasonStatsFormatted
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
	}
}
