// Track which game result notifications have been sent to prevent duplicates
import mongoose from 'mongoose';

const GameNotificationSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true
	},
	gameId: {
		type: String,
		required: true,
		index: true
	},
	leagueId: {
		type: String,
		required: true,
		index: true
	},
	week: {
		type: Number,
		required: true
	},
	notificationType: {
		type: String,
		enum: ['game_result', 'weekly_recap'],
		required: true
	},
	sentAt: {
		type: Date,
		default: Date.now
	}
});

// Compound index to quickly check if notification was already sent
GameNotificationSchema.index({ userId: 1, gameId: 1, leagueId: 1, week: 1 }, { unique: true });

export const GameNotification = mongoose.models?.GameNotification || mongoose.model('GameNotification', GameNotificationSchema);
