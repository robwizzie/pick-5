import { Crosshair, Crown, Flame, Lock, Swords, Trophy, type LucideIcon } from 'lucide-react';
import type { Badge, BadgeTone } from '@/lib/badges';
import { cn } from '@/lib/utils';

export const BADGE_ICONS: Record<Badge['icon'], LucideIcon> = { Crosshair, Crown, Flame, Lock, Swords, Trophy };

/** Literal class strings per tone (Tailwind needs them spelled out). */
export const BADGE_TONES: Record<BadgeTone, { text: string; chip: string; card: string; wash: string; bar: string }> = {
	gold: {
		text: 'text-[#FFD66B]',
		chip: 'bg-[#FFD66B]/[0.12] text-[#FFD66B] ring-[#FFD66B]/35',
		card: 'border-[#FFD66B]/25 shadow-[0_0_32px_-10px_rgba(255,214,107,0.55)]',
		wash: 'from-[#FFD66B]/[0.12]',
		bar: 'bg-[#FFD66B]'
	},
	accent: {
		text: 'text-accent',
		chip: 'bg-accent/[0.12] text-accent ring-accent/35',
		card: 'border-accent/25 shadow-[0_0_32px_-10px_hsl(var(--accent)/0.55)]',
		wash: 'from-accent/[0.10]',
		bar: 'bg-accent'
	},
	primary: {
		text: 'text-primary',
		chip: 'bg-primary/[0.12] text-primary ring-primary/35',
		card: 'border-primary/25 shadow-[0_0_32px_-10px_hsl(var(--primary)/0.55)]',
		wash: 'from-primary/[0.10]',
		bar: 'bg-primary'
	},
	hot: {
		text: 'text-accent-2',
		chip: 'bg-accent-2/[0.12] text-accent-2 ring-accent-2/35',
		card: 'border-accent-2/25 shadow-[0_0_32px_-10px_hsl(var(--accent-2)/0.55)]',
		wash: 'from-accent-2/[0.10]',
		bar: 'bg-accent-2'
	},
	warning: {
		text: 'text-warning',
		chip: 'bg-warning/[0.12] text-warning ring-warning/35',
		card: 'border-warning/25 shadow-[0_0_32px_-10px_hsl(var(--warning)/0.55)]',
		wash: 'from-warning/[0.10]',
		bar: 'bg-warning'
	},
	violet: {
		text: 'text-chart-5',
		chip: 'bg-chart-5/[0.12] text-chart-5 ring-chart-5/35',
		card: 'border-chart-5/25 shadow-[0_0_32px_-10px_hsl(var(--chart-5)/0.55)]',
		wash: 'from-chart-5/[0.10]',
		bar: 'bg-chart-5'
	}
};

/** Round icon chip for a badge; dimmed when locked. */
export function BadgeIcon({ badge, size = 'md', className }: { badge: Pick<Badge, 'icon' | 'tone' | 'earned'>; size?: 'xs' | 'md' | 'lg'; className?: string }) {
	const Icon = BADGE_ICONS[badge.icon];
	const dims = { xs: 'h-[18px] w-[18px] [&_svg]:h-2.5 [&_svg]:w-2.5', md: 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5', lg: 'h-12 w-12 [&_svg]:h-6 [&_svg]:w-6' }[size];
	return (
		<span className={cn('grid shrink-0 place-items-center rounded-full ring-1', dims, badge.earned ? BADGE_TONES[badge.tone].chip : 'bg-white/[0.04] text-muted-foreground ring-white/10', className)}>
			<Icon aria-hidden />
		</span>
	);
}
