import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ADMIN_USER_ID = '67c124e9cce9530ce4c1a655';

/**
 * Check if the current user is an admin
 * Returns the session if admin, null otherwise
 */
export async function checkAdminAuth() {
	const session = await getServerSession(authOptions);

	if (!session?.user) {
		return null;
	}

	// @ts-ignore - session.user.id exists but TypeScript doesn't know about it
	if (session.user.id !== ADMIN_USER_ID) {
		return null;
	}

	return session;
}

/**
 * Check if a given user ID is an admin
 */
export function isAdmin(userId: string): boolean {
	return userId === ADMIN_USER_ID;
}
