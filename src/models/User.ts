// src/models/User.ts
import mongoose from 'mongoose';

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
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date,
		default: Date.now
	}
});

export const User = mongoose.models?.User || mongoose.model('User', UserSchema);
