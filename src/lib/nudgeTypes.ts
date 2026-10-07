// Nudges: shared types (pure: safe on client and server).

/** GET /api/league/[id]/nudge */
export interface NudgeStatus {
	season: number;
	/** The week nudges are for (the week being played now) */
	week: number;
	/** Whether picks can still be made this week (enough games haven't kicked off) */
	open: boolean;
	/** Members who have their picks in this week (survivor: a pick, or already out) */
	pickedIn: string[];
	/** userId -> who nudged them this week */
	nudged: Record<string, { fromUserId: string; fromName: string; at: string }>;
	/** Members the viewer can nudge right now */
	canNudge: string[];
	/** The viewer's own nudge this week, while their picks are still missing */
	mine: { fromName: string; at: string } | null;
}
