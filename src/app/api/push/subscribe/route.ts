import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { PushSubscription } from '@/models/PushSubscription';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

interface SubscriptionBody {
	endpoint?: unknown;
	keys?: { p256dh?: unknown; auth?: unknown };
}

export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const subscription = (await req.json().catch(() => null)) as SubscriptionBody | null;
		const endpoint = subscription?.endpoint;
		const p256dh = subscription?.keys?.p256dh;
		const auth = subscription?.keys?.auth;
		if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
			return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
		}

		await connectDB();

		// Upsert by endpoint: a browser re-subscribing (possibly as another user, or with
		// rotated keys) updates its existing record instead of failing on the unique index.
		await PushSubscription.updateOne(
			{ endpoint },
			{
				$set: { userId: session.user.id, keys: { p256dh, auth }, userAgent: req.headers.get('user-agent') || 'Unknown' },
				$setOnInsert: { createdAt: new Date() }
			},
			{ upsert: true }
		);

		// Always (re-)enable: re-enabling push in settings reuses the browser's existing
		// subscription, and the flag must follow or nothing would be delivered.
		await User.updateOne({ _id: session.user.id }, { $set: { pushNotificationsEnabled: true } });

		return NextResponse.json({ success: true, message: 'Subscribed successfully' });
	} catch (error: unknown) {
		console.error('Error subscribing to push notifications:', error);
		return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
	}
}
