import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0', {
	variants: {
		variant: {
			default: 'bg-primary text-primary-foreground hover:bg-primary/90',
			destructive: 'bg-red-500 text-white hover:bg-red-600',
			outline: 'border border-input hover:bg-primary/20 hover:text-primary',
			secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
			ghost: 'hover:bg-accent',
			link: 'underline-offset-4 hover:underline text-primary',
			success: 'bg-green-500 text-white hover:bg-green-600',
			gradient: 'bg-gradient-to-r from-electric-pink via-electric-orange to-electric-red text-white font-bold shadow-gradient-glow hover:shadow-gradient-glow hover:scale-105 transition-all'
		},
		size: {
			default: 'h-10 px-4 py-2',
			sm: 'h-9 rounded-md px-3',
			lg: 'h-11 rounded-md px-8',
			icon: 'h-10 w-10'
		}
	},
	defaultVariants: {
		variant: 'default',
		size: 'default'
	}
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
	noAnimation?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, noAnimation = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';

	// Use regular component when asChild or noAnimation is true
	if (noAnimation || asChild) {
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
	}

	// Use motion.button for animated buttons
	return (
		<motion.button
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			transition={{ duration: 0.1 }}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };
