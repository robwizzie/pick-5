import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

// Generate a random invite code
function generateInviteCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let code = '';
	for (let i = 0; i < 16; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}

export async function GET() {
	try {
		await connectDB();
		const db = mongoose.connection.db;
		const leaguesCollection = db.collection('leagues');

		// Find all leagues without inviteCode
		const leaguesWithoutInviteCode = await leaguesCollection.find({
			$or: [
				{ inviteCode: { $exists: false } },
				{ inviteCode: null },
				{ inviteCode: '' }
			]
		}).toArray();

		console.log(`[Fix Invite Codes] Found ${leaguesWithoutInviteCode.length} leagues without invite codes`);

		const results = [];
		for (const league of leaguesWithoutInviteCode) {
			const inviteCode = generateInviteCode();

			// Update the league with a new invite code
			await leaguesCollection.updateOne(
				{ _id: league._id },
				{ $set: { inviteCode } }
			);

			results.push({
				leagueId: league._id.toString(),
				name: league.name,
				inviteCode
			});

			console.log(`[Fix Invite Codes] Added invite code to league: ${league.name} - ${inviteCode}`);
		}

		return NextResponse.json({
			success: true,
			message: `Added invite codes to ${results.length} leagues`,
			leagues: results
		});
	} catch (error: unknown) {
		console.error('[Fix Invite Codes] Error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to fix invite codes',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
}
