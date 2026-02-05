'use client';

import { Shield, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { Skeleton } from '@/components/ui/skeleton';

interface SystemHealthProps {
  status: 'healthy' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  disk: number;
  containersRunning: number;
  containersTotal: number;
}

export function SystemHealthCardSkeleton() {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="glass border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function SystemHealthCard({ health, isLoading }: { health: SystemHealthProps | null; isLoading?: boolean }) {
  if (isLoading) return <SystemHealthCardSkeleton />;
  if (!health) return null;

  const config = {
    healthy: {
      icon: Shield,
      label: 'Sistema Operativo',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      badge: 'badge-success',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Attenzione Risorse',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'badge-warning',
    },
    critical: {
      icon: XCircle,
      label: 'Critico',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      badge: 'bg-destructive text-destructive-foreground',
    },
  };

  const c = config[health.status];
  const Icon = c.icon;

  return (
    <motion.div variants={fadeInUp}>
      <Card className={cn('glass border-border/50', c.border)}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', c.bg)}>
                <Icon className={cn('h-5 w-5', c.color)} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{c.label}</p>
                <p className="text-sm text-muted-foreground">
                  {health.containersRunning}/{health.containersTotal} container attivi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">CPU</span>
                  <Badge variant="outline" className="font-mono text-xs">{health.cpu}%</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">RAM</span>
                  <Badge variant="outline" className="font-mono text-xs">{health.memory}%</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Disco</span>
                  <Badge variant="outline" className="font-mono text-xs">{health.disk}%</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
