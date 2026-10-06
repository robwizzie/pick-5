import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Standard page wrapper: centered, padded, with room for the mobile tab bar. */
export function PageContainer({ className, size = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: 'narrow' | 'default' | 'wide' }) {
	const max = size === 'narrow' ? 'max-w-3xl' : size === 'wide' ? 'max-w-7xl' : 'max-w-6xl';
	return <div className={cn('mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8', max, className)} {...props} />;
}

/** Broadcast-style page title with optional eyebrow, description and actions. */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	className
}: {
	eyebrow?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}) {
	return (
		<header className={cn('mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between', className)}>
			<div className='min-w-0 animate-slide-up'>
				{eyebrow && <p className='eyebrow mb-3 flex items-center gap-2'>{eyebrow}</p>}
				<h1 className='display-heading text-[2.75rem] text-foreground sm:text-6xl'>{title}</h1>
				{description && <p className='mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg'>{description}</p>}
			</div>
			{actions && <div className='flex shrink-0 flex-wrap items-center gap-2'>{actions}</div>}
		</header>
	);
}

/** Section title row used inside pages and cards. */
export function SectionHeader({ title, icon: Icon, action, className }: { title: React.ReactNode; icon?: LucideIcon; action?: React.ReactNode; className?: string }) {
	return (
		<div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
			<h2 className='flex items-center gap-2.5 font-display text-xl font-bold uppercase italic tracking-tight sm:text-2xl'>
				{Icon && (
					<span className='grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary'>
						<Icon className='h-4 w-4' />
					</span>
				)}
				{title}
			</h2>
			{action}
		</div>
	);
}

/** Friendly empty/zero state. */
export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
	return (
		<div className={cn('glass flex flex-col items-center rounded-2xl px-6 py-12 text-center', className)}>
			{Icon && (
				<div className='relative mb-5'>
					<div className='absolute inset-0 rounded-2xl bg-primary/30 blur-xl' />
					<div className='relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary'>
						<Icon className='h-6 w-6' />
					</div>
				</div>
			)}
			<h3 className='font-display text-2xl font-bold uppercase italic tracking-tight'>{title}</h3>
			{description && <p className='mt-2 max-w-sm text-sm text-muted-foreground'>{description}</p>}
			{action && <div className='mt-6 flex flex-wrap justify-center gap-2'>{action}</div>}
		</div>
	);
}

/** Compact KPI tile. `tone` tints the icon chip and value. */
export function StatTile({
	label,
	value,
	sub,
	icon: Icon,
	tone = 'primary',
	className
}: {
	label: React.ReactNode;
	value: React.ReactNode;
	sub?: React.ReactNode;
	icon?: LucideIcon;
	tone?: 'primary' | 'accent' | 'hot' | 'warning' | 'muted';
	className?: string;
}) {
	const tones = {
		primary: 'text-primary bg-primary/10',
		accent: 'text-accent bg-accent/10',
		hot: 'text-accent-2 bg-accent-2/10',
		warning: 'text-warning bg-warning/10',
		muted: 'text-muted-foreground bg-white/5'
	} as const;
	return (
		<div className={cn('glass group relative overflow-hidden rounded-2xl p-4 sm:p-5', className)}>
			<div className='flex items-start justify-between gap-3'>
				<p className='eyebrow'>{label}</p>
				{Icon && (
					<span className={cn('hidden h-8 w-8 shrink-0 place-items-center rounded-lg sm:grid', tones[tone])}>
						<Icon className='h-4 w-4' />
					</span>
				)}
			</div>
			<div className='mt-2 font-display text-4xl font-extrabold italic tabular leading-none tracking-tight sm:text-5xl'>{value}</div>
			{sub && <div className='mt-2 text-xs text-muted-foreground'>{sub}</div>}
		</div>
	);
}

/** Small pill/badge. */
export function Pill({ className, tone = 'muted', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'muted' | 'primary' | 'accent' | 'hot' | 'warning' | 'live' }) {
	const tones = {
		muted: 'bg-white/[0.06] text-muted-foreground border-white/10',
		primary: 'bg-primary/10 text-primary border-primary/25',
		accent: 'bg-accent/10 text-accent border-accent/25',
		hot: 'bg-accent-2/10 text-accent-2 border-accent-2/25',
		warning: 'bg-warning/10 text-warning border-warning/25',
		live: 'bg-live/15 text-live border-live/30'
	} as const;
	return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider', tones[tone], className)} {...props} />;
}
