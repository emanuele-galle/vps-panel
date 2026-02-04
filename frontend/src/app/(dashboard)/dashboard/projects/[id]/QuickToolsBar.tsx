'use client';

import {
  Globe,
  FolderOpen,
  Database,
  Download,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileBrowserUrl, getAdminerUrl } from './utils';

interface QuickToolsBarProps {
  project: any;
  projectDatabases: any[];
  exportLoading: boolean;
  isLoading: boolean;
  onExportBackup: () => void;
  onRefresh: () => void;
}

export function QuickToolsBar({
  project,
  projectDatabases,
  exportLoading,
  isLoading,
  onExportBackup,
  onRefresh,
}: QuickToolsBarProps) {
  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800 rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-400" />
          <span className="text-white font-medium">Strumenti Rapidi</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {project.previewUrl && (
            <a
              href={`https://${project.previewUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/90 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Globe className="h-4 w-4" />
              Apri Sito
            </a>
          )}

          <a
            href={getFileBrowserUrl(project)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
          >
            <FolderOpen className="h-4 w-4" />
            File Manager
          </a>

          {projectDatabases.length > 0 && (
            <a
              href={getAdminerUrl(projectDatabases[0])}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Database className="h-4 w-4" />
              Database
            </a>
          )}

          <button
            onClick={onExportBackup}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {exportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportLoading ? 'Esportando...' : 'Esporta Backup'}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-slate-600 hover:bg-slate-500 text-white border-slate-500"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
