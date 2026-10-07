// src/services/scoringService.ts
interface GameResult {
	id: string;
	homeScore: number | undefined;
	awayScore: number | undefined;
	homeTeam: string;
	awayTeam: string;
	status?: string; // Game status: 'pre', 'in', 'post'
}

/** A correct "lock of the week" pick is worth this many times its normal points. */
export const LOCK_MULTIPLIER = 2;

export class ScoringService {
	/**
	 * Points for a single correct pick: odds-based in Standard mode (2 when no odds were
	 * stored), 2 in Steve mode, doubled when it's the player's lock of the week.
	 */
	static pointsForPick(
		pick: { odds?: number },
		leagueMode: string,
		calculatePointsFromOdds?: (odds: number) => number,
		isLock = false
	): number {
		const base = leagueMode === 'standard' && pick.odds !== undefined && pick.odds !== null && calculatePointsFromOdds ? calculatePointsFromOdds(pick.odds) : 2;
		return isLock ? base * LOCK_MULTIPLIER : base;
	}

	static calculatePickResult(
		pick: {
			gameId: string;
			team: string;
			isHome: boolean;
		},
		gameResult: GameResult
	) {
		// Type guard: scores must be defined at this point
		if (gameResult.homeScore === undefined || gameResult.awayScore === undefined) {
			return false;
		}

		// Ties are losses for both teams
		if (gameResult.homeScore === gameResult.awayScore) {
			return false;
		}

		const homeWon = gameResult.homeScore > gameResult.awayScore;
		const pickedHome = pick.team === gameResult.homeTeam;

		return (pickedHome && homeWon) || (!pickedHome && !homeWon);
	}

	static calculateTFSPoints(predictedScore: number, actualScore: number): number {
		const difference = Math.abs(predictedScore - actualScore);
		if (difference === 0) return 5;
		if (difference <= 3) return 4;
		if (difference <= 5) return 3;
		if (difference <= 7) return 2;
		if (difference <= 10) return 1;
		return 0;
	}

	/**
	 * Check if a game has actually finished (not in progress)
	 * Only count games with status 'post' or 'final' as completed
	 */
	private static isGameFinished(gameResult: GameResult): boolean {
		// Game is finished ONLY if status is 'post' or 'final'
		// Do NOT check scores - in-progress games have scores but aren't finished
		return gameResult.status === 'post' || gameResult.status === 'final';
	}

	/**
	 * Calculate week score - only scores games that have finished (status='post' or 'final')
	 * Returns completedGames count for accurate win percentage calculation
	 * tfsGame and tfsScore can be null for Standard mode leagues
	 * leagueMode determines scoring: 'steve' = 2 pts per win, 'standard' = odds-based points
	 * lockGameId (optional) is the player's lock of the week: that pick scores double if correct
	 */
	static calculateWeekScore(
		picks: { gameId: string; team: string; isHome: boolean; odds?: number }[],
		gameResults: GameResult[],
		tfsGame: string | null,
		tfsScore: number | null,
		leagueMode: string = 'steve',
		calculatePointsFromOdds?: (odds: number) => number,
		lockGameId?: string | null
	) {
		let weeklyPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;
		let completedGames = 0; // Track how many games have actually finished

		// Score regular picks - only score games that have finished
		const scoredPicks = picks.map(pick => {
			const gameResult = gameResults.find(g => g.id === pick.gameId);
			const isLock = !!lockGameId && pick.gameId === lockGameId;
			if (!gameResult) {
				return { ...pick, isCorrect: null, isLock, points: 0 };
			}

			// Only score if game has finished (status='post')
			const gameFinished = this.isGameFinished(gameResult);

			if (!gameFinished) {
				return { ...pick, isCorrect: null, isLock, points: 0 };
			}

			completedGames++; // Count this as a completed game

			const isCorrect = this.calculatePickResult(pick, gameResult);
			const points = isCorrect ? this.pointsForPick(pick, leagueMode, calculatePointsFromOdds, isLock) : 0;
			if (isCorrect) {
				weeklyPoints += points;
				correctPicks++;
			}

			return { ...pick, isCorrect, isLock, points };
		});

		// Score TFS if applicable - only if game has finished and TFS is provided (Steve mode only)
		if (tfsGame && tfsScore !== null) {
			const tfsGameResult = gameResults.find(g => g.id === tfsGame);
			if (tfsGameResult) {
				// Only score TFS if game has finished (status='post')
				const tfsGameFinished = this.isGameFinished(tfsGameResult);

				if (tfsGameFinished && tfsGameResult.homeScore !== undefined && tfsGameResult.awayScore !== undefined) {
					const actualScore = tfsGameResult.homeScore + tfsGameResult.awayScore;
					tfsPoints = this.calculateTFSPoints(tfsScore, actualScore);
					weeklyPoints += tfsPoints;
				}
			}
		}

		return {
			scoredPicks,
			weeklyPoints,
			correctPicks,
			tfsPoints,
			completedGames // Return count of games that were actually scored
		};
	}
}
