import mongoose from 'mongoose';
import { requestScoped } from '@/lib/db';

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

// requestScoped: per-request connection on Cloudflare Workers, unchanged on Node.js (see src/lib/db.ts)
export const PushSubscription = requestScoped(mongoose.models?.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema));
