'use client';

import { Rocket, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

interface Deployment {
  id: string;
  projectName: string;
  projectId: string;
  status: string;
  duration: number | null;
  commitAfter: string | null;
  createdAt: string;
  userName: string;
}

const statusConfig: Record<string, { variant: any; label: string }> = {
  SUCCESS: { variant: 'success', label: 'OK' },
  FAILED: { variant: 'destructive', label: 'Fallito' },
  PENDING: { variant: 'default', label: 'In attesa' },
  GIT_PULLING: { variant: 'info', label: 'Git' },
  BUILDING: { variant: 'info', label: 'Build' },
  DEPLOYING: { variant: 'info', label: 'Deploy' },
  HEALTH_CHECK: { variant: 'info', label: 'Check' },
};

export function RecentDeployments({ deployments }: { deployments: Deployment[] }) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="glass border-border/50 h-full">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Deploy Recenti</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {deployments.length > 0 ? (
            <div className="space-y-2">
              {deployments.map((deploy, index) => {
                const sc = statusConfig[deploy.status] || { variant: 'default', label: deploy.status };
                return (
                  <motion.div
                    key={deploy.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={`/dashboard/projects/${deploy.projectId}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate text-sm group-hover:text-primary transition-colors">
                            {deploy.projectName}
                          </p>
                          <Badge variant={sc.variant} className="text-xs flex-shrink-0">
                            {sc.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {deploy.userName} &middot;{' '}
                          {formatDistanceToNow(new Date(deploy.createdAt), { addSuffix: true, locale: it })}
                          {deploy.duration != null && ` &middot; ${deploy.duration}s`}
                        </p>
                      </div>
                      {deploy.commitAfter && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                          {deploy.commitAfter.substring(0, 7)}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Rocket className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessun deploy recente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
