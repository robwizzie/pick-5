import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { parseSeasonParam, seasonPickFilter } from '@/lib/season';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const week = parseInt(searchParams.get('week') || '1');
		const leagueId = searchParams.get('leagueId');
		const gameId = searchParams.get('gameId'); // Optional - filter by specific game

		if (!leagueId) {
			return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
		}

		await connectDB();

		// Verify league exists and get members
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// Fetch all picks for this week and league
		const picks = await Pick.find({
			leagueId,
			week,
			...seasonPickFilter(parseSeasonParam(searchParams.get('season')))
		});

		// Get user information for all picks
		const userIds = Array.from(new Set(picks.map(p => p.userId)));
		const users = await User.find({ _id: { $in: userIds } }, 'name image');

		// Create a map of userId -> user info
		const userMap = new Map(users.map(u => [u._id.toString(), { name: u.name, image: u.image }]));

		// Structure the data by game and team
		const gamePicksMap = new Map<string, {
			away: Array<{ userId: string; name: string; image: string | null }>;
			home: Array<{ userId: string; name: string; image: string | null }>;
		}>();

		picks.forEach(pick => {
			const user = userMap.get(pick.userId);
			if (!user) return;

			pick.picks.forEach((gamePick: { gameId: string; team: string; opponent: string; isHome: boolean; isCorrect?: boolean }) => {
				// If gameId filter is provided, only include that game
				if (gameId && gamePick.gameId !== gameId) return;

				if (!gamePicksMap.has(gamePick.gameId)) {
					gamePicksMap.set(gamePick.gameId, { away: [], home: [] });
				}

				const gamePicks = gamePicksMap.get(gamePick.gameId)!;
				const userInfo = {
					userId: pick.userId,
					name: user.name || 'Unknown',
					image: user.image || null
				};

				// Add to home or away based on isHome flag
				if (gamePick.isHome) {
					gamePicks.home.push(userInfo);
				} else {
					gamePicks.away.push(userInfo);
				}
			});
		});

		// Convert map to object for JSON response
		const result: Record<string, { away: Array<{ userId: string; name: string; image: string | null }>; home: Array<{ userId: string; name: string; image: string | null }> }> = {};
		gamePicksMap.forEach((value, key) => {
			result[key] = value;
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error('Error fetching league picks:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
