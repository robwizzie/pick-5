// src/utils/oddsUtils.ts

/**
 * Calculate points earned from American moneyline odds
 * Generous rewards for underdogs to incentivize risk-taking
 * All picks are worth at least 1 point, rounded to whole numbers
 *
 * @param odds - American odds (e.g., -200, +150, +300)
 * @returns Points earned for a correct pick (1-30 range)
 */
export function calculatePointsFromOdds(odds: number): number {
	// Heavy favorites (extremely low risk) - minimum 1 point
	if (odds <= -300) return 1;
	if (odds <= -200) return 1;

	// Strong favorites (low risk)
	if (odds <= -150) return 2;

	// Slight favorites/Pick'em (balanced): -149..+100
	if (odds <= 100) return 2;

	// Slight underdogs (moderate risk)
	if (odds <= 150) return 3;
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
 * Get badge background color class based on odds
 */
export function getOddsBadgeClass(odds: number): string {
	if (odds < -150) return 'bg-blue-400 text-white'; // Heavy favorite
	if (odds < 0) return 'bg-blue-300 text-white'; // Slight favorite
	if (odds <= 150) return 'bg-yellow-400 text-black'; // Slight underdog
	if (odds <= 300) return 'bg-orange-400 text-white'; // Medium underdog
	return 'bg-red-400 text-white'; // Big underdog
}

/**
 * Get descriptive label for odds risk level
 */
export function getOddsRiskLabel(odds: number): string {
	if (odds <= -300) return 'Heavy Favorite';
	if (odds <= -150) return 'Favorite';
	if (odds < -100) return 'Slight Favorite';
	if (odds >= -100 && odds <= 100) return "Pick 'em";
	if (odds <= 200) return 'Underdog';
	if (odds <= 400) return 'Big Underdog';
	return 'Longshot';
}
