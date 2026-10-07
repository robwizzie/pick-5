// src/models/LeagueMessage.ts
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

/**
 * The league feed: members' trash talk ('chat') and auto-posted game-day moments ('moment',
 * e.g. "Sam just hit a +400 upset"). Moments carry a momentKey so each is posted once.
 */
const LeagueMessageSchema = new mongoose.Schema(
	{
		leagueId: { type: String, required: true },
		kind: { type: String, enum: ['chat', 'moment'], required: true },
		// Author of a chat message; moments name the players in `userIds`
		userId: { type: String, default: null },
		userIds: { type: [String], default: [] },
		text: { type: String, required: true, maxlength: 500 },
		// Moment icon (an emoji)
		emoji: { type: String, default: null },
		season: { type: Number, default: null },
		week: { type: Number, default: null },
		momentKey: { type: String, default: undefined },
		// emoji -> userIds who reacted with it
		reactions: { type: Map, of: [String], default: {} }
	},
	{ timestamps: true }
);

LeagueMessageSchema.index({ leagueId: 1, createdAt: -1 });
LeagueMessageSchema.index({ leagueId: 1, momentKey: 1 }, { unique: true, partialFilterExpression: { momentKey: { $type: 'string' } } });

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const LeagueMessage = requestScoped(mongoose.models?.LeagueMessage || mongoose.model('LeagueMessage', LeagueMessageSchema));
