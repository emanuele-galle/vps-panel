'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, RefreshCw, Search, Filter, Database as DatabaseIcon, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatabaseCard } from '@/components/dashboard/DatabaseCard';
import { CreateDatabaseModal } from '@/components/dashboard/CreateDatabaseModal';
import { ErrorState } from '@/components/ui/error-state';
import { useDatabasesStore } from '@/store/databasesStore';
import { useProjectsStore } from '@/store/projectsStore';
import { DatabaseType, Database } from '@/types';

export default function DatabasesPage() {
  const { databases, isLoading, error, fetchDatabases } = useDatabasesStore();
  const { projects, fetchProjects } = useProjectsStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'project' | 'none'>('project');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('name-asc');

  useEffect(() => {
    fetchDatabases();
    fetchProjects();
  }, [fetchDatabases, fetchProjects]);

  const handleRefresh = () => {
    const filters: { projectId?: string; type?: DatabaseType } = {};
    if (projectFilter) filters.projectId = projectFilter;
    if (typeFilter) filters.type = typeFilter as DatabaseType;
    fetchDatabases(filters);
  };

  const handleFilterChange = (project: string, type: string) => {
    setProjectFilter(project);
    setTypeFilter(type);

    const filters: { projectId?: string; type?: DatabaseType } = {};
    if (project) filters.projectId = project;
    if (type) filters.type = type as DatabaseType;
    fetchDatabases(filters);
  };

  const filteredDatabases = databases
    .filter((database) => {
      const matchesSearch =
        searchQuery === '' ||
        database.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        database.databaseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        database.project?.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'type': return a.type.localeCompare(b.type);
        case 'project': return (a.project?.name || 'zzz').localeCompare(b.project?.name || 'zzz');
        default: return 0;
      }
    });

  // Count by type
  const countByType = {
    MYSQL: databases.filter((d) => d.type === 'MYSQL').length,
    POSTGRESQL: databases.filter((d) => d.type === 'POSTGRESQL').length,
    MONGODB: databases.filter((d) => d.type === 'MONGODB').length,
    REDIS: databases.filter((d) => d.type === 'REDIS').length,
    SQLITE: databases.filter((d) => d.type === 'SQLITE').length,
  };

  // Raggruppa i database per progetto
  const groupedDatabases = useMemo(() => {
    const groups: Record<string, { databases: Database[]; projectSlug?: string }> = {};

    filteredDatabases.forEach((database) => {
      const groupName = database.project?.name || 'Non associati';
      const projectSlug = database.project?.slug;

      if (!groups[groupName]) {
        groups[groupName] = { databases: [], projectSlug };
      }
      groups[groupName].databases.push(database);
    });

    // Ordina: prima i progetti con slug (alfabeticamente), poi "Non associati"
    return Object.entries(groups).sort(([a, dataA], [b, dataB]) => {
      if (a === 'Non associati') return 1;
      if (b === 'Non associati') return -1;
      return a.localeCompare(b);
    });
  }, [filteredDatabases]);

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

  const projectGroupsCount = groupedDatabases.filter(([name]) => name !== 'Non associati').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Database
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci i database per i tuoi progetti
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Aggiorna
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Database
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Totale</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {databases.length}
              </p>
            </div>
            <DatabaseIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-primary/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary">MySQL</p>
              <p className="text-2xl font-bold text-primary mt-1">
                {countByType.MYSQL}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">MY</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-success/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-success">PostgreSQL</p>
              <p className="text-2xl font-bold text-success mt-1">
                {countByType.POSTGRESQL}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-success/15 flex items-center justify-center">
              <span className="text-sm font-bold text-success">PG</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-emerald-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">MongoDB</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {countByType.MONGODB}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">MG</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-destructive/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-destructive">Redis</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {countByType.REDIS}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <span className="text-sm font-bold text-destructive">RD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={projectFilter}
              onChange={(e) => handleFilterChange(e.target.value, typeFilter)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tutti i Progetti</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => handleFilterChange(projectFilter, e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tutti i Tipi</option>
              <option value="MYSQL">MySQL</option>
              <option value="POSTGRESQL">PostgreSQL</option>
              <option value="MONGODB">MongoDB</option>
              <option value="REDIS">Redis</option>
              <option value="SQLITE">SQLite</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="name-asc">Nome A-Z</option>
              <option value="name-desc">Nome Z-A</option>
              <option value="type">Tipo</option>
              <option value="project">Progetto</option>
            </select>
          </div>
        </div>

        {/* Group Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="groupByProject"
            checked={groupBy === 'project'}
            onChange={(e) => setGroupBy(e.target.checked ? 'project' : 'none')}
            className="rounded border-border"
          />
          <label
            htmlFor="groupByProject"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Raggruppa per progetto
          </label>
        </div>

        {/* Active Filters Info */}
        {(projectFilter || typeFilter) && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filtri applicati</span>
            <button
              onClick={() => handleFilterChange('', '')}
              className="ml-2 text-primary hover:underline"
            >
              Pulisci filtri
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <ErrorState
          title="Errore nel caricamento dei database"
          message={error}
          onRetry={handleRefresh}
          variant="card"
        />
      )}

      {/* Loading State */}
      {isLoading && !databases.length && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-blue-600"></div>
          <p className="text-muted-foreground mt-4">
            Caricamento database...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredDatabases.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <div className="mx-auto h-16 w-16 text-muted-foreground mb-4">
            <DatabaseIcon className="h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery || projectFilter || typeFilter
              ? 'Nessun database trovato'
              : 'Nessun database ancora'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || projectFilter || typeFilter
              ? 'Prova a regolare la ricerca o i filtri'
              : 'Crea il tuo primo database per iniziare'}
          </p>
          {!searchQuery && !projectFilter && !typeFilter && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crea il Tuo Primo Database
            </Button>
          )}
        </div>
      )}

      {/* Databases Grid - Normal View */}
      {!isLoading && filteredDatabases.length > 0 && groupBy === 'none' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDatabases.map((database) => (
            <DatabaseCard key={database.id} database={database} />
          ))}
        </div>
      )}

      {/* Databases Grid - Grouped by Project */}
      {!isLoading && filteredDatabases.length > 0 && groupBy === 'project' && (
        <div className="space-y-6">
          {groupedDatabases.map(([groupName, { databases: groupDatabases, projectSlug }]) => {
            const isCollapsed = collapsedGroups.has(groupName);
            const isUnassociated = groupName === 'Non associati';

            // Count types in this group
            const typesInGroup = {
              mysql: groupDatabases.filter(d => d.type === 'MYSQL').length,
              postgresql: groupDatabases.filter(d => d.type === 'POSTGRESQL').length,
              mongodb: groupDatabases.filter(d => d.type === 'MONGODB').length,
              redis: groupDatabases.filter(d => d.type === 'REDIS').length,
            };

            return (
              <div
                key={groupName}
                className={`bg-card rounded-lg border ${
                  isUnassociated
                    ? 'border-border'
                    : 'border-purple-200 dark:border-purple-800'
                } overflow-hidden`}
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className={`w-full px-4 py-3 flex items-center justify-between ${
                    isUnassociated
                      ? 'bg-muted/50/50'
                      : 'bg-purple-50 dark:bg-purple-900/30'
                  } hover:bg-opacity-80 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    <FolderOpen className={`h-5 w-5 ${
                      isUnassociated ? 'text-muted-foreground' : 'text-purple-600 dark:text-purple-400'
                    }`} />
                    <span className="font-semibold text-foreground">
                      {groupName}
                    </span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${
                      isUnassociated
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                    }`}>
                      {groupDatabases.length} database
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {typesInGroup.postgresql > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">PG {typesInGroup.postgresql}</span>
                    )}
                    {typesInGroup.mysql > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">MY {typesInGroup.mysql}</span>
                    )}
                    {typesInGroup.mongodb > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">MG {typesInGroup.mongodb}</span>
                    )}
                    {typesInGroup.redis > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">RD {typesInGroup.redis}</span>
                    )}
                  </div>
                </button>

                {/* Group Content */}
                {!isCollapsed && (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupDatabases.map((database) => (
                        <DatabaseCard key={database.id} database={database} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredDatabases.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Visualizzazione di {filteredDatabases.length} su {databases.length} database
        </div>
      )}

      {/* Create Database Modal */}
      <CreateDatabaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchDatabases();
        }}
      />
    </div>
  );
}
