'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  percentage?: number;
  showProgressBar?: boolean;
  progressColor?: string;
  className?: string;
}

export function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
  percentage,
  showProgressBar = false,
  progressColor = 'bg-primary',
  className,
}: MetricsCardProps) {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-warning';
    return progressColor;
  };

  const getProgressGlow = (percentage: number) => {
    if (percentage >= 90) return 'shadow-[0_0_8px_var(--destructive)]';
    if (percentage >= 70) return 'shadow-[0_0_8px_var(--warning)]';
    return '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={{ scale: 1.02, y: -2 }}
    >
      <Card className={cn('glass border-border/50 hover:glow-primary transition-all', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <p className="text-3xl font-bold text-foreground">
                  {value}
                </p>
                {percentage !== undefined && (
                  <span className="text-sm text-muted-foreground">
                    / 100%
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            <motion.div
              className={cn('p-3 rounded-xl bg-muted/50')}
              whileHover={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Icon className={cn('h-6 w-6', iconColor)} />
            </motion.div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {showProgressBar && percentage !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Utilizzo</span>
                <span className="font-medium text-foreground">
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className={cn(
                    'h-2 rounded-full transition-colors',
                    getProgressColor(percentage),
                    getProgressGlow(percentage)
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {trend && (
            <motion.div
              className="flex items-center gap-1 mt-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span
                className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-md',
                  trend.isPositive
                    ? 'badge-success'
                    : 'badge-error'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-muted-foreground">
                vs ultima ora
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
