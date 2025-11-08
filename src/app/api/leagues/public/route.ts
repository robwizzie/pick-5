// src/app/api/leagues/public/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const page = parseInt(searchParams.get('page') || '1');
		const limit = 25; // Fixed at 25 per page
		const search = searchParams.get('search') || '';
		const skip = (page - 1) * limit;

		await connectDB();

		let query: any = {};

		// If search term is provided, use text search on league name
		if (search.trim()) {
			query.$or = [
				{ name: { $regex: search, $options: 'i' } } // Case-insensitive partial match
			];
		}

		// Get total count for pagination
		const total = await League.countDocuments(query);
		const totalPages = Math.ceil(total / limit);

		// Fetch leagues with pagination
		const leagues = await League.find(query)
			.select('_id name members createdAt') // Only return public fields - NO password, NO inviteCode
			.sort({ createdAt: -1 }) // Newest first
			.skip(skip)
			.limit(limit)
			.lean();

		// Transform the data to include member count
		const leaguesWithCount = leagues.map((league: any) => ({
			id: league._id.toString(),
			name: league.name,
			memberCount: league.members ? league.members.length : 0,
			createdAt: league.createdAt
		}));

		return NextResponse.json({
			leagues: leaguesWithCount,
			pagination: {
				page,
				limit,
				total,
				totalPages,
				hasMore: page < totalPages
			}
		});
	} catch (error) {
		console.error('Error fetching public leagues:', error);
		return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
	}
}
