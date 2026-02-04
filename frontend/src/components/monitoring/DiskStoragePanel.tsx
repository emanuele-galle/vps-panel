'use client';

import { useEffect, useState } from 'react';
import {
  HardDrive,
  Database,
  Container,
  Image,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { monitoringApi } from '@/lib/api';
import { DiskMetrics } from '@/types';

export function DiskStoragePanel() {
  const [diskMetrics, setDiskMetrics] = useState<DiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    databases: true,
    volumes: false,
    containers: false,
    images: false,
  });

  const fetchDiskMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await monitoringApi.getDiskMetrics();
      if (response.data.success) {
        setDiskMetrics(response.data.data);
      }
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento delle metriche disco');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiskMetrics();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 90) return 'bg-destructive';
    if (percentage > 70) return 'bg-warning/100';
    return 'bg-success';
  };

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
        <p className="font-medium">Errore</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={fetchDiskMetrics} variant="outline" size="sm" className="mt-2">
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-semibold text-foreground">
            Dettaglio Spazio Disco
          </h2>
        </div>
        <Button onClick={fetchDiskMetrics} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      {isLoading && !diskMetrics && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-purple-600"></div>
          <p className="text-muted-foreground mt-4">Analisi spazio disco...</p>
        </div>
      )}

      {diskMetrics && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {diskMetrics.overview && (
              <>
                <OverviewCard
                  icon={Image}
                  title="Immagini"
                  size={diskMetrics.overview.images.sizeFormatted}
                  count={diskMetrics.overview.images.count}
                  reclaimable={diskMetrics.overview.images.reclaimableFormatted}
                  color="text-primary"
                  bgColor="bg-primary/10"
                />
                <OverviewCard
                  icon={Container}
                  title="Container"
                  size={diskMetrics.overview.containers.sizeFormatted}
                  count={diskMetrics.overview.containers.count}
                  reclaimable={diskMetrics.overview.containers.reclaimableFormatted}
                  color="text-success"
                  bgColor="bg-success/10"
                />
                <OverviewCard
                  icon={Package}
                  title="Volumi"
                  size={diskMetrics.overview.volumes.sizeFormatted}
                  count={diskMetrics.overview.volumes.count}
                  reclaimable={diskMetrics.overview.volumes.reclaimableFormatted}
                  color="text-purple-600 dark:text-purple-400"
                  bgColor="bg-purple-50 dark:bg-purple-900/20"
                />
                <OverviewCard
                  icon={Trash2}
                  title="Build Cache"
                  size={diskMetrics.overview.buildCache.sizeFormatted}
                  count={diskMetrics.overview.buildCache.count}
                  reclaimable={diskMetrics.overview.buildCache.reclaimableFormatted}
                  color="text-warning"
                  bgColor="bg-warning/10"
                  isReclaimable
                />
              </>
            )}
          </div>

          {/* Total Summary */}
          {diskMetrics.overview && (
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Spazio Totale Docker</p>
                  <p className="text-3xl font-bold mt-1">{diskMetrics.overview.total.sizeFormatted}</p>
                </div>
                <div className="text-right">
                  <p className="text-purple-100 text-sm">Recuperabile</p>
                  <p className="text-2xl font-semibold mt-1">{diskMetrics.overview.total.reclaimableFormatted}</p>
                </div>
              </div>
            </div>
          )}

          {/* Databases Section */}
          <CollapsibleSection
            title="Database"
            icon={Database}
            count={diskMetrics.databases.count}
            totalSize={diskMetrics.databases.totalSizeFormatted}
            isExpanded={expandedSections.databases}
            onToggle={() => toggleSection('databases')}
            color="text-primary"
          >
            {diskMetrics.databases.databases.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">Nessun database registrato</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Progetto</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Tabelle</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dimensione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diskMetrics.databases.databases.map((db) => (
                      <tr key={db.id} className="border-b border-border  hover:bg-accent ">
                        <td className="py-2 px-3">
                          <div className="font-medium text-foreground">{db.name}</div>
                          <div className="text-xs text-muted-foreground">{db.databaseName}</div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary">
                            {db.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{db.projectName}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{db.tablesCount}</td>
                        <td className="py-2 px-3 text-right font-medium text-foreground">{db.sizeFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Volumes Section */}
          <CollapsibleSection
            title="Volumi Docker"
            icon={Package}
            count={diskMetrics.volumes.count}
            totalSize={diskMetrics.volumes.totalSizeFormatted}
            isExpanded={expandedSections.volumes}
            onToggle={() => toggleSection('volumes')}
            color="text-purple-600 dark:text-purple-400"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Progetto</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dimensione</th>
                  </tr>
                </thead>
                <tbody>
                  {diskMetrics.volumes.volumes.map((vol) => (
                    <tr key={vol.name} className="border-b border-border  hover:bg-accent ">
                      <td className="py-2 px-3">
                        <div className="font-mono text-xs text-foreground truncate max-w-xs">{vol.name}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          vol.projectSlug === 'vps-panel'
                            ? 'bg-primary/15 text-primary'
                            : vol.projectSlug === 'system'
                            ? 'bg-muted text-foreground'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        }`}>
                          {vol.projectName}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{vol.sizeFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Containers Section */}
          <CollapsibleSection
            title="Container"
            icon={Container}
            count={diskMetrics.containers.count}
            totalSize={diskMetrics.containers.totalSizeFormatted}
            isExpanded={expandedSections.containers}
            onToggle={() => toggleSection('containers')}
            color="text-success"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Stato</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Progetto</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Layer</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Virtuale</th>
                  </tr>
                </thead>
                <tbody>
                  {diskMetrics.containers.containers.map((c) => (
                    <tr key={c.id} className="border-b border-border  hover:bg-accent ">
                      <td className="py-2 px-3">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{c.image}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          c.status === 'running'
                            ? 'bg-success/15 text-success'
                            : 'bg-muted text-foreground'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'running' ? 'bg-success' : 'bg-muted-foreground'}`}></span>
                          {c.status === 'running' ? 'Attivo' : 'Fermo'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{c.projectName}</td>
                      <td className="py-2 px-3 text-right text-muted-foreground">{c.sizeFormatted}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{c.virtualSizeFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Images Section */}
          <CollapsibleSection
            title="Immagini Docker"
            icon={Image}
            count={diskMetrics.images.count}
            totalSize={diskMetrics.images.totalSizeFormatted}
            isExpanded={expandedSections.images}
            onToggle={() => toggleSection('images')}
            color="text-indigo-600 dark:text-indigo-400"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Repository</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tag</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dimensione</th>
                  </tr>
                </thead>
                <tbody>
                  {diskMetrics.images.images.map((img) => (
                    <tr key={img.id} className="border-b border-border  hover:bg-accent ">
                      <td className="py-2 px-3">
                        <div className="font-medium text-foreground truncate max-w-xs">{img.repository}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                          {img.tag}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{img.sizeFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Ultimo aggiornamento: {new Date(diskMetrics.timestamp).toLocaleString('it-IT')}
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
function OverviewCard({
  icon: Icon,
  title,
  size,
  count,
  reclaimable,
  color,
  bgColor,
  isReclaimable = false,
}: {
  icon: any;
  title: string;
  size: string;
  count: number;
  reclaimable: string;
  color: string;
  bgColor: string;
  isReclaimable?: boolean;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4 border border-border`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{size}</div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{count} elementi</span>
        {isReclaimable && reclaimable !== '0 B' && (
          <span className="text-warning">↓ {reclaimable}</span>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  totalSize,
  isExpanded,
  onToggle,
  color,
  children,
}: {
  title: string;
  icon: any;
  count: number;
  totalSize: string;
  isExpanded: boolean;
  onToggle: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-accent dark:hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="font-medium text-foreground">{title}</span>
          <span className="text-sm text-muted-foreground">({count})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{totalSize}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isExpanded && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}
