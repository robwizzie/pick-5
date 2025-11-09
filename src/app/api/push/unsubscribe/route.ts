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

		const { endpoint } = await req.json();

		if (!endpoint) {
			return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
		}

		await connectDB();

		// Remove the subscription
		await PushSubscription.deleteOne({
			userId: session.user.id,
			endpoint
		});

		// Check if user has any remaining subscriptions
		const remainingSubscriptions = await PushSubscription.countDocuments({
			userId: session.user.id
		});

		// If no subscriptions left, disable push notifications
		if (remainingSubscriptions === 0) {
			await User.findByIdAndUpdate(session.user.id, {
				pushNotificationsEnabled: false
			});
		}

		return NextResponse.json({ success: true, message: 'Unsubscribed successfully' });
	} catch (error: unknown) {
		console.error('Error unsubscribing from push notifications:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				error: 'Failed to unsubscribe',
				details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
			},
			{ status: 500 }
		);
	}
}
