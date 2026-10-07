// src/app/api/leagues/public/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const page = parseInt(searchParams.get('page') || '1');
		const limit = 25; // Fixed at 25 per page
		const search = searchParams.get('search') || '';
		const skip = (page - 1) * limit;

		// Get session to check if user is logged in
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;

		await connectDB();

		const query: Record<string, unknown> = {};

		// If search term is provided, use text search on league name
		if (search.trim()) {
			query.$or = [
				{ name: { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } // Case-insensitive partial match
			];
		}

		// Get total count for pagination
		const total = await League.countDocuments(query);
		const totalPages = Math.ceil(total / limit);

		// Fetch leagues with pagination
		const leagues = await League.find(query)
			.select('_id name mode members createdAt') // Only return public fields - NO password, NO inviteCode
			.sort({ createdAt: -1 }) // Newest first
			.skip(skip)
			.limit(limit)
			.lean();

		// Transform the data to include member count and membership status
		const leaguesWithCount = leagues.map(league => {
			const members = (league.members as string[] | undefined) || [];
			const isMember = userId ? members.some(memberId => memberId.toString() === userId) : false;

			return {
				id: (league._id as string).toString(),
				name: league.name as string,
				memberCount: members.length,
				createdAt: league.createdAt as Date,
				isMember
			};
		});

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
