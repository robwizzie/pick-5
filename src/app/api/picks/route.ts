// src/app/api/picks/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { League } from '@/models/League';
import { authOptions } from '@/lib/auth';
import { ScoringService } from '@/services/scoringService';
import { NFLService } from '@/services/nflService';
import { SeasonService } from '@/services/seasonService';
import { hasGameStarted } from '@/services/gameUtils';
import { ensurePickSeasonMigration, getCurrentSeasonYear, seasonPickFilter } from '@/lib/season';
import type { Game } from '@/components/games/GameCard';
import { revealStartedOnly } from '@/lib/pickScoring';
import { calculatePointsFromOdds } from '@/utils/oddsUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { week, picks, tfsGame, tfsScore, leagueId } = body;
		// Lock of the week is optional and must be one of this week's five picks
		const lockGameId: string | null =
			typeof body.lockGameId === 'string' && Array.isArray(picks) && picks.some((p: { gameId?: string }) => p?.gameId === body.lockGameId) ? body.lockGameId : null;

		await connectDB();

		// Check if season is active and accepting picks
		const seasonStatus = await SeasonService.getSeasonStatus();
		if (!seasonStatus.canSubmitPicks) {
			return NextResponse.json(
				{
					error: 'Season has ended',
					message: seasonStatus.message || 'Pick 5 is currently between seasons. Picks cannot be submitted at this time.'
				},
				{ status: 400 }
			);
		}

		// Prevent picks for weeks beyond 18
		if (week > 18) {
			return NextResponse.json(
				{
					error: 'Invalid week',
					message: 'Picks can only be submitted for weeks 1-18 of the NFL regular season.'
				},
				{ status: 400 }
			);
		}

		// Basic validation
		if (!week || !picks || picks.length !== 5 || !leagueId) {
			return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
		}

		// Fetch league to check mode
		const league = await League.findById(leagueId);
		if (!league) {
			return NextResponse.json({ error: 'League not found' }, { status: 404 });
		}

		// TFS is only required for Steve mode
		const isSteveMode = league.mode === 'steve';
		if (isSteveMode && (!tfsGame || typeof tfsScore !== 'number')) {
			return NextResponse.json({ error: 'TFS game and score required for Steve mode' }, { status: 400 });
		}

		const season = getCurrentSeasonYear();
		// The legacy unique index {userId, week, leagueId} would reject this season's picks
		// for a week already picked last season. Don't block submissions if it fails;
		// the next request retries.
		try {
			await ensurePickSeasonMigration();
		} catch (error) {
			console.error('[Picks API] Pick season migration failed:', error);
		}

		// Get game results for validation and scoring
		const games = await NFLService.getWeeklyGames(week, season);

		if (!games || !games.length) {
			console.error(`[Picks API] No games found for week ${week} of season ${season}`);
			return NextResponse.json(
				{
					error: 'No games found for week',
					details: `No games available for week ${week}. Please try again or contact support.`
				},
				{ status: 400 }
			);
		}

		// Check if user already submitted picks for this week
		const existingPicks = await Pick.findOne({
			userId: session.user.id,
			leagueId,
			week,
			...seasonPickFilter(season)
		});

		// Check if any of the new picks' games have started
		const newPickedGames = picks
			.map((pick: { gameId: string; team: string; opponent: string; isHome: boolean }) => {
				return games.find(g => g.id === pick.gameId);
			})
			.filter(Boolean) as Game[];

		// Only check TFS game for Steve mode
		const tfsGameObj = isSteveMode && tfsGame ? games.find(g => g.id === tfsGame) : null;
		const allNewGames = tfsGameObj ? [...newPickedGames, tfsGameObj] : newPickedGames;

		const anyNewGameStarted = allNewGames.some(game => hasGameStarted(game));

		if (anyNewGameStarted) {
			console.error('Cannot submit picks - one or more selected games have already started');
			return NextResponse.json(
				{
					error: 'Cannot submit picks - one or more selected games have already started'
				},
				{ status: 400 }
			);
		}

		// If picks exist, check if any of the existing picked games have started
		if (existingPicks) {
			const existingPickedGames = existingPicks.picks
				.map((pick: { gameId: string; team: string; opponent: string; isHome: boolean }) => {
					return games.find(g => g.id === pick.gameId);
				})
				.filter(Boolean) as Game[];

			// Check if any of the existing picked games have started
			const anyExistingGameStarted = existingPickedGames.some(game => hasGameStarted(game));

			if (anyExistingGameStarted) {
				console.error('Cannot edit picks - one or more games from your existing picks have already started');
				return NextResponse.json(
					{
						error: 'Cannot edit picks - one or more games from your existing picks have already started'
					},
					{ status: 400 }
				);
			}

			// If no games have started, allow update - delete existing picks
			await Pick.deleteOne({ _id: existingPicks._id });
		}

		const gameResults = games.map(game => ({
			id: game.id,
			// Only include scores if they're actual numbers (not undefined)
			// Use undefined instead of 0 to distinguish "no score yet" from "score is 0"
			homeScore: typeof game.home.score === 'number' ? game.home.score : undefined,
			awayScore: typeof game.away.score === 'number' ? game.away.score : undefined,
			homeTeam: game.home.team,
			awayTeam: game.away.team
		}));

		// Calculate scores (only for finished games)
		// For Standard mode, pass null for TFS fields
		const { scoredPicks, weeklyPoints, correctPicks, tfsPoints } = ScoringService.calculateWeekScore(
			picks,
			gameResults,
			isSteveMode ? tfsGame : null,
			isSteveMode ? tfsScore : null,
			league.mode || 'standard',
			calculatePointsFromOdds,
			lockGameId
		);

		// Create new picks with scores (will be 0 for games that haven't finished yet)
		// For Standard mode, tfsGame and tfsScore will be null/undefined
		const newPicks = await Pick.create({
			userId: session.user.id,
			leagueId,
			season,
			week,
			picks: scoredPicks,
			lockGameId,
			tfsGame: isSteveMode ? tfsGame : null,
			tfsScore: isSteveMode ? tfsScore : null,
			weeklyPoints,
			correctPicks,
			tfsPoints,
			submitted: true
		});

		// Update user's total stats (current season, this league)
		const totalStats = await Pick.aggregate([
			{ $match: { userId: session.user.id, leagueId, ...seasonPickFilter(season) } },
			{
				$group: {
					_id: null,
					totalPoints: { $sum: '$weeklyPoints' },
					correctPicks: { $sum: '$correctPicks' },
					totalPicks: { $sum: { $size: '$picks' } },
					totalTFSPoints: { $sum: '$tfsPoints' }
				}
			}
		]);

		await User.findOneAndUpdate(
			{ _id: session.user.id },
			{
				totalPoints: totalStats[0]?.totalPoints || 0,
				correctPicks: totalStats[0]?.correctPicks || 0,
				totalPicks: totalStats[0]?.totalPicks || 0,
				totalTFSPoints: totalStats[0]?.totalTFSPoints || 0
			}
		);

		return NextResponse.json(newPicks);
	} catch (error: unknown) {
		console.error('Full error details:', error);
		const errorMessage = error instanceof Error ? error.message : 'Error saving picks';
		const errorStack = error instanceof Error ? error.stack : undefined;

		return NextResponse.json({ error: errorMessage, details: errorStack }, { status: 500 });
	}
}

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		const week = searchParams.get('week');
		const leagueId = searchParams.get('leagueId');
		const requestedUserId = searchParams.get('userId'); // Optional: fetch another user's picks

		if (!week || !leagueId) {
			return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
		}

		await connectDB();

		// If userId is provided, verify the requesting user is in the same league
		const targetUserId = requestedUserId || session.user.id;

		if (requestedUserId && requestedUserId !== session.user.id) {
			// Verify both users are in the same league
			const league = await League.findById(leagueId);
			if (!league) {
				return NextResponse.json({ error: 'League not found' }, { status: 404 });
			}

			// members is an array of user ID strings, not objects
			const isRequesterMember = league.members.some((userId: string) => userId.toString() === session.user.id);
			const isTargetMember = league.members.some((userId: string) => userId.toString() === requestedUserId);

			if (!isRequesterMember || !isTargetMember) {
				return NextResponse.json({ error: 'Unauthorized to view these picks' }, { status: 403 });
			}
		}

		const season = getCurrentSeasonYear();
		const picks = await Pick.findOne({
			userId: targetUserId,
			week: parseInt(week, 10),
			leagueId,
			...seasonPickFilter(season)
		});

		if (!picks) {
			return NextResponse.json(null);
		}

		// Get league for mode
		const league = await League.findById(leagueId);
		const leagueMode = league?.mode || 'standard';

		// Get current game results for re-scoring if needed
		const games = await NFLService.getWeeklyGames(parseInt(week, 10), season);
		const gameResults = games.map(game => ({
			id: game.id,
			// Only include scores if they're actual numbers (not undefined)
			// Use undefined instead of 0 to distinguish "no score yet" from "score is 0"
			homeScore: typeof game.home.score === 'number' ? game.home.score : undefined,
			awayScore: typeof game.away.score === 'number' ? game.away.score : undefined,
			homeTeam: game.home.team,
			awayTeam: game.away.team,
			status: game.status // Pass game status for proper finished check
		}));

		// Recalculate scores with current results (only scores finished games)
		const { scoredPicks, weeklyPoints, correctPicks, tfsPoints } = ScoringService.calculateWeekScore(
			picks.picks,
			gameResults,
			picks.tfsGame,
			picks.tfsScore,
			leagueMode,
			calculatePointsFromOdds,
			picks.lockGameId
		);

		// Update picks with current scores if they've changed
		if (weeklyPoints !== picks.weeklyPoints || correctPicks !== picks.correctPicks || tfsPoints !== picks.tfsPoints) {
			picks.picks = scoredPicks;
			picks.weeklyPoints = weeklyPoints;
			picks.correctPicks = correctPicks;
			picks.tfsPoints = tfsPoints;
			if (picks.season == null) picks.season = season;
			await picks.save();

			// Update user's total stats (only update if it's the current user's picks being fetched)
			if (targetUserId === session.user.id) {
				await User.findOneAndUpdate(
					{ _id: targetUserId },
					{
						$set: {
							totalPoints: await Pick.aggregate([{ $match: { userId: targetUserId, ...seasonPickFilter(season) } }, { $group: { _id: null, total: { $sum: '$weeklyPoints' } } }]).then(result => result[0]?.total || 0),
							correctPicks: await Pick.aggregate([{ $match: { userId: targetUserId, ...seasonPickFilter(season) } }, { $group: { _id: null, total: { $sum: '$correctPicks' } } }]).then(result => result[0]?.total || 0),
							totalTFSPoints: await Pick.aggregate([{ $match: { userId: targetUserId, ...seasonPickFilter(season) } }, { $group: { _id: null, total: { $sum: '$tfsPoints' } } }]).then(result => result[0]?.total || 0)
						}
					}
				);
			}
		}

		// Another member's picks are only revealed once each game kicks off
		if (targetUserId !== session.user.id) {
			return NextResponse.json(revealStartedOnly(picks.toObject(), gameResults));
		}
		return NextResponse.json(picks);
	} catch (error) {
		console.error('Error fetching picks:', error);
		return NextResponse.json({ error: 'Error fetching picks' }, { status: 500 });
	}
}
