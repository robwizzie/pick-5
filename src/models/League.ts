import { Schema, model, models, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { requestScoped } from '@/lib/db';

// Define interface for League document with comparePassword method
interface ILeague extends Document {
	name: string;
	sport: string;
	mode: string;
	password: string;
	creatorId: string;
	members: string[];
	inviteCode: string;
	createdAt: Date;
	updatedAt: Date;
	comparePassword(candidatePassword: string): Promise<boolean>;
}

function stripPassword(_doc: unknown, ret: Record<string, unknown>) {
	delete ret.password;
	return ret;
}

const LeagueSchema = new Schema<ILeague>(
	{
		name: { type: String, required: true },
		sport: { type: String, required: true },
		mode: { type: String, required: true },
		// Never loaded by default: the bcrypt hash would otherwise ride along on every
		// League document a route returns, and a hash in a client's hands can be
		// brute-forced offline. Only the join flow asks for it (`.select('+password')`).
		password: { type: String, required: true, select: false },
		creatorId: { type: String, required: true },
		members: { type: [String], default: [] },
		inviteCode: { type: String, required: true, unique: true, index: true }
	},
	{
		timestamps: true, // Adds createdAt and updatedAt
		// `select: false` only governs queries. A document from `League.create()`, or one
		// whose password was just set and saved, still holds the hash in memory — so
		// strip it at serialization too, which is what NextResponse.json() goes through.
		toJSON: { transform: stripPassword },
		toObject: { transform: stripPassword }
	}
);

// Index for searching by name
LeagueSchema.index({ name: 'text' });

// Hash password before saving if it's new or modified
LeagueSchema.pre('save', async function (next) {
	// Only hash the password if it has been modified (or is new)
	if (!this.isModified('password')) {
		return next();
	}

	try {
		// Generate salt and hash password
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error: unknown) {
		const err = error instanceof Error ? error : new Error('Password hashing failed');
		next(err);
	}
});

// Method to compare password for login
LeagueSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
	return bcrypt.compare(candidatePassword, this.password);
};

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const League = requestScoped(models.League || model<ILeague>('League', LeagueSchema));
