import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { League } from '@/models/League';
import { User } from '@/models/User';
import { OddsSnapshot } from '@/models/OddsSnapshot';
import { NFLService } from '@/services/nflService';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';
import { hasGameFinished } from '@/services/gameUtils';

export const dynamic = 'force-dynamic';

export async function POST() {
	try {
		await connectDB();

		const details: string[] = [];
		let totalPicksProcessed = 0;
		let picksUpdated = 0;
		let picksSkipped = 0;
		const usersToUpdate = new Set<string>();

		// Find all picks that don't have odds in the picks array
		const allPicks = await Pick.find({}).lean();

		console.log(`[FixPickOdds] Found ${allPicks.length} total pick documents`);
		details.push(`Found ${allPicks.length} total pick documents`);

		for (const pickDoc of allPicks) {
			// Check if this is a standard mode league
			const league = await League.findById(pickDoc.leagueId).lean();
			if (!league || (league as any).mode !== 'standard') {
				continue; // Skip non-standard mode leagues
			}

			// Fetch odds snapshots for this week (fetch once per pick document)
			const snapshots = await OddsSnapshot.find({
				week: pickDoc.week,
				season: new Date().getFullYear()
			}).lean();

			if (snapshots.length === 0) {
				details.push(`⚠️ No snapshots for week ${pickDoc.week}, skipping all picks`);
				continue;
			}

			// Check each individual pick in the picks array
			let docUpdated = false;
			const updatedPicks = [];

			for (const pick of pickDoc.picks) {
				totalPicksProcessed++;

				// Skip if pick already has odds
				if (pick.odds !== undefined && pick.odds !== null) {
					updatedPicks.push(pick);
					picksSkipped++;
					continue;
				}

				// Find the snapshot for this specific game
				const gameSnapshot = snapshots.find((s: any) => s.gameId === pick.gameId);
				if (!gameSnapshot) {
					details.push(`⚠️ No snapshot for game ${pick.gameId}, skipping`);
					updatedPicks.push(pick);
					picksSkipped++;
					continue;
				}

				// Determine which team's odds to use based on pick.isHome
				const odds = pick.isHome ? (gameSnapshot as any).homeOdds : (gameSnapshot as any).awayOdds;

				if (odds === undefined || odds === null) {
					details.push(`⚠️ No ${pick.isHome ? 'home' : 'away'} odds for game ${pick.gameId}, skipping`);
					updatedPicks.push(pick);
					picksSkipped++;
					continue;
				}

				// Update the pick with odds
				updatedPicks.push({
					...pick,
					odds: odds
				});

				picksUpdated++;
				docUpdated = true;
				details.push(`✓ Updated pick for ${pick.team} (week ${pickDoc.week}) with odds ${odds}`);
			}

			// If any picks were updated, recalculate scores
			if (docUpdated) {
				// Fetch games for this week to check if they're finished
				const games = await NFLService.getWeeklyGames(pickDoc.week);

				let weeklyPoints = 0;
				let correctPicks = 0;

				// Recalculate points for each pick
				for (const pick of updatedPicks) {
					const game = games.find(g => g.id === pick.gameId);
					if (!game) continue;

					// Only calculate points if game is finished
					if (hasGameFinished(game)) {
						const homeScore = game.home.score;
						const awayScore = game.away.score;

						if (typeof homeScore === 'number' && typeof awayScore === 'number') {
							const homeWon = homeScore > awayScore;
							const pickedHome = pick.isHome;
							const isCorrect = (pickedHome && homeWon) || (!pickedHome && !homeWon);

							if (isCorrect && pick.odds !== undefined) {
								const points = calculatePointsFromOdds(pick.odds);
								weeklyPoints += points;
								correctPicks++;
							}
						}
					}
				}

				// Update the pick document
				await Pick.updateOne(
					{ _id: pickDoc._id },
					{
						$set: {
							picks: updatedPicks,
							weeklyPoints,
							correctPicks
						}
					}
				);

				usersToUpdate.add(pickDoc.userId);
				details.push(`✓ Updated pick document for user ${pickDoc.userId}, week ${pickDoc.week}: ${weeklyPoints} pts, ${correctPicks} correct`);
			}
		}

		// Update user totals
		for (const userId of Array.from(usersToUpdate)) {
			const userPicks = await Pick.find({ userId }).lean();

			const totalPoints = userPicks.reduce((sum, p) => sum + (p.weeklyPoints || 0), 0);
			const totalCorrectPicks = userPicks.reduce((sum, p) => sum + (p.correctPicks || 0), 0);
			const totalTFSPoints = userPicks.reduce((sum, p) => sum + (p.tfsPoints || 0), 0);
			const totalPicksCount = userPicks.reduce((sum, p) => sum + (p.picks?.length || 0), 0);

			await User.updateOne(
				{ _id: userId },
				{
					$set: {
						totalPoints,
						correctPicks: totalCorrectPicks,
						totalTFSPoints,
						totalPicks: totalPicksCount
					}
				}
			);

			details.push(`✓ Updated user ${userId} totals: ${totalPoints} pts`);
		}

		return NextResponse.json({
			success: true,
			totalPicksProcessed,
			picksUpdated,
			picksSkipped,
			usersUpdated: usersToUpdate.size,
			details: details.slice(0, 50) // Limit to first 50 details
		});

	} catch (error) {
		console.error('[FixPickOdds] Error:', error);
		return NextResponse.json(
			{ error: 'Failed to fix pick odds', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}
