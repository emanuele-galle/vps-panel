'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Search, RefreshCw, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { ProjectDiscovery } from '@/components/dashboard/ProjectDiscovery';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { useProjectsStore } from '@/store/projectsStore';
import { PageLoader, GridSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyProjects, EmptySearch } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { staggerContainer, staggerContainerFast, fadeInUp } from '@/lib/motion';

export default function ProjectsPage() {
  const { projects, isLoading, error, fetchProjects } = useProjectsStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [templateFilter, setTemplateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name-asc');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleRefresh = () => {
    const filters: { status?: string; template?: string } = {};
    if (statusFilter) filters.status = statusFilter;
    if (templateFilter) filters.template = templateFilter;
    fetchProjects(filters);
  };

  const handleFilterChange = (status: string, template: string) => {
    setStatusFilter(status);
    setTemplateFilter(template);

    const filters: { status?: string; template?: string } = {};
    if (status) filters.status = status;
    if (template) filters.template = template;
    fetchProjects(filters);
  };

  const filteredProjects = projects
    .filter((project) => {
      const matchesSearch =
        searchQuery === '' ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'status': {
          const order: Record<string, number> = { ACTIVE: 0, BUILDING: 1, ERROR: 2, INACTIVE: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        }
        case 'created': return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default: return 0;
      }
    });

  const hasActiveFilters = searchQuery || statusFilter || templateFilter;

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
            Progetti
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci tutti i tuoi progetti e deployment
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Progetto
          </Button>
        </motion.div>
      </motion.div>

      {/* Project Discovery (ADMIN only) */}
      <motion.div variants={fadeInUp}>
        <ProjectDiscovery />
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        variants={fadeInUp}
        className="glass rounded-xl border border-border/50 p-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca progetti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value, templateFilter)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Tutti gli Stati</option>
              <option value="ACTIVE">Attivo</option>
              <option value="INACTIVE">Inattivo</option>
              <option value="BUILDING">In Costruzione</option>
              <option value="ERROR">Errore</option>
            </select>
          </div>

          {/* Template Filter */}
          <div>
            <select
              value={templateFilter}
              onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Tutti i Template</option>
              <option value="WORDPRESS">WordPress</option>
              <option value="NODEJS">Node.js</option>
              <option value="NEXTJS">Next.js</option>
              <option value="REACT">React</option>
              <option value="LARAVEL">Laravel</option>
              <option value="PYTHON">Python</option>
              <option value="STATIC">Static HTML</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="name-asc">Nome A-Z</option>
              <option value="name-desc">Nome Z-A</option>
              <option value="status">Stato</option>
              <option value="created">Più recenti</option>
            </select>
          </div>
        </div>

        {/* Active Filters Info */}
        <AnimatePresence>
          {(statusFilter || templateFilter) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Filter className="h-4 w-4" />
              <span>
                Filtrando per:
                {statusFilter && <span className="ml-2 font-medium text-primary">{statusFilter}</span>}
                {templateFilter && <span className="ml-2 font-medium text-accent">{templateFilter}</span>}
              </span>
              <button
                onClick={() => handleFilterChange('', '')}
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
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ErrorState
              title="Errore nel caricamento dei progetti"
              message={error}
              onRetry={handleRefresh}
              variant="card"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && !projects.length && (
        <motion.div variants={fadeInUp}>
          <GridSkeleton count={6} columns={3} />
        </motion.div>
      )}

      {/* Empty State */}
      <AnimatePresence>
        {!isLoading && !error && filteredProjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass rounded-xl border border-border/50"
          >
            {hasActiveFilters ? (
              <EmptySearch query={searchQuery || statusFilter || templateFilter} />
            ) : (
              <EmptyProjects onAdd={() => setIsCreateModalOpen(true)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects Grid */}
      {!isLoading && filteredProjects.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainerFast}
        >
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                variants={fadeInUp}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <ProjectCard project={project} />
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredProjects.length > 0 && (
        <motion.div
          variants={fadeInUp}
          className="text-sm text-muted-foreground text-center flex items-center justify-center gap-4"
        >
          <span>
            Visualizzazione di {filteredProjects.length} su {projects.length} progett
            {projects.length !== 1 ? 'i' : 'o'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Aggiorna
          </Button>
        </motion.div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchProjects();
        }}
      />
    </motion.div>
  );
}
