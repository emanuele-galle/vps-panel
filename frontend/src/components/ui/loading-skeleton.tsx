/**
 * Unified loading components for VPS Panel
 * Provides consistent loading states across the application
 */

'use client';

import { cn } from '@/lib/utils';

interface PageLoaderProps {
  message?: string;
  className?: string;
}

/**
 * Full page loader with centered spinner
 */
export function PageLoader({ message = 'Caricamento...', className }: PageLoaderProps) {
  return (
    <div className={cn('flex h-full min-h-[400px] items-center justify-center', className)}>
      <div className="text-center">
        <div className="relative mx-auto h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

interface CardSkeletonProps {
  className?: string;
}

/**
 * Skeleton for card components
 */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-6',
        'animate-pulse',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-8 w-8 rounded-lg bg-muted" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-muted/50" />
        <div className="h-4 w-3/4 rounded bg-muted/50" />
        <div className="h-4 w-1/2 rounded bg-muted/50" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-20 rounded-md bg-muted" />
        <div className="h-8 w-20 rounded-md bg-muted" />
      </div>
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/**
 * Skeleton for table components
 */
export function TableSkeleton({ rows = 5, columns = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="flex border-b bg-muted/30 p-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 w-20 rounded bg-muted animate-pulse flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex border-b p-4 gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 rounded bg-muted/50 animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface InlineLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Inline spinner for buttons and small areas
 */
export function InlineLoader({ size = 'md', className }: InlineLoaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-5 w-5 border-2',
    lg: 'h-6 w-6 border-2',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-transparent border-t-current',
        sizeClasses[size],
        className
      )}
    />
  );
}

interface StatsCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton for stats/metrics cards
 */
export function StatsCardSkeleton({ className }: StatsCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-6 animate-pulse',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-10 w-10 rounded-lg bg-muted" />
      </div>
      <div className="mt-4">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="mt-2 h-3 w-32 rounded bg-muted/50" />
      </div>
    </div>
  );
}

interface GridSkeletonProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * Grid of card skeletons
 */
export function GridSkeleton({ count = 6, columns = 3, className }: GridSkeletonProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

/**
 * Skeleton for chart/graph components
 */
export function ChartSkeleton({ height = 300, className }: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-6 animate-pulse',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-md bg-muted" />
          <div className="h-6 w-16 rounded-md bg-muted" />
        </div>
      </div>
      <div
        className="relative bg-muted/30 rounded-lg overflow-hidden"
        style={{ height }}
      >
        {/* Simulated chart bars */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around gap-2 p-4">
          {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-muted rounded-t"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard stats row
 */
export function DashboardStatsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

/**
 * Skeleton for list items (activity feed, logs, etc.)
 */
export function ListSkeleton({ items = 5, className }: ListSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      <div className="p-4 border-b">
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted/50" />
            </div>
            <div className="h-4 w-16 rounded bg-muted/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

/**
 * Skeleton for form sections
 */
export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-6 space-y-6', className)}>
      <div className="h-6 w-48 rounded bg-muted animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2 animate-pulse">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded-md bg-muted/50" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-4 border-t">
        <div className="h-10 w-24 rounded-md bg-muted animate-pulse" />
        <div className="h-10 w-24 rounded-md bg-muted/50 animate-pulse" />
      </div>
    </div>
  );
}

interface DetailPageSkeletonProps {
  className?: string;
}

/**
 * Skeleton for detail pages (project details, container details, etc.)
 */
export function DetailPageSkeleton({ className }: DetailPageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted/50" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-md bg-muted" />
          <div className="h-10 w-24 rounded-md bg-muted" />
        </div>
      </div>

      {/* Stats Row */}
      <DashboardStatsSkeleton />

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-md bg-muted" />
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <ListSkeleton items={4} />
      </div>
    </div>
  );
}

interface ContainerCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton specific for container cards
 */
export function ContainerCardSkeleton({ className }: ContainerCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-6 animate-pulse',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted/50" />
        </div>
        <div className="h-6 w-16 rounded-full bg-muted" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-muted/50" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-muted/50" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-muted/50" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
        <div className="h-8 w-8 rounded-md bg-muted" />
      </div>
    </div>
  );
}
