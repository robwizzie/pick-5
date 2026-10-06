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
