// src/app/api/picks/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/db';
import { Pick } from '@/models/Pick';
import { User } from '@/models/User';
import { authOptions } from '@/lib/auth';
import { ScoringService } from '@/services/scoringService';
import { NFLService } from '@/services/nflService';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { week, picks, tfsGame, tfsScore, leagueId } = body;

		await connectDB();

		if (!week || !picks || picks.length !== 5 || !tfsGame || typeof tfsScore !== 'number' || !leagueId) {
			return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
		}

		// Check if user already submitted picks for this week
		const existingPicks = await Pick.findOne({
			userId: session.user.id,
			leagueId,
			week
		});

		if (existingPicks) {
			console.error('Picks already submitted for this week');
			return NextResponse.json({ error: 'Picks already submitted for this week' }, { status: 400 });
		}

		// Get game results for scoring
		const games = await NFLService.getWeeklyGames(week);
		console.log('ESPN API Response:', games);

		if (!games || !games.length) {
			return NextResponse.json({ error: 'No games found for week' }, { status: 400 });
		}

		const gameResults = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team
		}));

		console.log('Game results for scoring:', gameResults);

		// Calculate scores
		const { scoredPicks, weeklyPoints, correctPicks, tfsPoints } = ScoringService.calculateWeekScore(picks, gameResults, tfsGame, tfsScore);

		console.log('Calculated scores:', { scoredPicks, weeklyPoints, correctPicks, tfsPoints });

		// Create new picks with scores
		const newPicks = await Pick.create({
			userId: session.user.id,
			leagueId,
			week,
			picks,
			tfsGame,
			tfsScore,
			weeklyPoints: 0,
			correctPicks: 0,
			tfsPoints: 0,
			submitted: true
		});

		console.log('Created picks with user ID:', session.user.id);

		// Update user's total stats
		const totalStats = await Pick.aggregate([
			{ $match: { userId: session.user.id, leagueId } },
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

		console.log('User total stats:', totalStats);

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

		if (!week || !leagueId) {
			return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
		}

		await connectDB();

		const picks = await Pick.findOne({
			userId: session.user.id,
			week: parseInt(week, 10),
			leagueId
		});

		if (!picks) {
			return NextResponse.json(null);
		}

		// Get current game results for re-scoring if needed
		const games = await NFLService.getWeeklyGames(parseInt(week, 10));
		const gameResults = games.map(game => ({
			id: game.id,
			homeScore: game.home.score || 0,
			awayScore: game.away.score || 0,
			homeTeam: game.home.team,
			awayTeam: game.away.team
		}));

		// Recalculate scores with current results
		const { scoredPicks, weeklyPoints, correctPicks, tfsPoints } = ScoringService.calculateWeekScore(picks.picks, gameResults, picks.tfsGame, picks.tfsScore);

		// Update picks with current scores if they've changed
		if (weeklyPoints !== picks.weeklyPoints || correctPicks !== picks.correctPicks || tfsPoints !== picks.tfsPoints) {
			picks.picks = scoredPicks;
			picks.weeklyPoints = weeklyPoints;
			picks.correctPicks = correctPicks;
			picks.tfsPoints = tfsPoints;
			await picks.save();

			// Update user's total stats
			await User.findOneAndUpdate(
				{ _id: session.user.id },
				{
					$set: {
						totalPoints: await Pick.aggregate([{ $match: { userId: session.user.id } }, { $group: { _id: null, total: { $sum: '$weeklyPoints' } } }]).then(result => result[0]?.total || 0),
						correctPicks: await Pick.aggregate([{ $match: { userId: session.user.id } }, { $group: { _id: null, total: { $sum: '$correctPicks' } } }]).then(result => result[0]?.total || 0),
						totalTFSPoints: await Pick.aggregate([{ $match: { userId: session.user.id } }, { $group: { _id: null, total: { $sum: '$tfsPoints' } } }]).then(result => result[0]?.total || 0)
					}
				}
			);
		}

		return NextResponse.json(picks);
	} catch (error) {
		console.error('Error fetching picks:', error);
		return NextResponse.json({ error: 'Error fetching picks' }, { status: 500 });
	}
}
