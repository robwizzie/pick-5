import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

/**
 * Migration endpoint to drop the old userId_week index and ensure the correct
 * userId_week_leagueId index exists.
 *
 * Call this once: GET /api/migrate/drop-old-pick-index
 */
export async function GET() {
	try {
		await connectDB();

		const db = mongoose.connection.db;
		if (!db) {
			return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
		}

		const collection = db.collection('picks');

		// Get all current indexes
		const indexes = await collection.indexes();
		console.log('Current indexes:', indexes);

		// Check if old index exists
		const oldIndexExists = indexes.some(idx => idx.name === 'userId_1_week_1');

		if (oldIndexExists) {
			console.log('Dropping old index: userId_1_week_1');
			await collection.dropIndex('userId_1_week_1');
			console.log('Old index dropped successfully');
		} else {
			console.log('Old index userId_1_week_1 does not exist');
		}

		// Ensure the new correct index exists
		const newIndexExists = indexes.some(idx => idx.name === 'userId_1_week_1_leagueId_1');

		if (!newIndexExists) {
			console.log('Creating new index: userId_1_week_1_leagueId_1');
			await collection.createIndex(
				{ userId: 1, week: 1, leagueId: 1 },
				{ unique: true, name: 'userId_1_week_1_leagueId_1' }
			);
			console.log('New index created successfully');
		} else {
			console.log('New index userId_1_week_1_leagueId_1 already exists');
		}

		// Get updated indexes
		const updatedIndexes = await collection.indexes();

		return NextResponse.json({
			success: true,
			message: 'Migration completed successfully',
			oldIndexDropped: oldIndexExists,
			newIndexCreated: !newIndexExists,
			currentIndexes: updatedIndexes.map(idx => idx.name)
		});
	} catch (error: unknown) {
		console.error('Migration error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json({
			error: 'Migration failed',
			details: errorMessage
		}, { status: 500 });
	}
}
