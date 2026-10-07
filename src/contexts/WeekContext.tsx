'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { NFLService } from '@/services/nflService';

const MIN_WEEK = 1;
const MAX_WEEK = 18;
const WEEK_KEY = 'currentWeek';
const SEASON_KEY = 'currentSeason';

interface WeekContextType {
	/** The week the user is currently viewing */
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
	/** The live NFL week (null until resolved from ESPN) */
	liveWeek: number | null;
	season: number;
}

function seasonYear(now = new Date()) {
	// The NFL season starts in September; Jan–Aug belong to the previous season
	return now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
}

const WeekContext = createContext<WeekContextType>({
	currentWeek: 1,
	setCurrentWeek: () => {},
	liveWeek: null,
	season: seasonYear()
});

export const useWeek = () => useContext(WeekContext);

function readStoredWeek(season: number): number | null {
	try {
		if (Number(localStorage.getItem(SEASON_KEY)) !== season) return null;
		const week = Number(localStorage.getItem(WEEK_KEY));
		return week >= MIN_WEEK && week <= MAX_WEEK ? week : null;
	} catch {
		return null;
	}
}

function storeWeek(season: number, week: number) {
	try {
		localStorage.setItem(WEEK_KEY, String(week));
		localStorage.setItem(SEASON_KEY, String(season));
	} catch {
		// Storage unavailable (private mode) — the week just won't persist
	}
}

export const WeekProvider = ({ children }: { children: React.ReactNode }) => {
	const season = useMemo(() => seasonYear(), []);
	// Render immediately with a date-based estimate; refine once ESPN answers
	const [currentWeek, setWeek] = useState(() => NFLService.calculateCurrentWeek());
	const [liveWeek, setLiveWeek] = useState<number | null>(null);

	useEffect(() => {
		const stored = readStoredWeek(season);
		if (stored) setWeek(stored);

		let cancelled = false;
		NFLService.getCurrentWeek().then(nflWeek => {
			if (cancelled) return;
			const live = Math.min(MAX_WEEK, Math.max(MIN_WEEK, nflWeek));
			setLiveWeek(live);
			// Never leave someone parked on a week that's already behind the live one
			const week = Math.max(stored ?? live, live);
			setWeek(week);
			storeWeek(season, week);
		});
		return () => {
			cancelled = true;
		};
	}, [season]);

	const setCurrentWeek = useCallback(
		(week: number) => {
			if (week < MIN_WEEK || week > MAX_WEEK) return;
			setWeek(week);
			storeWeek(season, week);
		},
		[season]
	);

	const value = useMemo(() => ({ currentWeek, setCurrentWeek, liveWeek, season }), [currentWeek, setCurrentWeek, liveWeek, season]);

	return <WeekContext.Provider value={value}>{children}</WeekContext.Provider>;
};
