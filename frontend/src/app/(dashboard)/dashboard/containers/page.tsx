'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Search, Filter, Server, FolderOpen, ChevronRight, Container } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContainerCard } from '@/components/dashboard/ContainerCard';
import { useContainersStore } from '@/store/containersStore';
import { DockerContainer } from '@/types';
import { PageLoader, GridSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyContainers } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { staggerContainer, staggerContainerFast, fadeInUp } from '@/lib/motion';

// Mappa dei path dei progetti ai loro nomi human-readable
const PROJECT_PATH_MAP: Record<string, string> = {
  '/var/www/projects/import-cmidfhb6a0009ip2j1lywo15v': 'SaaS Studio Notarile',
  '/var/www/projects/import-cmi8yujad00015lx5tq0m9rfn': 'Eccellenze Italiane TV',
  '/var/www/projects/import-cmieueg4c0001f0a6de424spp': 'Ristorante Generico',
  '/var/www/projects/maison-rizza': 'Maison Rizza',
};

function getContainerGroup(container: DockerContainer): { group: string; isSystem: boolean } {
  const containerName = container.Names?.[0]?.replace(/^\//, '') || '';
  const name = containerName.toLowerCase();
  const labels = container.Labels || {};

  const composeProject = labels['com.docker.compose.project'] || '';
  if (composeProject === 'vps-panel' || name.startsWith('vps-panel-')) {
    return { group: 'VPS Panel (Sistema)', isSystem: true };
  }

  const workingDir = labels['com.docker.compose.project.working_dir'] || '';
  if (workingDir && PROJECT_PATH_MAP[workingDir]) {
    return { group: PROJECT_PATH_MAP[workingDir], isSystem: false };
  }

  if (composeProject && composeProject.startsWith('import-')) {
    const matchedPath = Object.keys(PROJECT_PATH_MAP).find(path => path.includes(composeProject));
    if (matchedPath) {
      return { group: PROJECT_PATH_MAP[matchedPath], isSystem: false };
    }
  }

  const patterns: Record<string, string> = {
    'eccellenze': 'Eccellenze Italiane TV',
    'maison': 'Maison Rizza',
    'notarile': 'SaaS Studio Notarile',
    'saas_studio': 'SaaS Studio Notarile',
    'ristorante': 'Ristorante Generico',
  };

  for (const [pattern, projectName] of Object.entries(patterns)) {
    if (name.includes(pattern)) {
      return { group: projectName, isSystem: false };
    }
  }

  if (composeProject) {
    return { group: composeProject, isSystem: false };
  }

  return { group: 'Altri Container', isSystem: false };
}

export default function ContainersPage() {
  const { containers, isLoading, error, fetchContainers } = useContainersStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAll, setShowAll] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'group' | 'none'>('group');

  useEffect(() => {
    fetchContainers(showAll);
  }, [fetchContainers, showAll]);

  const handleRefresh = () => {
    fetchContainers(showAll);
  };

  const filteredContainers = containers.filter((container) => {
    const containerName = container.Names?.[0]?.replace(/^\//, '') || '';
    const matchesSearch =
      searchQuery === '' ||
      containerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.Image.toLowerCase().includes(searchQuery.toLowerCase()) ||
      container.Id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === '' ||
      container.State.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const groupedContainers = useMemo(() => {
    const groups: Record<string, { containers: typeof containers; isSystem: boolean }> = {};

    filteredContainers.forEach((container) => {
      const { group, isSystem } = getContainerGroup(container);

      if (!groups[group]) {
        groups[group] = { containers: [], isSystem };
      }
      groups[group].containers.push(container);
    });

    return Object.entries(groups).sort(([a, dataA], [b, dataB]) => {
      if (dataA.isSystem && !dataB.isSystem) return -1;
      if (!dataA.isSystem && dataB.isSystem) return 1;
      return a.localeCompare(b);
    });
  }, [filteredContainers]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const runningCount = containers.filter(
    (c) => c.State.toLowerCase() === 'running'
  ).length;
  const stoppedCount = containers.filter(
    (c) => c.State.toLowerCase() === 'exited' || c.State.toLowerCase() === 'stopped'
  ).length;
  const projectGroupsCount = groupedContainers.filter(([, data]) => !data.isSystem).length;

  const hasActiveFilters = searchQuery || statusFilter;

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
            Container
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci tutti i container Docker sul tuo VPS
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={'h-4 w-4 mr-2 ' + (isLoading ? 'animate-spin' : '')} />
            Aggiorna
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          className="glass rounded-xl border border-border/50 p-4 hover:glow-primary transition-all"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Container Totali</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{containers.length}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Server className="h-6 w-6 text-primary" />
            </div>
          </div>
        </motion.div>
        <motion.div
          className="glass rounded-xl border border-border/50 p-4 hover:glow-success transition-all"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Esecuzione</p>
              <p className="text-2xl font-bold mt-1 text-success">{runningCount}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="glass rounded-xl border border-border/50 p-4 hover:glow-error transition-all"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Fermati</p>
              <p className="text-2xl font-bold mt-1 text-destructive">{stoppedCount}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="glass rounded-xl border border-border/50 p-4 hover:glow-accent transition-all"
          whileHover={{ scale: 1.02, y: -2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gruppi Progetto</p>
              <p className="text-2xl font-bold mt-1 text-accent">{projectGroupsCount}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-accent" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Filters and Search */}
      <motion.div variants={fadeInUp} className="glass rounded-xl border border-border/50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca container per nome, immagine o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Tutti gli Stati</option>
              <option value="running">In Esecuzione</option>
              <option value="exited">Uscito</option>
              <option value="created">Creato</option>
              <option value="paused">In Pausa</option>
              <option value="restarting">Riavvio</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-border bg-background text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Mostra tutti i container (inclusi quelli fermati)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={groupBy === 'group'}
              onChange={(e) => setGroupBy(e.target.checked ? 'group' : 'none')}
              className="rounded border-border bg-background text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Raggruppa per progetto/sistema
            </span>
          </label>
        </div>

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Filter className="h-4 w-4" />
              <span>
                Filtrando:
                {statusFilter && (
                  <span className="ml-2 font-medium text-primary capitalize">{statusFilter}</span>
                )}
                {searchQuery && (
                  <span className="ml-2 font-medium text-accent">Ricerca: "{searchQuery}"</span>
                )}
              </span>
              <button
                onClick={() => {
                  setStatusFilter('');
                  setSearchQuery('');
                }}
                className="ml-2 text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Pulisci filtri
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ErrorState title="Errore nel caricamento dei container" message={error} onRetry={handleRefresh} variant="card" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && !containers.length && (
        <motion.div variants={fadeInUp}>
          <GridSkeleton count={6} columns={3} />
        </motion.div>
      )}

      {/* Empty State */}
      <AnimatePresence>
        {!isLoading && !error && filteredContainers.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass rounded-xl border border-border/50">
            <EmptyContainers />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Containers Grid (no grouping) */}
      {!isLoading && filteredContainers.length > 0 && groupBy === 'none' && (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={staggerContainerFast}>
          <AnimatePresence mode="popLayout">
            {filteredContainers.map((container, index) => (
              <motion.div key={container.Id} variants={fadeInUp} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: index * 0.03 }}>
                <motion.div whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }}>
                  <ContainerCard container={container} />
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Grouped Containers View */}
      {!isLoading && filteredContainers.length > 0 && groupBy === 'group' && (
        <motion.div className="space-y-6" variants={staggerContainerFast}>
          <AnimatePresence>
            {groupedContainers.map(([groupName, { containers: groupContainers, isSystem }], groupIndex) => {
              const isCollapsed = collapsedGroups.has(groupName);
              const runningInGroup = groupContainers.filter(c => c.State.toLowerCase() === 'running').length;

              return (
                <motion.div
                  key={groupName}
                  variants={fadeInUp}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: groupIndex * 0.1 }}
                  className={'glass rounded-xl border overflow-hidden ' + (isSystem ? 'border-primary/30' : 'border-accent/30')}
                >
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className={'w-full px-4 py-3 flex items-center justify-between transition-colors ' + (isSystem ? 'bg-primary/5 hover:bg-primary/10' : 'bg-accent/5 hover:bg-accent/10')}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </motion.div>
                      {isSystem ? (
                        <Server className="h-5 w-5 text-primary" />
                      ) : (
                        <FolderOpen className="h-5 w-5 text-accent" />
                      )}
                      <span className="font-semibold text-foreground">{groupName}</span>
                      <span className={'text-sm px-2 py-0.5 rounded-full ' + (isSystem ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent')}>
                        {groupContainers.length} container
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-success">{runningInGroup} attivi</span>
                    </div>
                  </button>

                  {/* Group Content */}
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="p-4">
                          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" variants={staggerContainerFast} initial="hidden" animate="visible">
                            {groupContainers.map((container, index) => (
                              <motion.div key={container.Id} variants={fadeInUp} transition={{ delay: index * 0.05 }}>
                                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                                  <ContainerCard container={container} />
                                </motion.div>
                              </motion.div>
                            ))}
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredContainers.length > 0 && (
        <motion.div variants={fadeInUp} className="text-sm text-muted-foreground text-center">
          Visualizzazione di {filteredContainers.length} su {containers.length} container
        </motion.div>
      )}
    </motion.div>
  );
}
