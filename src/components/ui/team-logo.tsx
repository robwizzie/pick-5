import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * NFL team logo on a soft disc so dark logos stay legible on the dark UI.
 * ESPN logos are already optimized PNGs served from their CDN.
 */
export function TeamLogo({ src, alt, size = 40, className }: { src?: string; alt: string; size?: number; className?: string }) {
	return (
		<div
			className={cn('relative shrink-0 rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.04] ring-1 ring-white/10', className)}
			// Padding from the logo's own size (percent padding would resolve against the parent's width)
			style={{ width: size, height: size, padding: Math.round(size * 0.14) }}
		>
			{src ? (
				<div className='relative h-full w-full'>
					<Image src={src} alt={alt} fill sizes={`${size}px`} className='object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]' unoptimized />
				</div>
			) : (
				<div className='grid h-full w-full place-items-center text-[10px] font-bold text-muted-foreground'>{alt.slice(0, 3).toUpperCase()}</div>
			)}
		</div>
	);
}
