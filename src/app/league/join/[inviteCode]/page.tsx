import type { Metadata } from 'next';
import { cache } from 'react';
import { connectDB } from '@/lib/db';
import { League } from '@/models/League';
import JoinInviteClient, { type InvitePreview } from './JoinInviteClient';

type Params = { params: Promise<{ inviteCode: string }> };

// Shared by generateMetadata and the page within one request
const getInvitePreview = cache(async (inviteCode: string): Promise<InvitePreview | null> => {
	try {
		await connectDB();
		const league = await League.findOne({ inviteCode }, 'name mode members').lean<{ name: string; mode?: string; members?: string[] }>();
		return league ? { name: league.name, mode: league.mode || 'standard', members: league.members?.length ?? 0 } : null;
	} catch (error) {
		console.error('Error loading invite preview:', error);
		return null;
	}
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
	const { inviteCode } = await params;
	const league = await getInvitePreview(inviteCode);
	if (!league) return { title: 'League invitation', robots: { index: false, follow: false } };

	const title = `You're invited to ${league.name}`;
	const description = `Join ${league.name} on Pick 5${league.members > 1 ? ` with ${league.members} players` : ''}. Pick five NFL games a week, back the underdogs, and beat your friends. Free to play.`;
	const image = { url: '/og-image.jpg', width: 1200, height: 630, alt: `Pick 5 — join ${league.name}` };

	return {
		title,
		description,
		// Invite codes are secrets: never index these pages
		robots: { index: false, follow: false },
		openGraph: { type: 'website', siteName: 'Pick 5', title: `${title} 🏈`, description, url: `/league/join/${inviteCode}`, images: [image] },
		twitter: { card: 'summary_large_image', title: `${title} 🏈`, description, images: [image] }
	};
}

export default async function JoinInvitePage({ params }: Params) {
	const { inviteCode } = await params;
	return <JoinInviteClient preview={await getInvitePreview(inviteCode)} />;
}
