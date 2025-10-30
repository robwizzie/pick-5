'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface WeekContextType {
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
	season: number;
}

const WeekContext = createContext<WeekContextType>({
	currentWeek: 1,
	setCurrentWeek: () => {},
	season: 2024
});

export const useWeek = () => useContext(WeekContext);

export const WeekProvider = ({ children }: { children: React.ReactNode }) => {
	// Default to current NFL season and week
	const currentSeason = 2024;
	const [currentWeek, setCurrentWeek] = useState(1);
	const [isInitialized, setIsInitialized] = useState(false);

	// Get current NFL week based on date
	const getCurrentNFLWeek = useCallback(() => {
		const now = new Date();
		const seasonStart = new Date(currentSeason, 8, 5); // September 5th
		const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
		return Math.max(1, Math.min(18, weeksSinceStart + 1));
	}, [currentSeason]);

	useEffect(() => {
		// Initialize with current NFL week or stored value
		if (typeof window !== 'undefined') {
			const storedWeek = localStorage.getItem('currentWeek');
			const storedSeason = localStorage.getItem('currentSeason');
			
			if (storedSeason && parseInt(storedSeason) === currentSeason && storedWeek) {
				setCurrentWeek(parseInt(storedWeek, 10));
			} else {
				const nflWeek = getCurrentNFLWeek();
				setCurrentWeek(nflWeek);
				localStorage.setItem('currentWeek', nflWeek.toString());
				localStorage.setItem('currentSeason', currentSeason.toString());
			}
			setIsInitialized(true);
		}
	}, [getCurrentNFLWeek, currentSeason]);

	const handleSetCurrentWeek = useCallback((week: number) => {
		if (week >= 1 && week <= 18) {
			setCurrentWeek(week);
			if (typeof window !== 'undefined') {
				localStorage.setItem('currentWeek', week.toString());
			}
		}
	}, []);

	// Don't render until initialized to prevent hydration mismatch
	if (!isInitialized) {
		return null;
	}

	return (
		<WeekContext.Provider 
			value={{ 
				currentWeek, 
				setCurrentWeek: handleSetCurrentWeek,
				season: currentSeason
			}}
		>
			{children}
		</WeekContext.Provider>
	);
};
