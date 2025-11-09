import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		await connectDB();

		// Find all leagues
		const leagues = await League.find({});
		console.log(`[Migration] Found ${leagues.length} leagues`);

		let hashedCount = 0;
		let alreadyHashedCount = 0;
		const errors: string[] = [];

		for (const league of leagues) {
			try {
				// Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
				const isAlreadyHashed = /^\$2[aby]\$\d{2}\$/.test(league.password);

				if (isAlreadyHashed) {
					console.log(`[Migration] League "${league.name}" already has hashed password`);
					alreadyHashedCount++;
					continue;
				}

				// Store the original password
				const originalPassword = league.password;
				console.log(`[Migration] Hashing password for league "${league.name}"`);

				// Hash the password
				const salt = await bcrypt.genSalt(10);
				const hashedPassword = await bcrypt.hash(originalPassword, salt);

				// Update the league password directly without triggering pre-save hook
				await League.updateOne(
					{ _id: league._id },
					{ $set: { password: hashedPassword } }
				);

				// Verify the hash works by comparing
				const isValid = await bcrypt.compare(originalPassword, hashedPassword);
				if (isValid) {
					console.log(`[Migration] Successfully hashed password for league "${league.name}"`);
					hashedCount++;
				} else {
					throw new Error('Password hash verification failed');
				}
			} catch (error: unknown) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				const msg = `Failed to hash password for league "${league.name}": ${errorMessage}`;
				console.error(`[Migration] ${msg}`);
				errors.push(msg);
			}
		}

		return NextResponse.json({
			success: true,
			message: 'Password migration completed',
			summary: {
				total: leagues.length,
				hashed: hashedCount,
				alreadyHashed: alreadyHashedCount,
				errors: errors.length
			},
			errors: errors.length > 0 ? errors : undefined
		});
	} catch (error: unknown) {
		console.error('[Migration] Error during password hashing:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				success: false,
				error: 'Migration failed',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
}
