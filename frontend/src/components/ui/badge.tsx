import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'error' | 'info';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
          {
            'bg-primary/10 text-primary': variant === 'default',
            'bg-secondary text-secondary-foreground': variant === 'secondary',
            'border border-border bg-transparent text-foreground': variant === 'outline',
            'bg-destructive/15 text-destructive': variant === 'destructive' || variant === 'error',
            'bg-success/15 text-success': variant === 'success',
            'bg-warning/15 text-warning': variant === 'warning',
            'bg-primary/15 text-primary': variant === 'info',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
