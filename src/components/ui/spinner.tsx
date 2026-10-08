import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Spinner({ className, label }: { className?: string; label?: string }) {
	return (
		<div role='status' className={cn('flex flex-col items-center justify-center gap-3', className)}>
			<div className='relative h-10 w-10'>
				<div className='absolute inset-0 rounded-full border-2 border-white/10' />
				<div className='absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/40' />
			</div>
			{label ? <p className='text-sm text-muted-foreground'>{label}</p> : <span className='sr-only'>Loading</span>}
		</div>
	);
}

/** Full-page loading state: the Pick 5 logo with a soft pulse and a spinning ring. */
export function LogoLoader({ label = 'Loading', className }: { label?: string; className?: string }) {
	return (
		<div role='status' aria-live='polite' className={cn('flex min-h-[70vh] flex-col items-center justify-center gap-5 animate-fade-in', className)}>
			<div className='relative grid h-28 w-28 place-items-center'>
				<div className='absolute inset-0 rounded-full bg-primary/15 blur-2xl motion-safe:animate-pulse' />
				<div className='absolute inset-0 rounded-full border-2 border-white/[0.06]' />
				<div className='absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 motion-safe:animate-spin' />
				<Image src='/pick-5-logo-sm.webp' alt='' width={56} height={64} priority className='relative h-16 w-auto drop-shadow-[0_4px_14px_rgba(56,214,255,0.35)]' />
			</div>
			<span className='sr-only'>{label}</span>
		</div>
	);
}
