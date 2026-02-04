'use client';

import { useState } from 'react';
import { FileArchive, Download, Trash2, Upload, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackupUpload } from '@/types';
import { useBackupsStore } from '@/store/backupsStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BackupCardProps {
  backup: BackupUpload;
  onImport: () => void;
}

export function BackupCard({ backup, onImport }: BackupCardProps) {
  const { deleteBackup, uploadToDrive } = useBackupsStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questo backup?')) return;

    try {
      setIsDeleting(true);
      await deleteBackup(backup.id);
    } catch (error) {
      console.error('Error deleting backup:', error);
      setIsDeleting(false);
    }
  };

  const handleUploadToDrive = async () => {
    try {
      setIsUploadingToDrive(true);
      await uploadToDrive(backup.id);
    } catch (error) {
      console.error('Error uploading to Drive:', error);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return 'bg-primary/15 text-primary';
      case 'PROCESSING':
        return 'bg-warning/15 text-warning';
      case 'IMPORTED':
        return 'bg-success/15 text-success';
      case 'EXPORTED':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'FAILED':
        return 'bg-destructive/15 text-destructive';
      case 'EXPIRED':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PROCESSING':
        return <Loader className="h-4 w-4 animate-spin" />;
      case 'IMPORTED':
        return <CheckCircle className="h-4 w-4" />;
      case 'EXPORTED':
        return <Upload className="h-4 w-4" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4" />;
      case 'EXPIRED':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 hover:border-primary/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileArchive className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {backup.originalName}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(Number(backup.size))}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
            backup.status
          )}`}
        >
          {getStatusIcon(backup.status)}
          {backup.status}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-2 mb-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Caricato:</span>
          <span className="ml-2 text-foreground">
            {format(new Date(backup.uploadedAt), 'dd MMM yyyy HH:mm', { locale: it })}
          </span>
        </div>

        {backup.project && (
          <div className="text-sm">
            <span className="text-muted-foreground">Progetto:</span>
            <span className="ml-2 text-foreground font-medium">
              {backup.project.name}
            </span>
          </div>
        )}

        {backup.expiresAt && (
          <div className="text-sm">
            <span className="text-muted-foreground">Scade:</span>
            <span className="ml-2 text-foreground">
              {format(new Date(backup.expiresAt), 'dd MMM yyyy HH:mm', { locale: it })}
            </span>
          </div>
        )}

        {backup.errorMessage && (
          <div className="text-sm text-destructive">
            {backup.errorMessage}
          </div>
        )}

        {backup.driveFileId && (
          <div className="text-sm">
            <span className="inline-flex items-center gap-1 text-success">
              <Upload className="h-3 w-3" />
              Salvato su Google Drive
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {backup.status === 'UPLOADED' && (
          <>
            <Button size="sm" onClick={onImport} className="flex-1">
              <Download className="h-4 w-4 mr-1" />
              Importa
            </Button>
            {!backup.driveFileId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUploadToDrive}
                disabled={isUploadingToDrive}
              >
                {isUploadingToDrive ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
            )}
          </>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={isDeleting || backup.status === 'PROCESSING'}
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive "
        >
          {isDeleting ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
