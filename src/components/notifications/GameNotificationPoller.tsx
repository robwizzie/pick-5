'use client';

import { useGameNotificationPolling } from '@/hooks/useGameNotificationPolling';

/**
 * Client component that polls for game completions during game windows
 * Provides near-real-time notifications when users have the app open
 */
export function GameNotificationPoller() {
	useGameNotificationPolling();
	return null; // This component doesn't render anything
}
