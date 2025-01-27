'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const LeagueContext = createContext<{
	leagueId: string | null;
	setLeagueId: (id: string) => void;
}>({
	leagueId: null,
	setLeagueId: () => {}
});

export const useLeague = () => useContext(LeagueContext);

export function LeagueProvider({ children }: { children: ReactNode }) {
	const [leagueId, setLeagueId] = useState<string | null>(null);
	const pathname = usePathname();

	useEffect(() => {
		// Extract leagueId from the URL (e.g., /league/[id])
		const match = pathname?.match(/\/league\/([^/]+)/);
		if (match) {
			const id = match[1];
			setLeagueId(id);
			console.log('[LeagueProvider] leagueId set:', id);
		}
	}, [pathname]);

	return <LeagueContext.Provider value={{ leagueId, setLeagueId }}>{children}</LeagueContext.Provider>;
}
