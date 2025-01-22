// src/services/scoringService.ts
interface GameResult {
	id: string;
	winner: string;
	finalScore: number;
}

interface WeeklyPicks {
	picks: Array<{
		gameId: string;
		team: string;
	}>;
	tfs: {
		gameId: string;
		predictedScore: number;
	};
}

interface WeeklyResult {
	picks: number;
	correct: number;
	points: number;
	tfsPoints: number;
}

export class ScoringService {
	static calculateWeekScore(
		picks: WeeklyPicks,
		results: GameResult[]
	): {
		points: number;
		correct: number;
		tfsPoints: number;
	} {
		let points = 0;
		let correctPicks = 0;
		let tfsPoints = 0;

		// Calculate points for picks
		picks.picks.forEach(pick => {
			const result = results.find(r => r.id === pick.gameId);
			if (result && result.winner === pick.team) {
				points += 2; // 2 points for correct pick
				correctPicks++;
			}
		});

		// Calculate TFS points
		const tfsResult = results.find(r => r.id === picks.tfs.gameId);
		if (tfsResult) {
			const difference = Math.abs(tfsResult.finalScore - picks.tfs.predictedScore);

			if (difference === 0) {
				tfsPoints = 5; // Exact score
			} else if (difference <= 3) {
				tfsPoints = 4; // Within 3 points
			} else if (difference <= 5) {
				tfsPoints = 3; // Within 5 points
			} else if (difference <= 7) {
				tfsPoints = 2; // Within 7 points
			} else if (difference <= 10) {
				tfsPoints = 1; // Within 10 points
			}
		}

		return {
			points: points + tfsPoints,
			correct: correctPicks,
			tfsPoints
		};
	}

	static calculateSeasonStats(weeklyResults: Record<number, WeeklyResult>) {
		const stats = {
			totalPoints: 0,
			totalPicks: 0,
			correctPicks: 0,
			totalTFSPoints: 0,
			weeklyScores: {} as Record<number, number>,
			winPercentage: 0
		};

		Object.entries(weeklyResults).forEach(([week, result]) => {
			stats.totalPoints += result.points;
			stats.totalPicks += result.picks;
			stats.correctPicks += result.correct;
			stats.totalTFSPoints += result.tfsPoints;
			stats.weeklyScores[parseInt(week)] = result.points;
		});

		// Calculate win percentage
		stats.winPercentage = stats.totalPicks > 0 ? (stats.correctPicks / stats.totalPicks) * 100 : 0;

		return stats;
	}

	static determineWinner(
		seasonStats: Record<
			string,
			{
				totalPoints: number;
				winPercentage: number;
			}
		>
	): string[] {
		let maxPoints = 0;
		let winners: string[] = [];

		// Find highest point total
		Object.entries(seasonStats).forEach(([player, stats]) => {
			if (stats.totalPoints > maxPoints) {
				maxPoints = stats.totalPoints;
				winners = [player];
			} else if (stats.totalPoints === maxPoints) {
				winners.push(player);
			}
		});

		// If tie, use win percentage as tiebreaker
		if (winners.length > 1) {
			let bestPercentage = 0;
			let tiebreakWinners: string[] = [];

			winners.forEach(player => {
				const percentage = seasonStats[player].winPercentage;
				if (percentage > bestPercentage) {
					bestPercentage = percentage;
					tiebreakWinners = [player];
				} else if (percentage === bestPercentage) {
					tiebreakWinners.push(player);
				}
			});

			return tiebreakWinners;
		}

		return winners;
	}

	static validatePicks(picks: WeeklyPicks): boolean {
		// Must have exactly 5 picks
		if (picks.picks.length !== 5) {
			return false;
		}

		// TFS game must be one of the picked games
		if (!picks.picks.some(pick => pick.gameId === picks.tfs.gameId)) {
			return false;
		}

		// Predicted score must be positive
		if (picks.tfs.predictedScore <= 0) {
			return false;
		}

		// No duplicate game picks
		const gameIds = picks.picks.map(p => p.gameId);
		const uniqueGameIds = new Set(gameIds);
		if (uniqueGameIds.size !== picks.picks.length) {
			return false;
		}

		return true;
	}

	static getWeeklyLeaderboard(
		weekResults: Record<
			string,
			{
				points: number;
				correct: number;
				tfsPoints: number;
			}
		>
	): Array<{
		player: string;
		points: number;
		correct: number;
		tfsPoints: number;
	}> {
		return Object.entries(weekResults)
			.map(([player, results]) => ({
				player,
				points: results.points,
				correct: results.correct,
				tfsPoints: results.tfsPoints
			}))
			.sort((a, b) => b.points - a.points);
	}
}
