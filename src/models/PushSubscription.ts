import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true
	},
	endpoint: {
		type: String,
		required: true,
		unique: true
	},
	keys: {
		p256dh: {
			type: String,
			required: true
		},
		auth: {
			type: String,
			required: true
		}
	},
	userAgent: String,
	createdAt: {
		type: Date,
		default: Date.now
	}
});

// Index for finding subscriptions by user
PushSubscriptionSchema.index({ userId: 1 });

export const PushSubscription =
	mongoose.models?.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
