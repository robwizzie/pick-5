// src/utils/oddsUtils.ts

/**
 * Calculate points earned from American moneyline odds
 * Generous rewards for underdogs to incentivize risk-taking
 *
 * @param odds - American odds (e.g., -200, +150, +300)
 * @returns Points earned for a correct pick (0-10+ range)
 */
export function calculatePointsFromOdds(odds: number): number {
	// Huge favorites (extremely low risk)
	if (odds <= -400) return 0.5;
	if (odds <= -300) return 0.75;
	if (odds <= -200) return 1;

	// Strong favorites (low risk)
	if (odds <= -150) return 1.5;
	if (odds <= -120) return 1.75;

	// Slight favorites/Pick'em (balanced)
	if (odds > -120 && odds < -100) return 2;
	if (odds >= -100 && odds <= 100) return 2;

	// Slight underdogs (moderate risk)
	if (odds > 100 && odds <= 125) return 2.5;
	if (odds <= 150) return 3;
	if (odds <= 175) return 3.5;
	if (odds <= 200) return 4;

	// Medium underdogs (good risk/reward)
	if (odds <= 250) return 5;
	if (odds <= 300) return 6;
	if (odds <= 350) return 7;
	if (odds <= 400) return 8;

	// Big underdogs (high risk, high reward!)
	if (odds <= 500) return 10;
	if (odds <= 600) return 12;
	if (odds <= 700) return 14;
	if (odds <= 800) return 16;

	// Massive underdogs (huge rewards!)
	if (odds <= 1000) return 20;

	// Extreme longshots (moon shot rewards!)
	return Math.min(30, 20 + Math.floor((odds - 1000) / 200));
}

/**
 * Format American odds for display with proper + or - sign
 */
export function formatOdds(odds: number): string {
	if (odds > 0) return `+${odds}`;
	return odds.toString();
}

/**
 * Get color class based on odds (favorite vs underdog)
 */
export function getOddsColorClass(odds: number): string {
	if (odds < -150) return 'text-blue-400'; // Heavy favorite
	if (odds < 0) return 'text-blue-300'; // Slight favorite
	if (odds <= 150) return 'text-yellow-400'; // Slight underdog
	if (odds <= 300) return 'text-orange-400'; // Medium underdog
	return 'text-red-400'; // Big underdog
}

/**
 * Get descriptive label for odds risk level
 */
export function getOddsRiskLabel(odds: number): string {
	if (odds <= -300) return 'Heavy Favorite';
	if (odds <= -150) return 'Favorite';
	if (odds < -100) return 'Slight Favorite';
	if (odds >= -100 && odds <= 100) return 'Pick \'em';
	if (odds <= 200) return 'Underdog';
	if (odds <= 400) return 'Big Underdog';
	return 'Longshot';
}
