'use client';

import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Search, Filter, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DomainCard } from '@/components/dashboard/DomainCard';
import { AddDomainModal } from '@/components/dashboard/AddDomainModal';
import { useDomainsStore } from '@/store/domainsStore';
import { useProjectsStore } from '@/store/projectsStore';

export default function DomainsPage() {
  const { domains, isLoading, error, fetchDomains } = useDomainsStore();
  const { projects, fetchProjects } = useProjectsStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchDomains();
    fetchProjects();
  }, [fetchDomains, fetchProjects]);

  const handleRefresh = () => {
    const filters: { projectId?: string; isActive?: boolean } = {};
    if (projectFilter) filters.projectId = projectFilter;
    if (statusFilter === 'active') filters.isActive = true;
    if (statusFilter === 'inactive') filters.isActive = false;
    fetchDomains(filters);
  };

  const handleFilterChange = (project: string, status: string) => {
    setProjectFilter(project);
    setStatusFilter(status);

    const filters: { projectId?: string; isActive?: boolean } = {};
    if (project) filters.projectId = project;
    if (status === 'active') filters.isActive = true;
    if (status === 'inactive') filters.isActive = false;
    fetchDomains(filters);
  };

  const filteredDomains = domains.filter((domain) => {
    const matchesSearch =
      searchQuery === '' ||
      domain.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      domain.project?.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const activeCount = domains.filter((d) => d.isActive).length;
  const sslCount = domains.filter((d) => d.sslEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Domini
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci domini personalizzati e certificati SSL
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
            />
            Aggiorna
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Dominio
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Domini Totali
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {domains.length}
              </p>
            </div>
            <div className="h-12 w-12 bg-primary/15 rounded-lg flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Attivi</p>
              <p className="text-2xl font-bold text-success mt-1">
                {activeCount}
              </p>
            </div>
            <div className="h-12 w-12 bg-success/15 rounded-lg flex items-center justify-center">
              <svg
                className="h-6 w-6 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                SSL Abilitato
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {sslCount}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <svg
                className="h-6 w-6 text-purple-600 dark:text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca domini..."
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
              onChange={(e) => handleFilterChange(e.target.value, statusFilter)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tutti i Progetti</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(projectFilter, e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tutti gli Stati</option>
              <option value="active">Attivo</option>
              <option value="inactive">Inattivo</option>
            </select>
          </div>
        </div>

        {/* Active Filters Info */}
        {(projectFilter || statusFilter) && (
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
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
          <p className="font-medium">Errore nel caricamento dei domini</p>
          <p className="text-sm mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-2"
          >
            Riprova
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !domains.length && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-blue-600"></div>
          <p className="text-muted-foreground mt-4">Caricamento domini...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredDomains.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <div className="mx-auto h-16 w-16 text-muted-foreground mb-4">
            <Globe className="h-16 w-16" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery || projectFilter || statusFilter
              ? 'Nessun dominio trovato'
              : 'Nessun dominio ancora'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || projectFilter || statusFilter
              ? 'Prova a regolare la ricerca o i filtri'
              : 'Aggiungi il tuo primo dominio personalizzato per iniziare'}
          </p>
          {!searchQuery && !projectFilter && !statusFilter && (
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi il Tuo Primo Dominio
            </Button>
          )}
        </div>
      )}

      {/* Domains Grid */}
      {!isLoading && filteredDomains.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDomains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredDomains.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Visualizzazione di {filteredDomains.length} su {domains.length} domini
          {domains.length !== 1 ? '' : 'o'}
        </div>
      )}

      {/* Add Domain Modal */}
      <AddDomainModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchDomains();
        }}
      />
    </div>
  );
}
