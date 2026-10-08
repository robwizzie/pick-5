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
		fromUserId: { type: String, required: true },
		// Tracking, so we can tell whether nudges get picks made (see src/lib/nudgeReport.ts).
		// Nudges sent before tracking existed have none of these.
		/** Where the nudge reached them: a push, an email, or only the banner and feed */
		channel: { type: String, enum: ['push', 'email', 'in-app'], default: null },
		/** When it went out on that channel */
		deliveredAt: { type: Date, default: null },
		/** First time they opened the league from the nudge itself: its push, its email, or the banner's button */
		openedAt: { type: Date, default: null },
		openedVia: { type: String, enum: ['push', 'email', 'banner'], default: null },
		/** When they first submitted this week's picks after being nudged (later edits don't move it) */
		pickedAt: { type: Date, default: null }
	},
	{ timestamps: true }
);

NudgeSchema.index({ leagueId: 1, season: 1, week: 1, toUserId: 1 }, { unique: true });
NudgeSchema.index({ season: 1 });

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const Nudge = requestScoped(mongoose.models?.Nudge || mongoose.model('Nudge', NudgeSchema));
