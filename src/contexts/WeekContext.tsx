'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const WeekContext = createContext<{
	currentWeek: number;
	setCurrentWeek: (week: number) => void;
}>({
	currentWeek: 10, // Default to Week 10
	setCurrentWeek: () => {}
});

export const useWeek = () => useContext(WeekContext);

export const WeekProvider = ({ children }: { children: React.ReactNode }) => {
	const [currentWeek, setCurrentWeek] = useState(10); // Default value

	useEffect(() => {
		// Access `localStorage` only in the browser
		const storedWeek = localStorage.getItem('currentWeek');
		if (storedWeek) {
			setCurrentWeek(parseInt(storedWeek, 10));
		}
	}, []);

	useEffect(() => {
		// Sync `currentWeek` with `localStorage` whenever it changes
		localStorage.setItem('currentWeek', currentWeek.toString());
	}, [currentWeek]);

	return <WeekContext.Provider value={{ currentWeek, setCurrentWeek }}>{children}</WeekContext.Provider>;
};
