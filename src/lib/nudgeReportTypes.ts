// Nudge report: shared types (pure: safe on client and server).

export interface NudgeReportRow {
	label: string;
	/** Players in this group */
	count: number;
	/** Opened the league from the nudge itself (only tracked for newer nudges) */
	opened: number;
	/** Went on to make that week's picks */
	picked: number;
	pickRate: number | null;
	/** From the nudge (or, for players not nudged, the league's first nudge that week) to their first picks */
	medianHoursToPick: number | null;
}

/** GET /api/admin/nudge-report?season= */
export interface NudgeReport {
	season: number;
	overall: NudgeReportRow;
	/** Where the nudge reached them */
	byChannel: NudgeReportRow[];
	/** Pick 'em leagues only: nudged players vs. league-mates also missing picks at the time who weren't nudged */
	comparison: { nudged: NudgeReportRow; notNudged: NudgeReportRow };
	/** Pick times taken from a pick 'em pick's last edit (picks from before first-submission tracking): upper bounds */
	estimatedPickTimes: number;
}
