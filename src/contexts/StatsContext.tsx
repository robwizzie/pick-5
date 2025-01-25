// src/contexts/StatsContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WeeklyStats {
	weeklyPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
}

interface Stats {
	weeklyStats: Record<string, WeeklyStats>;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	totalTFSPoints: number;
}

interface StatsContextType extends Stats {
	isLoading: boolean;
	refreshStats: () => Promise<void>;
}

const StatsContext = createContext<StatsContextType>(null!);

export function StatsProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const [stats, setStats] = useState<Stats>({
		weeklyStats: {},
		totalPoints: 0,
		correctPicks: 0,
		totalPicks: 0,
		totalTFSPoints: 0
	});
	const [isLoading, setIsLoading] = useState(true);

	const refreshStats = useCallback(async () => {
		if (!session?.user) return;

		try {
			setIsLoading(true);
			const response = await fetch('/api/stats');
			if (!response.ok) throw new Error('Failed to fetch stats');
			const data = await response.json();
			setStats(data);
		} catch (error) {
			console.error('Error fetching stats:', error);
		} finally {
			setIsLoading(false);
		}
	}, [session]);

	useEffect(() => {
		refreshStats();
	}, [refreshStats]);

	return <StatsContext.Provider value={{ ...stats, isLoading, refreshStats }}>{children}</StatsContext.Provider>;
}

export const useStats = () => useContext(StatsContext);
