import { Schema, model, models } from 'mongoose';
import bcrypt from 'bcryptjs';

const LeagueSchema = new Schema(
	{
		name: { type: String, required: true },
		sport: { type: String, required: true },
		mode: { type: String, required: true },
		password: { type: String, required: true },
		creatorId: { type: String, required: true },
		members: { type: [String], default: [] },
		inviteCode: { type: String, required: true, unique: true, index: true }
	},
	{
		timestamps: true // Adds createdAt and updatedAt
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

export const League = models.League || model('League', LeagueSchema);
