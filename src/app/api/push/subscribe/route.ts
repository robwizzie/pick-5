import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { PushSubscription } from '@/models/PushSubscription';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const subscription = await req.json();

		if (!subscription || !subscription.endpoint) {
			return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
		}

		await connectDB();

		// Check if subscription already exists
		const existing = await PushSubscription.findOne({
			endpoint: subscription.endpoint
		});

		if (existing) {
			// Update userId if needed (in case of re-subscription)
			if (existing.userId !== session.user.id) {
				existing.userId = session.user.id;
				await existing.save();
			}
			return NextResponse.json({ success: true, message: 'Subscription already exists' });
		}

		// Create new subscription
		await PushSubscription.create({
			userId: session.user.id,
			endpoint: subscription.endpoint,
			keys: {
				p256dh: subscription.keys.p256dh,
				auth: subscription.keys.auth
			},
			userAgent: req.headers.get('user-agent') || 'Unknown'
		});

		// Enable push notifications for user
		await User.findByIdAndUpdate(session.user.id, {
			pushNotificationsEnabled: true
		});

		return NextResponse.json({ success: true, message: 'Subscribed successfully' });
	} catch (error: unknown) {
		console.error('Error subscribing to push notifications:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to subscribe',
				details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
			},
			{ status: 500 }
		);
	}
}
