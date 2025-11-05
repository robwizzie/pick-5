// src/services/scoringService.ts
interface GameResult {
	id: string;
	homeScore: number;
	awayScore: number;
	homeTeam: string;
	awayTeam: string;
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
	 * Calculate week score - only scores games that have finished (have both scores)
	 */
	static calculateWeekScore(picks: { gameId: string; team: string; isHome: boolean }[], gameResults: GameResult[], tfsGame: string, tfsScore: number) {
		let weeklyPoints = 0;
		let correctPicks = 0;
		let tfsPoints = 0;

		// Score regular picks - only score games that have finished
		const scoredPicks = picks.map(pick => {
			const gameResult = gameResults.find(g => g.id === pick.gameId);
			if (!gameResult) {
				return { ...pick, isCorrect: null };
			}

			// Only score if game has finished (both scores are present and are numbers)
			// Note: scores can be 0, so we check for typeof === 'number' only
			const gameFinished = typeof gameResult.homeScore === 'number' && typeof gameResult.awayScore === 'number';
			
			if (!gameFinished) {
				return { ...pick, isCorrect: null };
			}

			const isCorrect = this.calculatePickResult(pick, gameResult);
			if (isCorrect) {
				weeklyPoints += 2;
				correctPicks++;
			}

			return { ...pick, isCorrect };
		});

		// Score TFS if applicable - only if game has finished
		const tfsGameResult = gameResults.find(g => g.id === tfsGame);
		if (tfsGameResult) {
			// Only score TFS if game has finished (both scores are present and are numbers)
			const tfsGameFinished = typeof tfsGameResult.homeScore === 'number' && typeof tfsGameResult.awayScore === 'number';
			
			if (tfsGameFinished) {
				const actualScore = tfsGameResult.homeScore + tfsGameResult.awayScore;
				tfsPoints = this.calculateTFSPoints(tfsScore, actualScore);
				weeklyPoints += tfsPoints;
			}
		}

		return {
			scoredPicks,
			weeklyPoints,
			correctPicks,
			tfsPoints
		};
	}
}
