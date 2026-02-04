'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricsSnapshot } from '@/types';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

// ============================================
// TYPES
// ============================================

interface MetricsChartProps {
  title: string;
  data: MetricsSnapshot[];
  dataKey: string;
  color?: string;
  gradientId?: string;
  formatter?: (value: number) => string;
  showGrid?: boolean;
  className?: string;
  compact?: boolean;
}

// ============================================
// CUSTOM TOOLTIP
// ============================================

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: Record<string, unknown> }>;
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const value = data?.value ?? 0;
  const displayValue = formatter ? formatter(value) : value.toFixed(1);

  return (
    <div className="glass rounded-lg px-3 py-2 shadow-lg border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground">{displayValue}</p>
    </div>
  );
}

// ============================================
// CHART COLORS
// ============================================

const chartColors = {
  primary: {
    stroke: 'var(--chart-1)',
    fill: 'var(--chart-1)',
  },
  success: {
    stroke: 'var(--chart-2)',
    fill: 'var(--chart-2)',
  },
  warning: {
    stroke: 'var(--chart-4)',
    fill: 'var(--chart-4)',
  },
  error: {
    stroke: 'var(--chart-5)',
    fill: 'var(--chart-5)',
  },
  accent: {
    stroke: 'var(--chart-3)',
    fill: 'var(--chart-3)',
  },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function MetricsChart({
  title,
  data,
  dataKey,
  color = 'var(--chart-1)',
  gradientId,
  formatter,
  showGrid = true,
  className,
  compact = false,
}: MetricsChartProps) {
  const isMobile = useIsMobile();

  // Defensive check: ensure data is an array
  const safeData = data || [];

  // Transform data for chart
  const chartData = safeData.map((snapshot) => {
    const time = new Date(snapshot.timestamp);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');

    // Support nested keys like "memory.percentage"
    const keys = dataKey.split('.');
    let value: unknown = snapshot;
    for (const key of keys) {
      value = (value as Record<string, unknown>)[key];
    }

    return {
      time: timeStr,
      value: typeof value === 'number' ? value : 0,
      fullTimestamp: time.toLocaleString('it-IT'),
    };
  });

  const chartHeight = compact ? 150 : isMobile ? 200 : 280;
  const uniqueGradientId = gradientId || `gradient-${title.toLowerCase().replace(/\s/g, '-')}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className={cn('pb-2', compact ? 'p-4' : 'p-4 sm:p-6')}>
          <CardTitle className={cn(
            'font-semibold text-foreground',
            compact ? 'text-sm' : 'text-base sm:text-lg'
          )}>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={cn('pb-4', compact ? 'px-2' : 'px-2 sm:px-6')}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: compact ? 5 : 10,
                left: compact ? -20 : -10,
                bottom: 0,
              }}
            >
              {/* Gradient Definition */}
              <defs>
                <linearGradient id={uniqueGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Grid */}
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  strokeOpacity={0.5}
                  vertical={false}
                />
              )}

              {/* X Axis */}
              <XAxis
                dataKey="time"
                stroke="var(--muted-foreground)"
                fontSize={compact ? 9 : isMobile ? 10 : 11}
                tickLine={false}
                axisLine={false}
                interval={compact ? 3 : isMobile ? 2 : 'preserveStartEnd'}
                dy={8}
              />

              {/* Y Axis */}
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={compact ? 9 : isMobile ? 10 : 11}
                width={compact ? 30 : isMobile ? 35 : 45}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatter}
                dx={-5}
              />

              {/* Tooltip */}
              <Tooltip
                content={<CustomTooltip formatter={formatter} />}
                cursor={{
                  stroke: 'var(--primary)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              {/* Area with Gradient */}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${uniqueGradientId})`}
                dot={false}
                activeDot={{
                  r: compact ? 3 : isMobile ? 4 : 5,
                  stroke: color,
                  strokeWidth: 2,
                  fill: 'var(--background)',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// MULTI-LINE CHART VARIANT
// ============================================

interface MultiLineChartProps {
  title: string;
  data: MetricsSnapshot[];
  lines: Array<{
    dataKey: string;
    color: string;
    name: string;
  }>;
  formatter?: (value: number) => string;
  className?: string;
}

export function MultiLineMetricsChart({
  title,
  data,
  lines,
  formatter,
  className,
}: MultiLineChartProps) {
  const isMobile = useIsMobile();
  const safeData = data || [];

  const chartData = safeData.map((snapshot) => {
    const time = new Date(snapshot.timestamp);
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');

    const dataPoint: Record<string, string | number> = { time: timeStr };

    for (const line of lines) {
      const keys = line.dataKey.split('.');
      let value: unknown = snapshot;
      for (const key of keys) {
        value = (value as Record<string, unknown>)[key];
      }
      dataPoint[line.dataKey] = typeof value === 'number' ? value : 0;
    }

    return dataPoint;
  });

  const chartHeight = isMobile ? 200 : 280;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pb-4">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 10,
                left: -10,
                bottom: 0,
              }}
            >
              <defs>
                {lines.map((line, index) => (
                  <linearGradient
                    key={line.dataKey}
                    id={`gradient-multi-${index}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={line.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                strokeOpacity={0.5}
                vertical={false}
              />

              <XAxis
                dataKey="time"
                stroke="var(--muted-foreground)"
                fontSize={isMobile ? 10 : 11}
                tickLine={false}
                axisLine={false}
                interval={isMobile ? 2 : 'preserveStartEnd'}
                dy={8}
              />

              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={isMobile ? 10 : 11}
                width={isMobile ? 35 : 45}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatter}
                dx={-5}
              />

              <Tooltip
                content={<CustomTooltip formatter={formatter} />}
                cursor={{
                  stroke: 'var(--primary)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              {lines.map((line, index) => (
                <Area
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  fill={`url(#gradient-multi-${index})`}
                  dot={false}
                  activeDot={{
                    r: isMobile ? 4 : 5,
                    stroke: line.color,
                    strokeWidth: 2,
                    fill: 'var(--background)',
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4">
            {lines.map((line) => (
              <div key={line.dataKey} className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                <span className="text-xs text-muted-foreground">{line.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// MINI CHART (for cards)
// ============================================

interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function MiniChart({
  data,
  color = 'var(--chart-1)',
  height = 40,
  className,
}: MiniChartProps) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  const gradientId = `mini-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MetricsChart;
