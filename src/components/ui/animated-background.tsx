/**
 * Ambient "night game" backdrop: stadium-light glows in the logo's colors,
 * a faint yard-line grid, and a vignette. Static gradients only, so it costs
 * nothing per frame.
 */
export function AnimatedBackground() {
	return (
		<div aria-hidden className='pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background'>
			{/* Stadium lights */}
			<div
				className='absolute -top-[30vh] left-1/2 h-[80vh] w-[140vw] -translate-x-1/2 opacity-70'
				style={{
					background:
						'radial-gradient(ellipse 40% 50% at 20% 40%, rgba(56,214,255,0.18), transparent 70%), radial-gradient(ellipse 35% 45% at 80% 35%, rgba(255,61,90,0.14), transparent 70%), radial-gradient(ellipse 30% 40% at 50% 10%, rgba(124,255,79,0.08), transparent 70%)'
				}}
			/>
			{/* Yard-line grid, fading out toward the bottom */}
			<div
				className='absolute inset-0 opacity-[0.35]'
				style={{
					backgroundImage:
						'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
					backgroundSize: '72px 72px',
					maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)',
					WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)'
				}}
			/>
			{/* Turf glow at the bottom */}
			<div
				className='absolute -bottom-[40vh] left-1/2 h-[60vh] w-[120vw] -translate-x-1/2'
				style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(47,107,255,0.10), transparent 70%)' }}
			/>
			{/* Film grain for depth */}
			<div
				className='absolute inset-0 opacity-[0.035] mix-blend-overlay'
				style={{
					backgroundImage:
						"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
				}}
			/>
		</div>
	);
}
