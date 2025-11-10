'use client';

/**
 * AnimatedBackground - Subtle gradient mesh that animates slowly
 * Creates depth and visual interest without being distracting
 * Very low opacity (5-10%) to maintain dark aesthetic
 */
export function AnimatedBackground() {
	return (
		<div className='fixed inset-0 -z-10 overflow-hidden pointer-events-none'>
			{/* Primary gradient orb - blue to purple */}
			<div
				className='absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.08]'
				style={{
					background: 'radial-gradient(circle, rgba(0, 102, 255, 0.4) 0%, rgba(157, 78, 221, 0.2) 50%, transparent 70%)',
					animation: 'float-slow 30s ease-in-out infinite'
				}}
			/>

			{/* Secondary gradient orb - pink to orange */}
			<div
				className='absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[100px] opacity-[0.06]'
				style={{
					background: 'radial-gradient(circle, rgba(255, 0, 110, 0.3) 0%, rgba(255, 107, 53, 0.2) 50%, transparent 70%)',
					animation: 'float-slow 25s ease-in-out infinite reverse'
				}}
			/>

			{/* Tertiary gradient orb - electric blue */}
			<div
				className='absolute top-1/2 right-1/3 w-[400px] h-[400px] rounded-full blur-[90px] opacity-[0.05]'
				style={{
					background: 'radial-gradient(circle, rgba(0, 217, 255, 0.3) 0%, rgba(157, 78, 221, 0.2) 50%, transparent 70%)',
					animation: 'float-slow 35s ease-in-out infinite'
				}}
			/>

			{/* CSS animations */}
			<style jsx>{`
				@keyframes float-slow {
					0%,
					100% {
						transform: translate(0, 0) scale(1);
					}
					33% {
						transform: translate(30px, -30px) scale(1.05);
					}
					66% {
						transform: translate(-20px, 20px) scale(0.95);
					}
				}
			`}</style>
		</div>
	);
}
