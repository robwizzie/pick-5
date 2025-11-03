'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NFLService } from '@/services/nflService';

interface WeekContextType {
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
	season: number;
	currentNFLWeek: number;
}

const WeekContext = createContext<WeekContextType>({
	currentWeek: 1,
	setCurrentWeek: () => {},
	season: 2024,
	currentNFLWeek: 1
});

export const useWeek = () => useContext(WeekContext);

export const WeekProvider = ({ children }: { children: React.ReactNode }) => {
	// Default to current NFL season and week
	const currentSeason = 2024;
	const [currentWeek, setCurrentWeek] = useState(1);
	const [currentNFLWeek, setCurrentNFLWeek] = useState(1);
	const [isInitialized, setIsInitialized] = useState(false);

	useEffect(() => {
		// Initialize with current NFL week or stored value
		if (typeof window !== 'undefined') {
			// Always calculate the actual current NFL week
			const nflWeek = NFLService.calculateCurrentWeek();
			setCurrentNFLWeek(nflWeek);
			
			const storedWeek = localStorage.getItem('currentWeek');
			const storedSeason = localStorage.getItem('currentSeason');
			
			if (storedSeason && parseInt(storedSeason) === currentSeason && storedWeek) {
				setCurrentWeek(parseInt(storedWeek, 10));
			} else {
				setCurrentWeek(nflWeek);
				localStorage.setItem('currentWeek', nflWeek.toString());
				localStorage.setItem('currentSeason', currentSeason.toString());
			}
			setIsInitialized(true);
		}
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
				season: currentSeason,
				currentNFLWeek
			}}
		>
			{children}
		</WeekContext.Provider>
	);
};
