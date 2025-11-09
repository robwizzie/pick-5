import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/adminAuth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to fix odds for a specific game
 * This updates all picks that include the specified game
 */
export async function POST(req: Request) {
	try {
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		const body = await req.json();
		const { gameId, week, homeTeam, awayTeam, homeOdds, awayOdds } = body;

		if (!gameId || !week || !homeTeam || !awayTeam || homeOdds === undefined || awayOdds === undefined) {
			return NextResponse.json({
				error: 'Missing required fields: gameId, week, homeTeam, awayTeam, homeOdds, awayOdds'
			}, { status: 400 });
		}

		await connectDB();

		// Find all picks for this week that include this game
		const picksToUpdate = await Pick.find({
			week: week,
			'picks.gameId': gameId
		});

		console.log(`Found ${picksToUpdate.length} picks to update for game ${gameId}`);

		let updatedCount = 0;

		// Update each pick
		for (const pick of picksToUpdate) {
			let modified = false;

			// Update the odds for the specific game in this pick
			pick.picks = pick.picks.map((p: any) => {
				if (p.gameId === gameId) {
					// Determine which odds to use based on the team
					let newOdds;
					if (p.team === homeTeam) {
						newOdds = homeOdds;
					} else if (p.team === awayTeam) {
						newOdds = awayOdds;
					} else {
						console.warn(`Pick team ${p.team} doesn't match home/away teams`);
						return p;
					}

					console.log(`Updating pick for ${p.team}: old odds = ${p.odds}, new odds = ${newOdds}`);
					modified = true;
					return { ...p, odds: newOdds };
				}
				return p;
			});

			if (modified) {
				await pick.save();
				updatedCount++;
			}
		}

		return NextResponse.json({
			success: true,
			message: `Updated odds for ${updatedCount} picks`,
			details: {
				gameId,
				week,
				homeTeam,
				awayTeam,
				homeOdds,
				awayOdds,
				picksUpdated: updatedCount
			}
		});
	} catch (error) {
		console.error('Error fixing game odds:', error);
		return NextResponse.json({
			error: 'Failed to fix game odds',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}
