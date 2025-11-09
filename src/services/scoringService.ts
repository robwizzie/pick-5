// src/services/scoringService.ts
interface GameResult {
	id: string;
	homeScore: number | undefined;
	awayScore: number | undefined;
	homeTeam: string;
	awayTeam: string;
	status?: string; // Game status: 'pre', 'in', 'post'
}

export class ScoringService {
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
	 * Only count games with status 'post' as completed
	 */
	private static isGameFinished(gameResult: GameResult): boolean {
		// Prefer using status field if available
		if (gameResult.status) {
			// Only count games with status 'post' as finished
			// 'pre' = not started, 'in' = in progress, 'post' = completed
			return gameResult.status === 'post';
		}

		// Fallback: check if both scores are present and at least one is > 0
		// This is less reliable as games in progress will also meet this criteria
		return (
			typeof gameResult.homeScore === 'number' &&
			typeof gameResult.awayScore === 'number' &&
			gameResult.homeScore !== undefined &&
			gameResult.awayScore !== undefined &&
			(gameResult.homeScore > 0 || gameResult.awayScore > 0)
		);
	}

	/**
	 * Calculate week score - only scores games that have finished (status='post')
	 * Returns completedGames count for accurate win percentage calculation
	 * tfsGame and tfsScore can be null for Standard mode leagues
	 */
	static calculateWeekScore(picks: { gameId: string; team: string; isHome: boolean }[], gameResults: GameResult[], tfsGame: string | null, tfsScore: number | null) {
		let weeklyPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;
		let completedGames = 0; // Track how many games have actually finished

		// Score regular picks - only score games that have finished
		const scoredPicks = picks.map(pick => {
			const gameResult = gameResults.find(g => g.id === pick.gameId);
			if (!gameResult) {
				return { ...pick, isCorrect: null };
			}

			// Only score if game has finished (status='post')
			const gameFinished = this.isGameFinished(gameResult);

			if (!gameFinished) {
				return { ...pick, isCorrect: null };
			}

			completedGames++; // Count this as a completed game

			const isCorrect = this.calculatePickResult(pick, gameResult);
			if (isCorrect) {
				weeklyPoints += 2;
				correctPicks++;
			}

			return { ...pick, isCorrect };
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
