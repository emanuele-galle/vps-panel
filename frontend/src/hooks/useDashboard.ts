'use client';

import { useEffect, useState } from 'react';
import { useMonitoringStore } from '@/store/monitoringStore';
import { useProjectsStore } from '@/store/projectsStore';
import { useDatabasesStore } from '@/store/databasesStore';
import { useDomainsStore } from '@/store/domainsStore';
import { useContainersStore } from '@/store/containersStore';
import { monitoringApi } from '@/lib/api';
import { notificationsApi } from '@/lib/notifications-api';

export function useDashboard() {
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

  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, notifsRes] = await Promise.all([
        monitoringApi.getDashboardSummary(),
        notificationsApi.getAll({ limit: 5, unreadOnly: false }),
      ]);
      setDashboardSummary(summaryRes.data?.data || null);
      setRecentNotifications(notifsRes.data?.data?.notifications || notifsRes.data?.data || []);
      setLastUpdated(new Date());
    } catch {
      // Silently fail - dashboard summary is optional
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentMetrics();
    fetchMetricsHistory(24);
    fetchProjects();
    fetchDatabases();
    fetchDomains();
    fetchContainers(true);
    fetchDashboardData();

    const interval = setInterval(() => {
      fetchCurrentMetrics();
      fetchProjects();
      fetchContainers(true);
      fetchDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const safeProjects = projects || [];
  const safeContainers = containers || [];
  const safeDomains = domains || [];
  const safeDatabases = databases || [];

  const runningProjects = safeProjects.filter((p) => p.status === 'ACTIVE').length;
  const runningContainers = safeContainers.filter((c) => c.State === 'running').length;

  const cpuOk = currentMetrics ? currentMetrics.cpu < 80 : true;
  const memOk = currentMetrics ? currentMetrics.memory.percentage < 80 : true;
  const diskOk = currentMetrics ? currentMetrics.disk.percentage < 90 : true;
  const systemHealthy = cpuOk && memOk && diskOk;

  return {
    // Metrics
    currentMetrics,
    metricsHistory,
    isLoading,
    // Entities
    projects: safeProjects,
    containers: safeContainers,
    domains: safeDomains,
    databases: safeDatabases,
    // Computed
    runningProjects,
    runningContainers,
    cpuOk,
    memOk,
    diskOk,
    systemHealthy,
    // Dashboard extra
    dashboardSummary,
    recentNotifications,
    lastUpdated,
    dashboardLoading,
  };
}
