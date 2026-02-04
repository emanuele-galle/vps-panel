'use client';

import { Shield, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

interface SystemHealthProps {
  status: 'healthy' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  disk: number;
  containersRunning: number;
  containersTotal: number;
}

export function SystemHealthCard({ health }: { health: SystemHealthProps | null }) {
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
