// src/models/Nudge.ts
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

/**
 * A league-mate's reminder to get this week's picks in. At most one per player per league per
 * week (the unique index), so nobody gets flooded: the first nudge wins.
 */
const NudgeSchema = new mongoose.Schema(
	{
		leagueId: { type: String, required: true },
		season: { type: Number, required: true },
		week: { type: Number, required: true },
		toUserId: { type: String, required: true },
		fromUserId: { type: String, required: true }
	},
	{ timestamps: true }
);

NudgeSchema.index({ leagueId: 1, season: 1, week: 1, toUserId: 1 }, { unique: true });

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const Nudge = requestScoped(mongoose.models?.Nudge || mongoose.model('Nudge', NudgeSchema));
