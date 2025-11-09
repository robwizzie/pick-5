import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import { checkAdminAuth } from '@/lib/adminAuth';
import { Types } from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const session = await checkAdminAuth();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
		}

		await connectDB();

		const leagues = (await League.find({}, { name: 1, mode: 1 }).sort({ name: 1 }).lean()) as unknown as Array<{ _id: Types.ObjectId; name: string; mode: string }>;

		return NextResponse.json({
			leagues: leagues.map((league: { _id: Types.ObjectId; name: string; mode: string }) => ({
				_id: league._id.toString(),
				name: league.name,
				mode: league.mode
			}))
		});
	} catch (error) {
		console.error('Error fetching leagues list:', error);
		return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
	}
}
