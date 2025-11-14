import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Determines if current time is within NFL game windows
 * Returns true during times when games are likely in progress or recently finished
 */
function isGameWindow(): boolean {
	const now = new Date();
	const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
	const utcHour = now.getUTCHours();

	// Thursday Night Football window
	// Game starts ~8:20pm ET (00:20 UTC Friday), ends ~11:30pm ET (03:30 UTC Friday)
	// Poll from Thursday 11pm UTC through Friday 6am UTC
	if (utcDay === 4 && utcHour >= 23) {
		return true; // Thursday 11pm UTC onwards
	}
	if (utcDay === 5 && utcHour <= 6) {
		return true; // Friday midnight-6am UTC (TNF ending)
	}

	// Saturday games (when they occur, late season)
	// Similar to Sunday window
	if (utcDay === 6 && utcHour >= 17) {
		return true; // Saturday 5pm UTC onwards
	}

	// Sunday games window
	// Early games start 1pm ET (18:00 UTC), late game ends ~11:30pm ET (04:30 UTC Monday)
	// Poll from Sunday 5pm UTC through Monday 6am UTC
	if (utcDay === 0 && utcHour >= 17) {
		return true; // Sunday 5pm UTC onwards
	}
	if (utcDay === 1 && utcHour <= 6) {
		return true; // Monday midnight-6am UTC (SNF ending)
	}

	// Monday Night Football window
	// Game starts ~8:15pm ET Monday (00:15 UTC Tuesday), ends ~11:30pm ET (03:30 UTC Tuesday)
	// Poll from Monday 11pm UTC through Tuesday 6am UTC
	if (utcDay === 1 && utcHour >= 23) {
		return true; // Monday 11pm UTC onwards
	}
	if (utcDay === 2 && utcHour <= 6) {
		return true; // Tuesday midnight-6am UTC (MNF ending)
	}

	return false;
}

/**
 * Hook to poll for game completions during game windows
 * Only runs when user is authenticated and during NFL game times
 * Checks every 5 minutes for completed games
 */
export function useGameNotificationPolling() {
	const { data: session, status } = useSession();
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const lastCheckRef = useRef<number>(0);

	useEffect(() => {
		// Only run if user is authenticated
		if (status !== 'authenticated' || !session?.user) {
			return;
		}

		const pollForCompletedGames = async () => {
			// Only poll during game windows
			if (!isGameWindow()) {
				return;
			}

			// Prevent duplicate checks within 1 minute
			const now = Date.now();
			if (now - lastCheckRef.current < 60000) {
				return;
			}

			lastCheckRef.current = now;

			try {
				const response = await fetch('/api/notifications/check-games');
				const data = await response.json();

				if (data.notificationsSent > 0) {
					console.log(`[Game Polling] Sent ${data.notificationsSent} notifications`);
				}
			} catch (error) {
				console.error('[Game Polling] Error checking for completed games:', error);
			}
		};

		// Check immediately on mount if in game window
		pollForCompletedGames();

		// Set up polling interval (every 5 minutes)
		intervalRef.current = setInterval(pollForCompletedGames, 5 * 60 * 1000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [session, status]);
}
