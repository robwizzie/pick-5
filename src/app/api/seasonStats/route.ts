// src/app/api/seasonStats/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NFLService } from '@/services/nflService';
import { ScoringService } from '@/services/scoringService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const leagueId = searchParams.get('leagueId');

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		// Find picks for the user in the specific league
		const userPicks = await Pick.find({ userId: session.user.id, leagueId }).lean();

		// Get unique weeks from picks
		const weekSet = new Set<number>();
		userPicks.forEach(p => weekSet.add(p.week));
		const uniqueWeeks = Array.from(weekSet);

		// Fetch game results for all weeks
		const gameResultsByWeek = new Map();
		for (const weekNum of uniqueWeeks) {
			const weekGames = await NFLService.getWeeklyGames(weekNum);
			const results = weekGames.map(game => ({
				id: game.id,
				homeScore: game.home.score || 0,
				awayScore: game.away.score || 0,
				homeTeam: game.home.team,
				awayTeam: game.away.team,
				status: game.status // Include game status for accurate scoring
			}));
			gameResultsByWeek.set(weekNum, results);
		}

		// Initialize weekly stats and totals
		const weeklyStats: Record<string, { weeklyPoints: number; correctPicks: number; totalPicks: number; tfsPoints: number }> = {};
		let totalPoints = 0;
		let totalCorrectPicks = 0;
		let totalCompletedPicks = 0;
		let totalTFSPoints = 0;

		// Re-calculate stats for each week
		userPicks.forEach(pick => {
			const weekResults = gameResultsByWeek.get(pick.week) || [];

			// Re-score picks with current game results
			const { weeklyPoints, correctPicks, tfsPoints, completedGames } = ScoringService.calculateWeekScore(
				pick.picks,
				weekResults,
				pick.tfsGame,
				pick.tfsScore
			);

			// Store weekly stats
			weeklyStats[pick.week] = {
				weeklyPoints,
				correctPicks,
				totalPicks: completedGames, // Use completed games, not pick.picks.length
				tfsPoints
			};

			// Aggregate totals
			totalPoints += weeklyPoints;
			totalCorrectPicks += correctPicks;
			totalCompletedPicks += completedGames;
			totalTFSPoints += tfsPoints;
		});

		return NextResponse.json({
			totalPoints,
			correctPicks: totalCorrectPicks,
			totalPicks: totalCompletedPicks,
			totalTFSPoints,
			weeklyStats
		});
	} catch (error) {
		console.error('Error fetching season stats:', error);
		return NextResponse.json({ error: 'Failed to fetch season stats' }, { status: 500 });
	}
}
