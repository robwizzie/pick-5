// League types and per-league rules (pure: safe on client and server).

/** Pick 'em scoring modes, plus Survivor: one team a week, no repeats, last one standing wins. */
export type LeagueMode = 'standard' | 'steve' | 'survivor';

export const isSurvivorMode = (mode?: string | null) => mode === 'survivor';

/** Commissioner-controlled league settings. All optional; missing values use the defaults below. */
export interface LeagueSettings {
	/** Name of the season trophy, e.g. "The Golden Toilet" */
	trophyName?: string;
	/** What last place has to do, shown on the standings and the history page */
	lastPlacePunishment?: string;
	/** Points multiplier for a correct lock of the week; 1 turns locks off */
	lockMultiplier?: number;
	/** Steve mode only: whether the Total Final Score tiebreaker is played */
	tfsEnabled?: boolean;
}

/** What scoring needs to know about a league. */
export interface ScoringRules {
	mode: string;
	lockMultiplier: number;
	tfsEnabled: boolean;
}

export const DEFAULT_LOCK_MULTIPLIER = 2;
/** 1 = locks off */
export const LOCK_MULTIPLIER_OPTIONS = [1, 2, 3] as const;
export const TROPHY_NAME_MAX = 60;
export const PUNISHMENT_MAX = 200;

const validMultiplier = (value: unknown): value is number => LOCK_MULTIPLIER_OPTIONS.includes(value as (typeof LOCK_MULTIPLIER_OPTIONS)[number]);

/** Scoring rules from a league (or a bare mode string, which gets the default settings). */
export function rulesFor(league: string | { mode?: string | null; settings?: LeagueSettings | null } | ScoringRules | null | undefined): ScoringRules {
	if (league && typeof league === 'object' && 'lockMultiplier' in league && 'tfsEnabled' in league && typeof league.mode === 'string') return league;
	const mode = (typeof league === 'string' ? league : league?.mode) || 'standard';
	const settings = typeof league === 'object' && league && 'settings' in league ? league.settings : undefined;
	return {
		mode,
		lockMultiplier: validMultiplier(settings?.lockMultiplier) ? settings.lockMultiplier : DEFAULT_LOCK_MULTIPLIER,
		tfsEnabled: mode === 'steve' && settings?.tfsEnabled !== false
	};
}

export const locksEnabled = (rules: ScoringRules) => rules.lockMultiplier > 1;

/**
 * Validate a settings update from the commissioner. Returns the cleaned values to store, or an
 * error message. Only the keys present in `input` are returned.
 */
export function cleanSettings(input: unknown): { settings: LeagueSettings } | { error: string } {
	if (!input || typeof input !== 'object') return { error: 'Settings must be an object' };
	const raw = input as Record<string, unknown>;
	const settings: LeagueSettings = {};

	for (const [key, max] of [
		['trophyName', TROPHY_NAME_MAX],
		['lastPlacePunishment', PUNISHMENT_MAX]
	] as const) {
		if (raw[key] === undefined) continue;
		if (typeof raw[key] !== 'string') return { error: `${key} must be text` };
		const value = (raw[key] as string).trim();
		if (value.length > max) return { error: `${key === 'trophyName' ? 'Trophy name' : 'Punishment'} is too long (max ${max} characters)` };
		settings[key] = value;
	}
	if (raw.lockMultiplier !== undefined) {
		if (!validMultiplier(raw.lockMultiplier)) return { error: 'Lock multiplier must be 1 (off), 2 or 3' };
		settings.lockMultiplier = raw.lockMultiplier;
	}
	if (raw.tfsEnabled !== undefined) {
		if (typeof raw.tfsEnabled !== 'boolean') return { error: 'tfsEnabled must be true or false' };
		settings.tfsEnabled = raw.tfsEnabled;
	}
	return { settings };
}
