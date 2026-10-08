'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { NFLService } from '@/services/nflService';
import { getCurrentSeasonYear, resolveSeasonWeeks, type SeasonWeeks } from '@/lib/seasonYear';

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
	/** The first week that counts in the viewed season */
	startWeek: number;
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
	...resolveSeasonWeeks(getCurrentSeasonYear())
});

export const useWeek = () => useContext(WeekContext);

const clampWeek = (week: number, { startWeek, finalWeek }: SeasonWeeks) => Math.min(finalWeek, Math.max(startWeek, week));

function readStoredWeek(season: number, weeks: SeasonWeeks): number | null {
	try {
		if (Number(localStorage.getItem(SEASON_KEY)) !== season) return null;
		const week = Number(localStorage.getItem(WEEK_KEY));
		return week >= weeks.startWeek && week <= weeks.finalWeek ? week : null;
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
	// Each season's counted weeks: built-in defaults until the server's settings arrive
	const [weeksBySeason, setWeeksBySeason] = useState<Record<number, SeasonWeeks>>({});
	const weeksFor = useCallback((year: number) => weeksBySeason[year] ?? resolveSeasonWeeks(year), [weeksBySeason]);
	const currentWeeks = weeksFor(currentSeason);
	// Render immediately with a date-based estimate; refine once ESPN answers
	const [currentWeek, setWeek] = useState(() => clampWeek(NFLService.calculateCurrentWeek(), resolveSeasonWeeks(currentSeason)));
	const [nflWeek, setNflWeek] = useState<number | null>(null);
	const [season, setViewedSeason] = useState(currentSeason);
	const isPastSeason = season !== currentSeason;
	const { startWeek, finalWeek } = weeksFor(season);
	// The live week, kept within the current season's counted weeks
	const liveWeek = nflWeek === null ? null : clampWeek(nflWeek, currentWeeks);
	const seasonRef = useRef(season);
	seasonRef.current = season;
	// A past season opens on its final week once that season's weeks are known
	const jumpToFinalRef = useRef<number | null>(null);

	// Load the counted weeks of the current and the viewed season (once each)
	const requestedRef = useRef(new Set<number>());
	useEffect(() => {
		for (const year of [currentSeason, season]) {
			if (requestedRef.current.has(year)) continue;
			requestedRef.current.add(year);
			fetch(`/api/season/weeks?season=${year}`)
				.then(res => (res.ok ? res.json() : null))
				.then((data: SeasonWeeks | null) => {
					if (data) setWeeksBySeason(prev => ({ ...prev, [year]: resolveSeasonWeeks(year, data) }));
				})
				.catch(error => console.error('Error loading season weeks:', error));
		}
	}, [currentSeason, season]);

	useEffect(() => {
		let cancelled = false;
		NFLService.getCurrentWeek().then(week => {
			if (!cancelled) setNflWeek(week);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Once the live week is known, open the current season on it (or a later remembered week)
	const placedRef = useRef(false);
	useEffect(() => {
		if (liveWeek === null || placedRef.current) return;
		placedRef.current = true;
		const stored = readStoredWeek(currentSeason, currentWeeks);
		// Never leave someone parked on a week that's already behind the live one
		const week = Math.max(stored ?? liveWeek, liveWeek);
		// Don't move someone who is already browsing a past season
		if (seasonRef.current === currentSeason) setWeek(week);
		storeWeek(currentSeason, week);
	}, [liveWeek, currentSeason, currentWeeks]);

	// Keep the viewed week inside the viewed season's weeks (they can arrive or change after render)
	useEffect(() => {
		if (jumpToFinalRef.current === season && weeksBySeason[season]) {
			jumpToFinalRef.current = null;
			setWeek(finalWeek);
			return;
		}
		setWeek(week => clampWeek(week, { startWeek, finalWeek }));
	}, [season, startWeek, finalWeek, weeksBySeason]);

	const setCurrentWeek = useCallback(
		(week: number) => {
			if (week < startWeek || week > finalWeek) return;
			setWeek(week);
			// Only the current season's week is remembered between visits
			if (!isPastSeason) storeWeek(season, week);
		},
		[season, isPastSeason, startWeek, finalWeek]
	);

	const setSeason = useCallback(
		(next: number) => {
			if (next === season || next > currentSeason) return;
			setViewedSeason(next);
			if (next === currentSeason) {
				// Back to this season: return to the remembered (or live) week
				jumpToFinalRef.current = null;
				setWeek(readStoredWeek(currentSeason, currentWeeks) ?? liveWeek ?? clampWeek(NFLService.calculateCurrentWeek(), currentWeeks));
			} else {
				// A past season opens on its final week (the end-of-season standings)
				jumpToFinalRef.current = next;
				setWeek(weeksFor(next).finalWeek);
			}
		},
		[season, currentSeason, currentWeeks, liveWeek, weeksFor]
	);

	const value = useMemo(
		() => ({ currentWeek, setCurrentWeek, liveWeek, season, setSeason, currentSeason, isPastSeason, startWeek, finalWeek }),
		[currentWeek, setCurrentWeek, liveWeek, season, setSeason, currentSeason, isPastSeason, startWeek, finalWeek]
	);

	return <WeekContext.Provider value={value}>{children}</WeekContext.Provider>;
};
