// src/models/SurvivorPick.ts
import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

/** A Survivor league pick: one team per member per week (see src/lib/survivor.ts). */
const SurvivorPickSchema = new mongoose.Schema(
	{
		leagueId: { type: String, required: true },
		userId: { type: String, required: true },
		season: { type: Number, required: true },
		week: { type: Number, required: true },
		gameId: { type: String, required: true },
		team: { type: String, required: true },
		abbreviation: { type: String, default: '' },
		logo: { type: String, default: '' },
		isHome: { type: Boolean, default: false }
	},
	{ timestamps: true }
);

SurvivorPickSchema.index({ leagueId: 1, userId: 1, season: 1, week: 1 }, { unique: true });
SurvivorPickSchema.index({ leagueId: 1, season: 1 });

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const SurvivorPick = requestScoped(mongoose.models?.SurvivorPick || mongoose.model('SurvivorPick', SurvivorPickSchema));
