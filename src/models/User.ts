// src/models/User.ts
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { requestScoped } from '@/lib/db';

const UserSchema = new mongoose.Schema({
	name: String,
	email: {
		type: String,
		unique: true,
		required: true
	},
	image: String,
	emailVerified: Date,
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
	// Email notification preferences
	emailPreferences: {
		pickReminders: {
			type: Boolean,
			default: true
		},
		thursdayReminder: {
			type: Boolean,
			default: true
		},
		saturdayReminder: {
			type: Boolean,
			default: true
		},
		weeklyScoreEmail: {
			type: Boolean,
			default: true
		}
	},
	// Push notification preferences
	pushNotificationsEnabled: {
		type: Boolean,
		default: false
	},
	pushNotificationPreferences: {
		gameResults: {
			type: Boolean,
			default: true
		},
		weeklyRecap: {
			type: Boolean,
			default: true
		}
	},
	// Unsubscribe token for one-click email unsubscribe
	unsubscribeToken: {
		type: String,
		unique: true,
		sparse: true,
		default: () => randomBytes(32).toString('hex')
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

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const User = requestScoped(mongoose.models?.User || mongoose.model('User', UserSchema));
