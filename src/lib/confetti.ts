import confetti from 'canvas-confetti';

/**
 * Confetti utility for celebrations
 * Uses brand colors (neon green, pink, orange) for consistency
 */

// Brand colors for confetti
const BRAND_COLORS = ['#39FF14', '#FF006E', '#FF6B35', '#00D9FF'];

/**
 * Small confetti burst - for pick submissions
 */
export function smallConfetti() {
	confetti({
		particleCount: 30,
		spread: 45,
		origin: { y: 0.6 },
		colors: BRAND_COLORS,
		ticks: 100,
		gravity: 1.2,
		scalar: 0.8
	});
}

/**
 * Medium confetti burst - for weekly wins
 */
export function mediumConfetti() {
	confetti({
		particleCount: 80,
		spread: 70,
		origin: { y: 0.6 },
		colors: BRAND_COLORS,
		ticks: 150,
		gravity: 1
	});
}

/**
 * Large confetti explosion - for perfect weeks and big wins
 */
export function largeConfetti() {
	const count = 150;
	const defaults = {
		origin: { y: 0.7 },
		colors: BRAND_COLORS
	};

	function fire(particleRatio: number, opts: confetti.Options) {
		confetti({
			...defaults,
			...opts,
			particleCount: Math.floor(count * particleRatio)
		});
	}

	fire(0.25, {
		spread: 26,
		startVelocity: 55
	});

	fire(0.2, {
		spread: 60
	});

	fire(0.35, {
		spread: 100,
		decay: 0.91,
		scalar: 0.8
	});

	fire(0.1, {
		spread: 120,
		startVelocity: 25,
		decay: 0.92,
		scalar: 1.2
	});

	fire(0.1, {
		spread: 120,
		startVelocity: 45
	});
}

/**
 * Confetti cannon - shoots from one side
 */
export function cannonConfetti(side: 'left' | 'right' = 'left') {
	const end = Date.now() + 1000; // 1 second
	const colors = BRAND_COLORS;

	(function frame() {
		confetti({
			particleCount: 3,
			angle: side === 'left' ? 60 : 120,
			spread: 55,
			origin: { x: side === 'left' ? 0 : 1, y: 0.6 },
			colors: colors
		});

		if (Date.now() < end) {
			requestAnimationFrame(frame);
		}
	})();
}

/**
 * Neon green confetti - for achievements
 */
export function neonGreenConfetti() {
	confetti({
		particleCount: 60,
		spread: 80,
		origin: { y: 0.6 },
		colors: ['#39FF14', '#5FFF47', '#2DE000'],
		ticks: 120,
		gravity: 1.1
	});
}
