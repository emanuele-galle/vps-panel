'use client';

import { useAuthStore } from '@/store/authStore';
import { useDashboard } from '@/hooks/useDashboard';
import { MetricsChart } from '@/components/dashboard/MetricsChart';
import { StatsCardSkeleton } from '@/components/dashboard/StatsCard';
import { SystemHealthCard } from '@/components/dashboard/SystemHealthCard';
import { RecentDeployments } from '@/components/dashboard/RecentDeployments';
import { RecentNotifications } from '@/components/dashboard/RecentNotifications';
import { ResourceCard, QuickStatCard } from '@/components/dashboard/ResourceCards';
import { formatBytes } from '@/lib/utils';
import {
  Cpu,
  HardDrive,
  Container,
  FolderGit2,
  Database,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  Zap,
  Clock,
  ChevronRight,
  Wrench,
  Shield,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    currentMetrics,
    metricsHistory,
    isLoading,
    projects,
    containers,
    domains,
    databases,
    runningProjects,
    runningContainers,
    cpuOk,
    memOk,
    diskOk,
    systemHealthy,
    dashboardSummary,
    recentNotifications,
    lastUpdated,
    dashboardLoading,
  } = useDashboard();

  // Loading state
  if (isLoading && !currentMetrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        variants={fadeInUp}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Benvenuto, {user?.email?.split('@')[0] || 'Admin'}. Ecco lo stato del tuo server.
          </p>
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Badge
            className={cn(
              'px-4 py-2 text-sm font-medium gap-2',
              systemHealthy ? 'badge-success' : 'badge-warning'
            )}
          >
            {systemHealthy ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Sistema Operativo
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Attenzione Risorse
              </>
            )}
          </Badge>
        </motion.div>
      </motion.div>

      {/* Resource Metrics Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
      >
        <ResourceCard
          title="CPU"
          value={currentMetrics?.cpu || 0}
          unit="%"
          icon={Cpu}
          isHealthy={cpuOk}
          colorScheme="blue"
        />
        <ResourceCard
          title="Memoria RAM"
          value={currentMetrics?.memory.percentage || 0}
          unit="%"
          subtitle={`${formatBytes(currentMetrics?.memory.used || 0)} / ${formatBytes(currentMetrics?.memory.total || 0)}`}
          icon={Server}
          isHealthy={memOk}
          colorScheme="green"
        />
        <ResourceCard
          title="Disco"
          value={currentMetrics?.disk.percentage || 0}
          unit="%"
          subtitle={`${formatBytes(currentMetrics?.disk.used || 0)} / ${formatBytes(currentMetrics?.disk.total || 0)}`}
          icon={HardDrive}
          isHealthy={diskOk}
          colorScheme="purple"
        />

        {/* Network Card */}
        <motion.div variants={fadeInUp}>
          <Card className="glass border-border/50 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-info/10">
                  <Activity className="h-5 w-5 text-info" />
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Rete</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowDownRight className="h-4 w-4 text-success" />
                    <span className="text-muted-foreground">Download</span>
                  </div>
                  <span className="font-medium">
                    {formatBytes(currentMetrics?.network?.received || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Upload</span>
                  </div>
                  <span className="font-medium">
                    {formatBytes(currentMetrics?.network?.transmitted || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Last Updated Timestamp */}
      {lastUpdated && (
        <motion.div variants={fadeInUp} className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Aggiornato {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: it })}</span>
        </motion.div>
      )}

      {/* System Health Summary */}
      <SystemHealthCard health={dashboardSummary?.systemHealth || null} isLoading={dashboardLoading} />

      {/* Recent Deployments + Notifications */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={staggerContainer}
      >
        <RecentDeployments deployments={dashboardSummary?.recentDeployments || []} isLoading={dashboardLoading} />
        <RecentNotifications notifications={recentNotifications} isLoading={dashboardLoading} />
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
      >
        <QuickStatCard
          title="Progetti"
          value={projects.length}
          subtitle={`${runningProjects} ${runningProjects === 1 ? 'attivo' : 'attivi'}`}
          icon={FolderGit2}
          href="/dashboard/projects"
          colorScheme="blue"
        />
        <QuickStatCard
          title="Container"
          value={containers.length}
          subtitle={`${runningContainers} in esecuzione`}
          icon={Container}
          href="/dashboard/containers"
          colorScheme="green"
        />
        <QuickStatCard
          title="Database"
          value={databases.length}
          icon={Database}
          href="/dashboard/databases"
          colorScheme="purple"
        />
        <QuickStatCard
          title="Domini"
          value={domains.length}
          icon={Globe}
          href="/dashboard/domains"
          colorScheme="amber"
        />
      </motion.div>

      {/* Charts and Projects Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div className="lg:col-span-2" variants={fadeInUp}>
          <MetricsChart
            title="Utilizzo CPU (24h)"
            data={metricsHistory || []}
            dataKey="cpu"
            color="var(--chart-1)"
            formatter={(v) => `${Number(v || 0).toFixed(0)}%`}
          />
        </motion.div>

        {/* Recent Projects */}
        <motion.div variants={fadeInUp}>
          <Card className="glass border-border/50 h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Progetti Recenti
              </CardTitle>
              <Link href="/dashboard/projects">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1">
                  Tutti
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                {projects.slice(0, 5).map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full flex-shrink-0',
                            project.status === 'ACTIVE'
                              ? 'status-dot-healthy status-dot-pulse'
                              : 'status-dot-neutral'
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {project.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {project.template}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'text-xs',
                          project.status === 'ACTIVE'
                            ? 'badge-success'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {project.status === 'ACTIVE' ? 'Attivo' : 'Fermo'}
                      </Badge>
                    </Link>
                  </motion.div>
                ))}

                {projects.length === 0 && (
                  <div className="text-center py-8">
                    <FolderGit2 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nessun progetto
                    </p>
                    <Link href="/dashboard/projects">
                      <Button variant="link" size="sm" className="mt-2">
                        Crea il primo progetto
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={fadeInUp}>
        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-semibold">
                Azioni Rapide
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Nuovo Progetto', icon: FolderGit2, href: '/dashboard/projects', color: 'text-primary' },
                { label: 'Nuovo Database', icon: Database, href: '/dashboard/databases', color: 'text-purple-500' },
                { label: 'Manutenzione', icon: Wrench, href: '/dashboard/maintenance', color: 'text-warning' },
                { label: 'Monitoraggio', icon: Activity, href: '/dashboard/monitoring', color: 'text-success' },
              ].map((action, index) => (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Link href={action.href}>
                    <Button
                      variant="outline"
                      className="w-full h-auto py-4 flex-col gap-2 hover:bg-accent/50 group"
                    >
                      <action.icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', action.color)} />
                      <span className="text-xs font-medium">{action.label}</span>
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
