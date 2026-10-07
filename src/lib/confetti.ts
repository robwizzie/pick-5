import confetti from 'canvas-confetti';

// Brand colors from the logo
const BRAND_COLORS = ['#7CFF4F', '#38D6FF', '#FF3D5A', '#FF7A30', '#FFFFFF'];

/** Two-sided burst for locking in a week's picks. */
export function picksLockedConfetti() {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const base = { particleCount: 60, spread: 60, startVelocity: 45, ticks: 160, colors: BRAND_COLORS, scalar: 0.9, disableForReducedMotion: true };
	confetti({ ...base, angle: 60, origin: { x: 0, y: 0.75 } });
	confetti({ ...base, angle: 120, origin: { x: 1, y: 0.75 } });
}
