import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
	shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
	return (
		<div
			className={cn(
				'rounded-md bg-muted/50',
				shimmer &&
					'animate-shimmer bg-gradient-to-r from-muted/50 via-metallic/10 to-muted/50 bg-[length:1000px_100%]',
				className
			)}
			{...props}
		/>
	);
}

// Pre-built skeleton components for common use cases
function LeagueCardSkeleton() {
	return (
		<div className='p-3 sm:p-5 border rounded-lg bg-card space-y-3'>
			<div className='flex items-center justify-between gap-3'>
				<div className='flex-1 space-y-2'>
					<Skeleton className='h-5 w-3/4' />
					<Skeleton className='h-4 w-1/2' />
				</div>
				<Skeleton className='h-16 w-16 rounded-lg' />
			</div>
			<div className='flex items-center justify-between pt-2'>
				<div className='space-y-1'>
					<Skeleton className='h-6 w-20' />
					<Skeleton className='h-3 w-16' />
				</div>
				<div className='space-y-1'>
					<Skeleton className='h-6 w-16' />
					<Skeleton className='h-3 w-20' />
				</div>
			</div>
		</div>
	);
}

function GameCardSkeleton() {
	return (
		<div className='p-4 border rounded-lg bg-card space-y-4'>
			<Skeleton className='h-4 w-32' />
			<div className='space-y-3'>
				<div className='flex items-center gap-3'>
					<Skeleton className='h-12 w-12 rounded-full' />
					<div className='flex-1 space-y-2'>
						<Skeleton className='h-4 w-32' />
						<Skeleton className='h-3 w-20' />
					</div>
					<Skeleton className='h-6 w-12' />
				</div>
				<div className='flex items-center gap-3'>
					<Skeleton className='h-12 w-12 rounded-full' />
					<div className='flex-1 space-y-2'>
						<Skeleton className='h-4 w-32' />
						<Skeleton className='h-3 w-20' />
					</div>
					<Skeleton className='h-6 w-12' />
				</div>
			</div>
		</div>
	);
}

function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div className='space-y-2'>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className='flex items-center gap-3 p-3 border rounded-lg bg-card'>
					<Skeleton className='h-6 w-6 rounded-full' />
					<Skeleton className='h-10 w-10 rounded-full' />
					<div className='flex-1 space-y-2'>
						<Skeleton className='h-4 w-32' />
						<Skeleton className='h-3 w-24' />
					</div>
					<Skeleton className='h-6 w-12' />
				</div>
			))}
		</div>
	);
}

export { Skeleton, LeagueCardSkeleton, GameCardSkeleton, LeaderboardSkeleton };
