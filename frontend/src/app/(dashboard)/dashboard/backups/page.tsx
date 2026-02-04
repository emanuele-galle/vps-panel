'use client';

import { useEffect, useState } from 'react';
import { Upload, Filter, Search, RefreshCw, Info, FileArchive, Download, Rocket, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackupUploadZone } from '@/components/dashboard/BackupUploadZone';
import { BackupCard } from '@/components/dashboard/BackupCard';
import { ImportBackupModal } from '@/components/dashboard/ImportBackupModal';
import { useBackupsStore } from '@/store/backupsStore';
import { BackupStatus, BackupUpload } from '@/types';

export default function BackupsPage() {
  const { backups, isLoading, isUploading, error, fetchBackups, clearError } =
    useBackupsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BackupStatus | ''>('');
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupUpload | null>(null);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleRefresh = () => {
    const filters: { status?: BackupStatus } = {};
    if (statusFilter) filters.status = statusFilter;
    fetchBackups(filters);
  };

  const handleFilterChange = (status: BackupStatus | '') => {
    setStatusFilter(status);

    const filters: { status?: BackupStatus } = {};
    if (status) filters.status = status;
    fetchBackups(filters);
  };

  const filteredBackups = backups.filter((backup) => {
    const matchesSearch =
      searchQuery === '' ||
      backup.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backup.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backup.project?.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Backup & Importazione
          </h1>
          <p className="text-muted-foreground mt-1">
            Carica progetti ZIP da locale e importali come nuovi progetti
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          <Button onClick={() => setShowUploadZone(true)} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            Carica Backup
          </Button>
        </div>
      </div>

      {/* Workflow Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-primary/30 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Info className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Come Funziona l&apos;Import di Progetti Locali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Sviluppo Locale
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crea il progetto con Claude Code localmente
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Esporta ZIP
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crea archivio senza node_modules, .git, .env
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Carica Qui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload del ZIP tramite questo pannello
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="bg-success text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-semibold">
                  4
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Deploy Automatico
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Il sistema importa e avvia i container
                  </p>
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-card rounded-md p-4 border border-primary/30">
              <h4 className="text-sm font-semibold text-foreground mb-2">
                📋 Requisiti ZIP per Deploy Automatico:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span><code className="bg-muted px-1 rounded">docker-compose.yml</code> presente</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span><code className="bg-muted px-1 rounded">.env.example</code> con placeholder</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>NO <code className="bg-muted px-1 rounded">node_modules/</code>, <code className="bg-muted px-1 rounded">.next/</code>, <code className="bg-muted px-1 rounded">.git/</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>NO file <code className="bg-muted px-1 rounded">.env</code> con secrets</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 <strong>Tip:</strong> Il sistema genera automaticamente password sicure da <code className="bg-muted px-1 rounded">.env.example</code> ed esegue <code className="bg-muted px-1 rounded">docker compose up -d</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      {showUploadZone && (
        <BackupUploadZone onClose={() => setShowUploadZone(false)} />
      )}

      {/* Filters and Search */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cerca backup..."
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
              onChange={(e) => handleFilterChange(e.target.value as BackupStatus | '')}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tutti gli Stati</option>
              <option value="UPLOADED">Caricato</option>
              <option value="PROCESSING">In Elaborazione</option>
              <option value="IMPORTED">Importato</option>
              <option value="EXPORTED">Esportato</option>
              <option value="FAILED">Errore</option>
              <option value="EXPIRED">Scaduto</option>
            </select>
          </div>
        </div>

        {/* Active Filters Info */}
        {statusFilter && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>
              Filtrando per: <span className="ml-2 font-medium">{statusFilter}</span>
            </span>
            <button
              onClick={() => handleFilterChange('')}
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
          <p className="font-medium">Errore</p>
          <p className="text-sm mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearError();
              handleRefresh();
            }}
            className="mt-2"
          >
            Riprova
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !backups.length && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-blue-600"></div>
          <p className="text-muted-foreground mt-4">
            Caricamento backup...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredBackups.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <div className="mx-auto h-16 w-16 text-muted-foreground mb-4">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-16 w-16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery || statusFilter
              ? 'Nessun backup trovato'
              : 'Nessun backup ancora'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter
              ? 'Prova a regolare la ricerca o i filtri'
              : 'Inizia caricando il tuo primo backup ZIP'}
          </p>
          {!searchQuery && !statusFilter && (
            <Button onClick={() => setShowUploadZone(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Carica Primo Backup
            </Button>
          )}
        </div>
      )}

      {/* Backups Grid */}
      {!isLoading && filteredBackups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBackups.map((backup) => (
            <BackupCard
              key={backup.id}
              backup={backup}
              onImport={() => setSelectedBackup(backup)}
            />
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {!isLoading && filteredBackups.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Visualizzazione di {filteredBackups.length} su {backups.length} backup
        </div>
      )}

      {/* Import Backup Modal */}
      {selectedBackup && (
        <ImportBackupModal
          backup={selectedBackup}
          isOpen={!!selectedBackup}
          onClose={() => setSelectedBackup(null)}
        />
      )}
    </div>
  );
}
