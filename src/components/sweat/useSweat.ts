'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NFLService } from '@/services/nflService';
import { sweatPhase, type SweatResponse } from './sweatModel';

export const SWEAT_REFRESH_MS = 60_000;
/** A final game still counts as "today's action" for this long after kickoff */
const RECENT_FINAL_MS = 14 * 60 * 60 * 1000;

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Run `tick` every `ms` while `active` and the tab is visible; also run it as soon as the tab
 * becomes visible again (catch up after the phone was in a pocket).
 */
export function useVisiblePolling(tick: () => void, ms: number, active: boolean) {
	const tickRef = useRef(tick);
	useEffect(() => {
		tickRef.current = tick;
	});

	useEffect(() => {
		if (!active) return;
		const interval = setInterval(() => isVisible() && tickRef.current(), ms);
		const onVisibility = () => isVisible() && tickRef.current();
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [ms, active]);
}

export async function fetchSweat(leagueId: string, week: number): Promise<SweatResponse> {
	const res = await fetch(`/api/league/${leagueId}/sweat?week=${week}`, { cache: 'no-store' });
	if (!res.ok) throw new Error(`Sweat request failed: ${res.status}`);
	const data = (await res.json()) as Partial<SweatResponse> | null;
	// Treat a malformed body like a failed request so callers fall back instead of crashing
	if (!data?.me || !data.games || !Array.isArray(data.standings)) throw new Error('Unexpected sweat response');
	return data as SweatResponse;
}

/** The live sweat snapshot for a league/week; refreshes silently every minute while games are live. */
export function useSweat(leagueId: string, week: number) {
	const [data, setData] = useState<SweatResponse | null>(null);
	const [error, setError] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const requestId = useRef(0);

	const load = useCallback(async () => {
		const id = ++requestId.current;
		setRefreshing(true);
		try {
			const next = await fetchSweat(leagueId, week);
			if (id !== requestId.current) return;
			setData(next);
			setError(false);
		} catch (err) {
			if (id !== requestId.current) return;
			console.error('Failed to load live view:', err);
			// Keep showing the last good snapshot; only surface the error when there's nothing to show
			setError(true);
		} finally {
			if (id === requestId.current) setRefreshing(false);
		}
	}, [leagueId, week]);

	useEffect(() => {
		load();
	}, [load]);

	const current = data && data.week === week ? data : null;
	const kickoffAt = current?.nextKickoff ? Date.parse(current.nextKickoff) : null;
	// Keep polling while games are live, or once a kickoff is due but ESPN hasn't flipped it yet
	const sinceKickoff = kickoffAt !== null && current ? Date.parse(current.updatedAt) - kickoffAt : -1;
	const kickoffDue = sinceKickoff >= 0 && sinceKickoff < 3 * 60 * 60 * 1000;
	useVisiblePolling(load, SWEAT_REFRESH_MS, (current?.games.live ?? 0) > 0 || kickoffDue);

	// Between windows (e.g. after the late games, before SNF) wake up at the next kickoff
	useEffect(() => {
		if (kickoffAt === null || kickoffDue) return;
		const wait = kickoffAt - Date.now();
		if (wait < 0 || wait > 12 * 60 * 60 * 1000) return;
		const timer = setTimeout(load, wait + 15_000);
		return () => clearTimeout(timer);
	}, [kickoffAt, kickoffDue, load]);

	return { data: current, error: error && !current, refreshing, refresh: load };
}

export interface WeekLiveStatus {
	week: number;
	/** Games in progress right now */
	liveGames: number;
	/** Worth showing the live view: a game is in progress, finished recently, or the slate is mid-way */
	sweatable: boolean;
}

/** Whether a week's slate is live, from the (client-cached) scoreboard. Null until known. */
export function useWeekLiveStatus(week: number | null, pollMs = SWEAT_REFRESH_MS): WeekLiveStatus | null {
	const [status, setStatus] = useState<WeekLiveStatus | null>(null);

	const check = useCallback(async () => {
		if (!week) return;
		const games = await NFLService.getWeeklyGames(week);
		const phases = games.map(g => ({ phase: sweatPhase(g.status), kickoff: new Date(g.date).getTime() }));
		const liveGames = phases.filter(g => g.phase === 'in').length;
		const started = phases.some(g => g.phase !== 'pre');
		const allFinal = phases.length > 0 && phases.every(g => g.phase === 'post');
		const recentFinal = phases.some(g => g.phase === 'post' && Date.now() - g.kickoff < RECENT_FINAL_MS);
		setStatus({ week, liveGames, sweatable: liveGames > 0 || recentFinal || (started && !allFinal) });
	}, [week]);

	useEffect(() => {
		check();
	}, [check]);
	useVisiblePolling(check, pollMs, !!week);

	return status && status.week === week ? status : null;
}
