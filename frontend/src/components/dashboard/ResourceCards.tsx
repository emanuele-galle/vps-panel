'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

// ============================================
// RESOURCE CARD COMPONENT
// ============================================

interface ResourceCardProps {
  title: string;
  value: number;
  unit: string;
  subtitle?: string;
  icon: React.ElementType;
  isHealthy: boolean;
  colorScheme: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

const colorMap = {
  blue: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    bar: 'bg-primary',
  },
  green: {
    bg: 'bg-success/10',
    text: 'text-success',
    bar: 'bg-success',
  },
  purple: {
    bg: 'bg-accent/10',
    text: 'text-accent-foreground',
    bar: 'bg-purple-500',
  },
  amber: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    bar: 'bg-warning',
  },
  red: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    bar: 'bg-destructive',
  },
};

export function ResourceCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  isHealthy,
  colorScheme,
}: ResourceCardProps) {
  const color = isHealthy ? colorMap[colorScheme] : colorMap.red;

  return (
    <motion.div variants={fadeInUp}>
      <Card className={cn(
        'relative overflow-hidden transition-all duration-200 glass border-border/50',
        !isHealthy && 'border-destructive/50'
      )}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className={cn('p-2.5 rounded-xl', color.bg)}>
              <Icon className={cn('h-5 w-5', color.text)} />
            </div>
            {!isHealthy && (
              <Badge variant="destructive" className="text-xs">
                Alto
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight">
                {Number(value || 0).toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>

          <div className="mt-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', color.bar)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(value, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// QUICK STAT CARD
// ============================================

interface QuickStatProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  href: string;
  colorScheme: 'blue' | 'green' | 'purple' | 'amber';
}

const quickStatColors = {
  blue: 'bg-primary/10 text-primary',
  green: 'bg-success/10 text-success',
  purple: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
  amber: 'bg-warning/10 text-warning',
};

export function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  colorScheme,
}: QuickStatProps) {
  return (
    <Link href={href}>
      <motion.div
        variants={fadeInUp}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card className="card-interactive glass border-border/50 h-full">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', quickStatColors[colorScheme])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground truncate">{title}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            {subtitle && (
              <p className="text-xs text-success mt-2 pl-12">{subtitle}</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
