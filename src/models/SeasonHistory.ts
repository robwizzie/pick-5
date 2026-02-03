// src/models/SeasonHistory.ts
import mongoose from 'mongoose';

/**
 * SeasonHistory stores the final standings and stats for each league
 * at the end of a season. This preserves historical data after
 * the current season's points are reset.
 */

// Schema for individual player stats within a season
const PlayerSeasonStatsSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true
	},
	userName: {
		type: String,
		required: true
	},
	userImage: {
		type: String,
		default: null
	},
	// Final standings
	rank: {
		type: Number,
		required: true
	},
	// Season totals
	totalPoints: {
		type: Number,
		default: 0
	},
	correctPicks: {
		type: Number,
		default: 0
	},
	totalPicks: {
		type: Number,
		default: 0
	},
	tfsPoints: {
		type: Number,
		default: 0
	},
	// Number of weeks where this player had the highest score
	weeksWon: {
		type: Number,
		default: 0
	},
	// Win percentage (correctPicks / totalPicks * 100)
	winPercentage: {
		type: Number,
		default: 0
	},
	// Weekly breakdown (optional, for detailed history)
	weeklyStats: [{
		week: Number,
		points: Number,
		correctPicks: Number,
		totalPicks: Number,
		tfsPoints: Number
	}]
}, { _id: false });

const SeasonHistorySchema = new mongoose.Schema({
	// The league this history belongs to
	leagueId: {
		type: String,
		ref: 'League',
		required: true
	},
	// League name at time of archival (in case league is renamed later)
	leagueName: {
		type: String,
		required: true
	},
	// League mode at time of archival
	leagueMode: {
		type: String,
		required: true
	},
	// The NFL season year (e.g., 2025)
	seasonYear: {
		type: Number,
		required: true
	},
	// Final standings with all player stats
	standings: [PlayerSeasonStatsSchema],
	// Season champion(s) - could be multiple if tied
	champions: [{
		userId: String,
		userName: String,
		totalPoints: Number
	}],
	// Season statistics
	seasonStats: {
		totalWeeksPlayed: {
			type: Number,
			default: 18
		},
		totalGamesPlayed: {
			type: Number,
			default: 0
		},
		totalPicksMade: {
			type: Number,
			default: 0
		},
		highestWeeklyScore: {
			userId: String,
			userName: String,
			week: Number,
			points: Number
		},
		biggestUpset: {
			week: Number,
			team: String,
			opponent: String,
			points: Number,
			pickedBy: [String] // User names who picked this upset
		}
	},
	// When this history record was created
	archivedAt: {
		type: Date,
		default: Date.now
	}
});

// Ensure one history record per league per season
SeasonHistorySchema.index({ leagueId: 1, seasonYear: 1 }, { unique: true });

// Index for efficient querying by league
SeasonHistorySchema.index({ leagueId: 1 });

// Index for querying by season year
SeasonHistorySchema.index({ seasonYear: 1 });

export const SeasonHistory = mongoose.models?.SeasonHistory || mongoose.model('SeasonHistory', SeasonHistorySchema);
