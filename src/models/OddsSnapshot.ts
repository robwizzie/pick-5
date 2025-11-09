import mongoose from 'mongoose';

const OddsSnapshotSchema = new mongoose.Schema({
	week: {
		type: Number,
		required: true,
		index: true
	},
	season: {
		type: Number,
		required: true
	},
	gameId: {
		type: String,
		required: true
	},
	homeTeam: {
		type: String,
		required: true
	},
	awayTeam: {
		type: String,
		required: true
	},
	homeOdds: {
		type: Number,
		required: true
	},
	awayOdds: {
		type: Number,
		required: true
	},
	commenceTime: {
		type: Date,
		required: true
	},
	lastUpdated: {
		type: Date,
		default: Date.now
	},
	source: {
		type: String,
		default: 'odds-api' // 'odds-api' or 'manual'
	}
});

// Unique index to prevent duplicate snapshots for the same game
OddsSnapshotSchema.index({ week: 1, season: 1, gameId: 1 }, { unique: true });

// Index for efficient queries
OddsSnapshotSchema.index({ week: 1, season: 1, commenceTime: 1 });

export const OddsSnapshot = mongoose.models?.OddsSnapshot || mongoose.model('OddsSnapshot', OddsSnapshotSchema);
