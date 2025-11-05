'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { NFLService } from '@/services/nflService';

// Calculate the default current week
const getDefaultWeek = (): number => {
	try {
		return NFLService.getCurrentWeek();
	} catch (error) {
		console.error('Error calculating current week, defaulting to 1:', error);
		return 1;
	}
};

const WeekContext = createContext<{
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
}>({
	currentWeek: getDefaultWeek(),
	setCurrentWeek: () => {}
});

export const useWeek = () => useContext(WeekContext);

export const WeekProvider = ({ children }: { children: React.ReactNode }) => {
	const [currentWeek, setCurrentWeek] = useState(getDefaultWeek());

	useEffect(() => {
		// Access `localStorage` only in the browser
		const storedWeek = localStorage.getItem('currentWeek');
		if (storedWeek) {
			const parsedWeek = parseInt(storedWeek, 10);
			setCurrentWeek(parsedWeek);
		} else {
			// If no stored week, set to current NFL week
			setCurrentWeek(getDefaultWeek());
		}
	}, []);

	useEffect(() => {
		// Sync `currentWeek` with `localStorage` whenever it changes
		localStorage.setItem('currentWeek', currentWeek.toString());
	}, [currentWeek]);

	return <WeekContext.Provider value={{ currentWeek, setCurrentWeek }}>{children}</WeekContext.Provider>;
};
