'use client';

import { useEffect } from 'react';
import { useMonitoringStore } from '@/store/monitoringStore';
import { useProjectsStore } from '@/store/projectsStore';
import { useDatabasesStore } from '@/store/databasesStore';
import { useDomainsStore } from '@/store/domainsStore';
import { useContainersStore } from '@/store/containersStore';
import { useAuthStore } from '@/store/authStore';
import { MetricsChart } from '@/components/dashboard/MetricsChart';
import { StatsCard, StatsCardSkeleton } from '@/components/dashboard/StatsCard';
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
  Loader2,
  Plus,
  ChevronRight,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp, cardHover } from '@/lib/motion';
import { cn } from '@/lib/utils';

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

function ResourceCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  isHealthy,
  colorScheme,
}: ResourceCardProps) {
  const colors = {
    blue: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      bar: 'bg-primary',
      glow: 'glow-primary',
    },
    green: {
      bg: 'bg-success/10',
      text: 'text-success',
      bar: 'bg-success',
      glow: 'glow-success',
    },
    purple: {
      bg: 'bg-accent/10',
      text: 'text-accent-foreground',
      bar: 'bg-purple-500',
      glow: '',
    },
    amber: {
      bg: 'bg-warning/10',
      text: 'text-warning',
      bar: 'bg-warning',
      glow: 'glow-warning',
    },
    red: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      bar: 'bg-destructive',
      glow: 'glow-error',
    },
  };

  const color = isHealthy ? colors[colorScheme] : colors.red;

  return (
    <motion.div variants={fadeInUp}>
      <Card className={cn(
        'relative overflow-hidden transition-all duration-200 glass border-border/50',
        !isHealthy && 'border-destructive/50'
      )}>
        <CardContent className="p-5">
          {/* Header */}
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

          {/* Value */}
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

          {/* Progress bar */}
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

function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  colorScheme,
}: QuickStatProps) {
  const colors = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-success/10 text-success',
    purple: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
    amber: 'bg-warning/10 text-warning',
  };

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
              <div className={cn('p-2.5 rounded-xl', colors[colorScheme])}>
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

// ============================================
// MAIN DASHBOARD
// ============================================

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    currentMetrics,
    metricsHistory,
    isLoading,
    fetchCurrentMetrics,
    fetchMetricsHistory,
  } = useMonitoringStore();

  const { projects, fetchProjects } = useProjectsStore();
  const { databases, fetchDatabases } = useDatabasesStore();
  const { domains, fetchDomains } = useDomainsStore();
  const { containers, fetchContainers } = useContainersStore();

  useEffect(() => {
    fetchCurrentMetrics();
    fetchMetricsHistory(24);
    fetchProjects();
    fetchDatabases();
    fetchDomains();
    fetchContainers(true);

    const interval = setInterval(() => {
      fetchCurrentMetrics();
      fetchProjects();
      fetchContainers(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Loading state
  if (isLoading && !currentMetrics) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-muted rounded-full animate-pulse" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const safeProjects = projects || [];
  const safeContainers = containers || [];
  const safeDomains = domains || [];
  const safeDatabases = databases || [];

  const runningProjects = safeProjects.filter((p) => p.status === 'ACTIVE').length;
  const runningContainers = safeContainers.filter((c) => c.State === 'running').length;

  // System status check
  const cpuOk = currentMetrics ? currentMetrics.cpu < 80 : true;
  const memOk = currentMetrics ? currentMetrics.memory.percentage < 80 : true;
  const diskOk = currentMetrics ? currentMetrics.disk.percentage < 90 : true;
  const systemHealthy = cpuOk && memOk && diskOk;

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

        {/* System Status Badge */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Badge
            className={cn(
              'px-4 py-2 text-sm font-medium gap-2',
              systemHealthy
                ? 'badge-success'
                : 'badge-warning'
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

      {/* Quick Stats Row */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
      >
        <QuickStatCard
          title="Progetti"
          value={safeProjects.length}
          subtitle={`${runningProjects} attivi`}
          icon={FolderGit2}
          href="/dashboard/projects"
          colorScheme="blue"
        />

        <QuickStatCard
          title="Container"
          value={safeContainers.length}
          subtitle={`${runningContainers} in esecuzione`}
          icon={Container}
          href="/dashboard/containers"
          colorScheme="green"
        />

        <QuickStatCard
          title="Database"
          value={safeDatabases.length}
          icon={Database}
          href="/dashboard/databases"
          colorScheme="purple"
        />

        <QuickStatCard
          title="Domini"
          value={safeDomains.length}
          icon={Globe}
          href="/dashboard/domains"
          colorScheme="amber"
        />
      </motion.div>

      {/* Charts and Projects Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Chart */}
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
                {safeProjects.slice(0, 5).map((project, index) => (
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

                {safeProjects.length === 0 && (
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
                {
                  label: 'Nuovo Progetto',
                  icon: FolderGit2,
                  href: '/dashboard/projects',
                  color: 'text-primary',
                },
                {
                  label: 'Nuovo Database',
                  icon: Database,
                  href: '/dashboard/databases',
                  color: 'text-purple-500',
                },
                {
                  label: 'Aggiungi Dominio',
                  icon: Globe,
                  href: '/dashboard/domains',
                  color: 'text-warning',
                },
                {
                  label: 'Monitoraggio',
                  icon: Activity,
                  href: '/dashboard/monitoring',
                  color: 'text-success',
                },
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
