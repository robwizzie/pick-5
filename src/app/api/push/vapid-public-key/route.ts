import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
	const publicKey = process.env.VAPID_PUBLIC_KEY;

	if (!publicKey) {
		return NextResponse.json({ error: 'VAPID public key not configured' }, { status: 500 });
	}

	return NextResponse.json({ publicKey });
}
