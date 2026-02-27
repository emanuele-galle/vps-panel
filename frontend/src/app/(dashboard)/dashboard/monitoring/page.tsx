'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  HardDrive,
  Activity,
  Network,
  RefreshCw,
  Server,
  Container as ContainerIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricsCard } from '@/components/monitoring/MetricsCard';
import dynamic from 'next/dynamic';

// Lazy load charts (heavy recharts bundle, below the fold)
const ResourceUsageChart = dynamic(
  () => import('@/components/monitoring/ResourceUsageChart').then((m) => ({ default: m.ResourceUsageChart })),
  {
    ssr: false,
    loading: () => (
      <div className="glass rounded-xl border border-border/50 p-6 h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Caricamento grafico...</div>
      </div>
    ),
  }
);
import { DiskStoragePanel } from '@/components/monitoring/DiskStoragePanel';
import { useMonitoringStore } from '@/store/monitoringStore';
import { staggerContainer, fadeInUp } from '@/lib/motion';

export default function MonitoringPage() {
  const {
    currentMetrics,
    metricsHistory,
    isLoading,
    error,
    fetchCurrentMetrics,
    fetchMetricsHistory,
  } = useMonitoringStore();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  useEffect(() => {
    fetchCurrentMetrics();
    fetchMetricsHistory(24);
  }, [fetchCurrentMetrics, fetchMetricsHistory]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchCurrentMetrics();
      fetchMetricsHistory(24);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchCurrentMetrics, fetchMetricsHistory]);

  const handleRefresh = () => {
    fetchCurrentMetrics();
    fetchMetricsHistory(24);
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatBytesPerSecond = (bytes: number) => {
    return formatBytes(bytes) + '/s';
  };

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Monitoraggio Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Metriche di sistema in tempo reale e monitoraggio delle prestazioni
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border bg-background text-primary focus:ring-primary"
            />
            <label
              htmlFor="autoRefresh"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Aggiornamento automatico
            </label>
          </div>

          {/* Refresh Interval */}
          <AnimatePresence>
            {autoRefresh && (
              <motion.select
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm px-2 py-1 border border-border rounded bg-background text-foreground"
              >
                <option value="5000">5s</option>
                <option value="10000">10s</option>
                <option value="30000">30s</option>
                <option value="60000">60s</option>
              </motion.select>
            )}
          </AnimatePresence>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
              Aggiorna
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl"
          >
            <p className="font-medium">Errore nel caricamento delle metriche</p>
            <p className="text-sm mt-1 opacity-80">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && !currentMetrics && (
        <motion.div
          variants={fadeInUp}
          className="text-center py-12"
        >
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-primary"></div>
          <p className="text-muted-foreground mt-4">
            Caricamento metriche...
          </p>
        </motion.div>
      )}

      {/* Metrics Cards */}
      {currentMetrics && (
        <>
          <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CPU Usage */}
            <MetricsCard
              title="Utilizzo CPU"
              value={`${currentMetrics.cpu.toFixed(1)}%`}
              icon={Cpu}
              iconColor="text-primary"
              percentage={currentMetrics.cpu}
              showProgressBar
              progressColor="bg-primary"
            />

            {/* Memory Usage */}
            <MetricsCard
              title="Memoria"
              value={formatBytes(currentMetrics.memory.used)}
              subtitle={`di ${formatBytes(currentMetrics.memory.total)}`}
              icon={Activity}
              iconColor="text-success"
              percentage={currentMetrics.memory.percentage}
              showProgressBar
              progressColor="bg-success"
            />

            {/* Disk Usage */}
            <MetricsCard
              title="Spazio Disco"
              value={formatBytes(currentMetrics.disk.used)}
              subtitle={`di ${formatBytes(currentMetrics.disk.total)}`}
              icon={HardDrive}
              iconColor="text-accent"
              percentage={currentMetrics.disk.percentage}
              showProgressBar
              progressColor="bg-accent"
            />

            {/* Network */}
            <MetricsCard
              title="Rete"
              value={formatBytesPerSecond(currentMetrics.network.transmitted)}
              subtitle={`↓ ${formatBytesPerSecond(currentMetrics.network.received)}`}
              icon={Network}
              iconColor="text-warning"
            />
          </motion.div>

          {/* Docker Stats */}
          <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricsCard
              title="Container in Esecuzione"
              value={currentMetrics.docker.containersRunning}
              icon={ContainerIcon}
              iconColor="text-success"
            />

            <MetricsCard
              title="Container Fermati"
              value={currentMetrics.docker.containersStopped}
              icon={ContainerIcon}
              iconColor="text-muted-foreground"
            />

            <MetricsCard
              title="Immagini Docker"
              value={currentMetrics.docker.imagesCount}
              icon={Server}
              iconColor="text-primary"
            />
          </motion.div>

          {/* Historical Charts */}
          <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU & Memory Chart */}
            <ResourceUsageChart
              title="Utilizzo CPU e Memoria (24h)"
              data={metricsHistory}
              lines={[
                { dataKey: 'cpu', name: 'CPU', color: 'var(--primary)' },
                {
                  dataKey: 'memory.percentage',
                  name: 'Memoria',
                  color: 'var(--success)',
                },
              ]}
            />

            {/* Disk Usage Chart */}
            <ResourceUsageChart
              title="Utilizzo Disco (24h)"
              data={metricsHistory}
              lines={[
                { dataKey: 'disk.percentage', name: 'Disco', color: 'var(--accent)' },
              ]}
            />
          </motion.div>

          {/* Network Traffic Chart */}
          <motion.div variants={fadeInUp}>
            <ResourceUsageChart
              title="Traffico Rete (24h)"
              data={metricsHistory.map((m) => ({
                ...m,
                networkReceived: (m.network.received / 1024 / 1024).toFixed(2),
                networkTransmitted: (m.network.transmitted / 1024 / 1024).toFixed(
                  2
                ),
              }))}
              lines={[
                {
                  dataKey: 'networkReceived',
                  name: 'Ricevuti (MB)',
                  color: 'var(--success)',
                },
                {
                  dataKey: 'networkTransmitted',
                  name: 'Trasmessi (MB)',
                  color: 'var(--warning)',
                },
              ]}
              yAxisLabel="Traffico (MB)"
              height={250}
            />
          </motion.div>

          {/* System Info */}
          <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-xl border border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Informazioni CPU
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Utilizzo Corrente
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {currentMetrics.cpu.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Stato
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      currentMetrics.cpu > 80
                        ? 'text-destructive'
                        : currentMetrics.cpu > 60
                        ? 'text-warning'
                        : 'text-success'
                    }`}
                  >
                    {currentMetrics.cpu > 80
                      ? 'Alto'
                      : currentMetrics.cpu > 60
                      ? 'Medio'
                      : 'Normale'}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl border border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Informazioni Memoria
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Totale
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatBytes(currentMetrics.memory.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Usata
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatBytes(currentMetrics.memory.used)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Libera
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatBytes(currentMetrics.memory.free)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Disk Storage Details */}
          <motion.div variants={fadeInUp} className="mt-8 pt-8 border-t border-border/50">
            <DiskStoragePanel />
          </motion.div>

          {/* Last Updated */}
          <motion.div
            variants={fadeInUp}
            className="glass rounded-xl border border-border/50 p-4 text-center text-sm text-muted-foreground"
          >
            <span className="status-dot status-dot-healthy status-dot-pulse mr-2" />
            Ultimo aggiornamento:{' '}
            {new Date(currentMetrics.timestamp).toLocaleString('it-IT', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
            {autoRefresh && (
              <span className="ml-2">
                • Aggiornamento automatico ogni {refreshInterval / 1000}s
              </span>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
