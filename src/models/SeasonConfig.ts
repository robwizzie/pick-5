// src/models/SeasonConfig.ts
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

/**
 * SeasonConfig stores the global season state for Pick 5.
 * There should only be one document in this collection.
 *
 * The season is considered "active" when:
 * - isActive is true
 * - startWeek <= currentWeek <= finalWeek
 *
 * Only weeks startWeek..finalWeek count (defaults in src/lib/seasonYear.ts: week 1 to week 17;
 * an admin can change both per season).
 * When a new season starts (September), the admin should:
 * 1. Archive the previous season's data
 * 2. Reset all points/standings
 * 3. Set isActive to true and update the season year
 */
const SeasonConfigSchema = new mongoose.Schema({
	// The NFL season year (e.g., 2025 for the 2025-2026 season)
	seasonYear: {
		type: Number,
		required: true
	},
	// Whether the season is currently active (accepting picks, sending notifications)
	isActive: {
		type: Boolean,
		default: true
	},
	// The first and last weeks that count this season. Unset means the defaults (resolveSeasonWeeks);
	// no schema defaults, so saving an older config never pins today's default into it.
	startWeek: { type: Number, min: 1, max: 18 },
	finalWeek: { type: Number, min: 1, max: 18 },
	// The last week that was completed (1-18)
	lastCompletedWeek: {
		type: Number,
		default: 0
	},
	// Whether the season has been archived (standings saved to SeasonHistory)
	isArchived: {
		type: Boolean,
		default: false
	},
	// Timestamp when the season was deactivated
	deactivatedAt: {
		type: Date,
		default: null
	},
	// Timestamp when the season was archived
	archivedAt: {
		type: Date,
		default: null
	},
	// Notes about the season (optional, for admin reference)
	notes: {
		type: String,
		default: ''
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

// Update the updatedAt timestamp on save
SeasonConfigSchema.pre('save', function (next) {
	this.updatedAt = new Date();
	next();
});

// Ensure only one season config document exists (use seasonYear as unique identifier)
SeasonConfigSchema.index({ seasonYear: 1 }, { unique: true });

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const SeasonConfig = requestScoped(mongoose.models?.SeasonConfig || mongoose.model('SeasonConfig', SeasonConfigSchema));
