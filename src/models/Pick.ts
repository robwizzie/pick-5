// src/models/Pick.ts
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

const PickSchema = new mongoose.Schema({
	userId: {
		type: String,
		ref: 'User',
		required: true
	},
	leagueId: { type: String, ref: 'League', required: true },
	week: {
		type: Number,
		required: true
	},
	// NFL season year (e.g. 2026 for the 2026-27 season). Legacy docs may lack it;
	// see seasonPickFilter / ensurePickSeasonMigration in src/lib/season.ts.
	season: { type: Number, index: true },
	picks: [
		{
			gameId: String,
			team: String,
			opponent: String,
			isHome: Boolean,
			isCorrect: {
				type: Boolean,
				default: null
			},
			odds: Number // Store odds at time of pick submission
		}
	],
	// Lock of the week: this game's pick scores double if correct (optional)
	lockGameId: { type: String, default: null },
	tfsGame: String,
	tfsScore: Number,
	tfsPoints: {
		type: Number,
		default: 0
	},
	weeklyPoints: {
		type: Number,
		default: 0
	},
	correctPicks: {
		type: Number,
		default: 0
	},
	submitted: {
		type: Boolean,
		default: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	// When this week's picks were first submitted. Editing picks deletes and recreates the doc, so
	// createdAt is the last edit; this carries over. No default: older docs lack it (fall back to createdAt).
	firstSubmittedAt: Date
});

// Ensure one pick set per user per league per season per week
PickSchema.index({ userId: 1, leagueId: 1, season: 1, week: 1 }, { unique: true });

// Check if model exists before creating new one
// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const Pick = requestScoped(mongoose.models?.Pick || mongoose.model('Pick', PickSchema));
