// src/models/Pick.ts
import mongoose from 'mongoose';

const PickSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	leagueId: { type: mongoose.Schema.Types.ObjectId, ref: 'League', required: true },
	week: {
		type: Number,
		required: true
	},
	picks: [
		{
			gameId: String,
			team: String,
			opponent: String,
			isHome: Boolean,
			isCorrect: Boolean
		}
	],
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
	}
});

// Ensure one pick set per user per week
PickSchema.index({ userId: 1, week: 1 }, { unique: true });

// Check if model exists before creating new one
export const Pick = mongoose.models?.Pick || mongoose.model('Pick', PickSchema);
