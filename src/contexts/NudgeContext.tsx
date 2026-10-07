'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useVisiblePolling } from '@/components/sweat/useSweat';
import type { NudgeStatus } from '@/lib/nudgeTypes';

const POLL_MS = 60_000;

interface NudgeContextValue {
	status: NudgeStatus | null;
	/** Nudge a league-mate; resolves true when sent */
	nudge: (userId: string, name: string) => Promise<boolean>;
	sending: string | null;
	refresh: () => void;
}

const NudgeCtx = createContext<NudgeContextValue>({ status: null, nudge: async () => false, sending: null, refresh: () => {} });

export const useNudges = () => useContext(NudgeCtx);

const DELIVERY_COPY = {
	push: 'They just got a notification.',
	email: 'They’ll get it by email.',
	'in-app': 'They’ll see it next time they open the league.'
} as const;

/** One shared picks-in / nudge state for a league page (leaderboard, H2H, survivor board and banner). */
export function NudgeProvider({ leagueId, children }: { leagueId: string; children: React.ReactNode }) {
	const [status, setStatus] = useState<NudgeStatus | null>(null);
	const [sending, setSending] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			const res = await fetch(`/api/league/${leagueId}/nudge`, { cache: 'no-store' });
			if (res.ok) setStatus(await res.json());
		} catch (error) {
			console.error('Error loading nudges:', error);
		}
	}, [leagueId]);

	useEffect(() => {
		setStatus(null);
		refresh();
		// Saving picks changes who still needs them
		window.addEventListener('refreshLeaderboard', refresh);
		return () => window.removeEventListener('refreshLeaderboard', refresh);
	}, [refresh]);
	useVisiblePolling(refresh, POLL_MS, true);

	const nudge = useCallback(
		async (userId: string, name: string) => {
			setSending(userId);
			try {
				const res = await fetch(`/api/league/${leagueId}/nudge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || 'Couldn’t send the nudge');
				toast.success(`👉 Nudged ${name.split(' ')[0]}`, { description: DELIVERY_COPY[data.delivered as keyof typeof DELIVERY_COPY] });
				return true;
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Couldn’t send the nudge');
				return false;
			} finally {
				setSending(null);
				refresh();
			}
		},
		[leagueId, refresh]
	);

	const value = useMemo(() => ({ status, nudge, sending, refresh }), [status, nudge, sending, refresh]);
	return <NudgeCtx.Provider value={value}>{children}</NudgeCtx.Provider>;
}
