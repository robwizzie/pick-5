import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow-primary-glow hover:brightness-110 hover:shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.75)]',
				destructive: 'bg-destructive text-destructive-foreground hover:brightness-110 shadow-[0_8px_30px_-10px_hsl(var(--destructive)/0.7)]',
				outline: 'border border-white/12 bg-white/[0.03] text-foreground hover:bg-white/[0.07] hover:border-white/20',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'text-foreground/80 hover:bg-white/[0.06] hover:text-foreground',
				link: 'underline-offset-4 hover:underline text-primary',
				success: 'bg-accent text-accent-foreground hover:brightness-110 shadow-neon-green',
				gradient: 'bg-brand-gradient bg-[length:200%_auto] text-[#06080d] font-bold shadow-gradient-glow hover:bg-right'
			},
			size: {
				default: 'h-10 px-4',
				sm: 'h-9 px-3 text-[13px]',
				lg: 'h-12 rounded-xl px-7 text-base',
				xl: 'h-14 rounded-2xl px-8 text-base',
				icon: 'h-10 w-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
