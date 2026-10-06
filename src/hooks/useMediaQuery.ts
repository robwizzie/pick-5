'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query. Returns `null` until mounted so callers can avoid
 * rendering (and fetching for) a layout that may not be the one shown.
 */
export function useMediaQuery(query: string): boolean | null {
	const [matches, setMatches] = useState<boolean | null>(null);

	useEffect(() => {
		const mql = window.matchMedia(query);
		const update = () => setMatches(mql.matches);
		update();
		mql.addEventListener('change', update);
		return () => mql.removeEventListener('change', update);
	}, [query]);

	return matches;
}
