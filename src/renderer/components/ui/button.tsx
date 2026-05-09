import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@renderer/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-amber-500 text-slate-900 hover:bg-amber-400 active:bg-amber-500',
        secondary: 'bg-white/10 text-white/95 hover:bg-white/15 active:bg-white/10',
        ghost: 'text-white/70 hover:text-white/95 hover:bg-white/5 active:bg-white/10',
        outline: 'border border-white/10 text-white/95 hover:bg-white/5 active:bg-white/10',
        danger: 'bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
