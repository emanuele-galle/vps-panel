'use client';

import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

// ============================================
// TYPES
// ============================================

type StatusType = 'healthy' | 'warning' | 'error' | 'neutral';

interface TrendData {
  value: number;
  isPositive: boolean;
}

interface SparklineData {
  data: number[];
  color?: string;
}

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: TrendData;
  sparkline?: SparklineData;
  status?: StatusType;
  suffix?: string;
  prefix?: string;
  animate?: boolean;
  className?: string;
  onClick?: () => void;
}

// ============================================
// ANIMATED COUNTER COMPONENT
// ============================================

function AnimatedCounter({
  value,
  prefix = '',
  suffix = ''
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (current) =>
    `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

// ============================================
// MINI SPARKLINE COMPONENT
// ============================================

function MiniSparkline({ data, color = 'var(--primary)' }: SparklineData) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 60;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // Create area path
  const areaPath = `M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      style={{ minWidth: width }}
    >
      {/* Gradient definition */}
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill="url(#sparklineGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      {/* Line */}
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* End dot */}
      <motion.circle
        cx={width - padding}
        cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
        r={2.5}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300 }}
      />
    </svg>
  );
}

// ============================================
// STATUS STYLES
// ============================================

const statusStyles: Record<StatusType, {
  dotClass: string;
  iconBg: string;
  iconColor: string;
  glowClass: string;
}> = {
  healthy: {
    dotClass: 'status-dot-healthy status-dot-pulse',
    iconBg: 'bg-success/10 dark:bg-success/15',
    iconColor: 'text-success',
    glowClass: 'hover:glow-success',
  },
  warning: {
    dotClass: 'status-dot-warning status-dot-pulse',
    iconBg: 'bg-warning/10 dark:bg-warning/15',
    iconColor: 'text-warning',
    glowClass: 'hover:glow-warning',
  },
  error: {
    dotClass: 'status-dot-error status-dot-pulse',
    iconBg: 'bg-destructive/10 dark:bg-destructive/15',
    iconColor: 'text-destructive',
    glowClass: 'hover:glow-error',
  },
  neutral: {
    dotClass: 'status-dot-neutral',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    glowClass: '',
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  sparkline,
  status = 'neutral',
  suffix = '',
  prefix = '',
  animate = true,
  className,
  onClick,
}: StatsCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const statusStyle = statusStyles[status];
  const isClickable = !!onClick;
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue) && typeof value === 'number';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={isClickable ? { scale: 1.02 } : {}}
      whileTap={isClickable ? { scale: 0.98 } : {}}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          'relative overflow-hidden transition-all duration-200',
          'glass border-border/50',
          isClickable && 'cursor-pointer',
          isHovered && statusStyle.glowClass,
          className
        )}
        onClick={onClick}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-mesh opacity-50 pointer-events-none"
          aria-hidden="true"
        />

        <CardContent className="relative p-5">
          {/* Header: Title & Icon */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Title with status dot */}
              <div className="flex items-center gap-2 mb-1">
                {status !== 'neutral' && (
                  <span className={cn('status-dot', statusStyle.dotClass)} />
                )}
                <h3 className="text-sm font-medium text-muted-foreground truncate">
                  {title}
                </h3>
              </div>

              {/* Main Value */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight">
                  {animate && isNumeric ? (
                    <AnimatedCounter value={numericValue} prefix={prefix} suffix={suffix} />
                  ) : (
                    `${prefix}${value}${suffix}`
                  )}
                </span>

                {/* Sparkline next to value */}
                {sparkline && (
                  <MiniSparkline
                    data={sparkline.data}
                    color={sparkline.color || statusStyle.iconColor.replace('text-', 'var(--')}
                  />
                )}
              </div>

              {/* Description */}
              {description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {description}
                </p>
              )}

              {/* Trend Badge */}
              {trend && (
                <motion.div
                  className="flex items-center gap-1.5 mt-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md',
                      trend.isPositive
                        ? 'badge-success'
                        : 'badge-error'
                    )}
                  >
                    <motion.span
                      initial={{ rotate: trend.isPositive ? 45 : -45 }}
                      animate={{ rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      {trend.isPositive ? '↑' : '↓'}
                    </motion.span>
                    {Math.abs(trend.value)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs ultima ora
                  </span>
                </motion.div>
              )}
            </div>

            {/* Icon Container */}
            {Icon && (
              <motion.div
                className={cn(
                  'flex-shrink-0 p-2.5 rounded-xl',
                  statusStyle.iconBg
                )}
                animate={{
                  scale: isHovered ? 1.05 : 1,
                }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Icon className={cn('h-5 w-5', statusStyle.iconColor)} />
              </motion.div>
            )}
          </div>
        </CardContent>

        {/* Bottom accent line for status */}
        {status !== 'neutral' && (
          <motion.div
            className={cn(
              'absolute bottom-0 left-0 h-0.5',
              status === 'healthy' && 'bg-success',
              status === 'warning' && 'bg-warning',
              status === 'error' && 'bg-destructive'
            )}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </Card>
    </motion.div>
  );
}

// ============================================
// SKELETON LOADING STATE
// ============================================

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            {/* Title skeleton */}
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            {/* Value skeleton */}
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            {/* Description skeleton */}
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          </div>
          {/* Icon skeleton */}
          <div className="h-10 w-10 bg-muted rounded-xl animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export default StatsCard;
