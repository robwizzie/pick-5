'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { NFLService } from '@/services/nflService';
import { getCurrentSeasonYear, getSeasonFinalWeek } from '@/lib/seasonYear';

const MIN_WEEK = 1;
const WEEK_KEY = 'currentWeek';
const SEASON_KEY = 'currentSeason';

interface WeekContextType {
	/** The week the user is currently viewing */
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
	/** The live NFL week of the current season (null until resolved from ESPN) */
	liveWeek: number | null;
	/** The season the user is viewing (the current season unless they picked a past one) */
	season: number;
	setSeason: (season: number) => void;
	/** The current NFL season */
	currentSeason: number;
	/** Viewing a past season: read-only, nothing is live */
	isPastSeason: boolean;
	/** The last week that counts in the viewed season */
	finalWeek: number;
}

const WeekContext = createContext<WeekContextType>({
	currentWeek: 1,
	setCurrentWeek: () => {},
	liveWeek: null,
	season: getCurrentSeasonYear(),
	setSeason: () => {},
	currentSeason: getCurrentSeasonYear(),
	isPastSeason: false,
	finalWeek: getSeasonFinalWeek(getCurrentSeasonYear())
});

export const useWeek = () => useContext(WeekContext);

function readStoredWeek(season: number): number | null {
	try {
		if (Number(localStorage.getItem(SEASON_KEY)) !== season) return null;
		const week = Number(localStorage.getItem(WEEK_KEY));
		return week >= MIN_WEEK && week <= getSeasonFinalWeek(season) ? week : null;
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
	const currentSeason = useMemo(() => getCurrentSeasonYear(), []);
	const currentFinalWeek = getSeasonFinalWeek(currentSeason);
	// Render immediately with a date-based estimate; refine once ESPN answers
	const [currentWeek, setWeek] = useState(() => Math.min(currentFinalWeek, NFLService.calculateCurrentWeek()));
	const [liveWeek, setLiveWeek] = useState<number | null>(null);
	const [season, setViewedSeason] = useState(currentSeason);
	const isPastSeason = season !== currentSeason;
	const finalWeek = getSeasonFinalWeek(season);
	const seasonRef = useRef(season);
	seasonRef.current = season;

	useEffect(() => {
		const stored = readStoredWeek(currentSeason);
		if (stored) setWeek(stored);

		let cancelled = false;
		NFLService.getCurrentWeek().then(nflWeek => {
			if (cancelled) return;
			const live = Math.min(currentFinalWeek, Math.max(MIN_WEEK, nflWeek));
			setLiveWeek(live);
			// Never leave someone parked on a week that's already behind the live one
			const week = Math.max(stored ?? live, live);
			// Don't move someone who is already browsing a past season
			if (seasonRef.current === currentSeason) setWeek(week);
			storeWeek(currentSeason, week);
		});
		return () => {
			cancelled = true;
		};
	}, [currentSeason, currentFinalWeek]);

	const setCurrentWeek = useCallback(
		(week: number) => {
			if (week < MIN_WEEK || week > finalWeek) return;
			setWeek(week);
			// Only the current season's week is remembered between visits
			if (!isPastSeason) storeWeek(season, week);
		},
		[season, isPastSeason, finalWeek]
	);

	const setSeason = useCallback(
		(next: number) => {
			if (next === season || next > currentSeason) return;
			setViewedSeason(next);
			if (next === currentSeason) {
				// Back to this season: return to the remembered (or live) week
				setWeek(readStoredWeek(currentSeason) ?? liveWeek ?? Math.min(currentFinalWeek, NFLService.calculateCurrentWeek()));
			} else {
				// A past season opens on its final week (the end-of-season standings)
				setWeek(getSeasonFinalWeek(next));
			}
		},
		[season, currentSeason, currentFinalWeek, liveWeek]
	);

	const value = useMemo(
		() => ({ currentWeek, setCurrentWeek, liveWeek, season, setSeason, currentSeason, isPastSeason, finalWeek }),
		[currentWeek, setCurrentWeek, liveWeek, season, setSeason, currentSeason, isPastSeason, finalWeek]
	);

	return <WeekContext.Provider value={value}>{children}</WeekContext.Provider>;
};
