// src/app/api/user/profile/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();

		const user = await User.findById(session.user.id);
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({
			name: user.name,
			email: user.email,
			image: user.image
		});
	} catch (error) {
		console.error('Error fetching user profile:', error);
		return NextResponse.json({ error: 'Error fetching profile' }, { status: 500 });
	}
}

export async function PATCH(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { name, image } = body;

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return NextResponse.json({ error: 'Name is required' }, { status: 400 });
		}

		await connectDB();

		const updateData: { name: string; image?: string; updatedAt: Date } = {
			name: name.trim(),
			updatedAt: new Date()
		};

		// Only update image if provided and valid
		if (image && typeof image === 'string' && image.trim().length > 0) {
			updateData.image = image.trim();
		}

		const user = await User.findByIdAndUpdate(
			session.user.id,
			updateData,
			{ new: true }
		);

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({
			name: user.name,
			email: user.email,
			image: user.image,
			message: 'Profile updated successfully'
		});
	} catch (error) {
		console.error('Error updating user profile:', error);
		return NextResponse.json({ error: 'Error updating profile' }, { status: 500 });
	}
}
