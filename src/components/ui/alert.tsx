import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-xl border px-4 py-3.5 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-1px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:h-4 [&>svg]:w-4', {
	variants: {
		variant: {
			default: 'border-white/10 bg-white/[0.03] text-foreground [&>svg]:text-primary',
			info: 'border-primary/25 bg-primary/[0.08] text-foreground [&>svg]:text-primary',
			success: 'border-accent/25 bg-accent/[0.08] text-foreground [&>svg]:text-accent',
			warning: 'border-warning/30 bg-warning/[0.08] text-foreground [&>svg]:text-warning',
			destructive: 'border-destructive/30 bg-destructive/[0.08] text-destructive [&>svg]:text-destructive'
		}
	},
	defaultVariants: { variant: 'default' }
});

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(({ className, variant, ...props }, ref) => (
	<div ref={ref} role='alert' className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
	<h5 ref={ref} className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
