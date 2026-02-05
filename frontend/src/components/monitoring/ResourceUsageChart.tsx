'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

interface ResourceUsageChartProps {
  title: string;
  data: any[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
  }[];
  yAxisLabel?: string;
  height?: number;
}

export function ResourceUsageChart({
  title,
  data,
  lines,
  yAxisLabel = 'Utilizzo (%)',
  height = 300,
}: ResourceUsageChartProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-lg shadow-lg p-3 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2">
            {formatTime(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span
                className="text-xs font-medium"
                style={{ color: entry.color }}
              >
                {entry.name}:
              </span>
              <span className="text-xs font-bold" style={{ color: entry.color }}>
                {typeof entry.value === 'number'
                  ? `${entry.value.toFixed(1)}%`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card className="glass border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <h3 className="text-lg font-semibold text-foreground">
            {title}
          </h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <defs>
                {lines.map((line, index) => (
                  <linearGradient
                    key={`gradient-${index}`}
                    id={`gradient-${line.dataKey.replace(/\./g, '-')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={line.color} stopOpacity={0.3} />
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
                dataKey="timestamp"
                tickFormatter={formatTime}
                stroke="var(--muted-foreground)"
                style={{ fontSize: '11px' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: '11px', fill: 'var(--muted-foreground)' },
                }}
                stroke="var(--muted-foreground)"
                style={{ fontSize: '11px' }}
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                iconType="circle"
                iconSize={8}
              />
              {lines.map((line) => (
                <Area
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${line.dataKey.replace(/\./g, '-')})`}
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: line.color,
                    strokeWidth: 2,
                    fill: 'var(--background)',
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
