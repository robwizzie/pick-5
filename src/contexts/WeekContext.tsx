'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NFLService } from '@/services/nflService';

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

	useEffect(() => {
		// Initialize with current NFL week or stored value
		const initializeWeek = async () => {
			if (typeof window !== 'undefined') {
				// Always fetch the actual current NFL week from the API
				const nflWeek = await NFLService.getCurrentWeek();

				const storedWeek = localStorage.getItem('currentWeek');
				const storedSeason = localStorage.getItem('currentSeason');

				// If user has a stored week from this season, use it (unless it's behind the current week)
				if (storedSeason && parseInt(storedSeason) === currentSeason && storedWeek) {
					const stored = parseInt(storedWeek, 10);
					// Use the greater of stored or actual current week (in case week advanced)
					const weekToUse = Math.max(stored, nflWeek);
					setCurrentWeek(weekToUse);
					localStorage.setItem('currentWeek', weekToUse.toString());
				} else {
					setCurrentWeek(nflWeek);
					localStorage.setItem('currentWeek', nflWeek.toString());
					localStorage.setItem('currentSeason', currentSeason.toString());
				}
				setIsInitialized(true);
			}
		};

		initializeWeek();
	}, [currentSeason]);

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
