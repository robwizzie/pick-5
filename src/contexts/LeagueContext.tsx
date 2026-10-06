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

// /league/<segment> routes that are pages, not league ids
const RESERVED_SEGMENTS = new Set(['create', 'join', 'browse']);

export function LeagueProvider({ children }: { children: ReactNode }) {
	const [leagueId, setLeagueId] = useState<string | null>(null);
	const pathname = usePathname();

	useEffect(() => {
		const segment = pathname?.match(/^\/league\/([^/]+)/)?.[1];
		if (segment && !RESERVED_SEGMENTS.has(segment)) {
			setLeagueId(segment);
		}
	}, [pathname]);

	return <LeagueContext.Provider value={{ leagueId, setLeagueId }}>{children}</LeagueContext.Provider>;
}
