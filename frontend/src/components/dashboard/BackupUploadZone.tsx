'use client';

import { useCallback, useState } from 'react';
import { Upload, X, FileArchive, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackupsStore } from '@/store/backupsStore';

interface BackupUploadZoneProps {
  onClose: () => void;
}

export function BackupUploadZone({ onClose }: BackupUploadZoneProps) {
  const { uploadBackup, isUploading } = useBackupsStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setError('Solo file ZIP sono ammessi');
        return;
      }
      setSelectedFile(file);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setError('Solo file ZIP sono ammessi');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setError(null);
      await uploadBackup(selectedFile);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento');
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
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-foreground">
          Carica Backup ZIP
        </h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!selectedFile ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive
              ? 'border-primary bg-primary/10'
              : 'border-border'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            Trascina un file ZIP qui o clicca per selezionare
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Dimensione massima: 500MB
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".zip"
              onChange={handleFileInput}
              className="hidden"
            />
            <span className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium cursor-pointer hover:bg-accent hover:bg-accent transition-colors">
              Seleziona File
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50/50 rounded-lg">
            <FileArchive className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
              className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isUploading}>
              Annulla
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Caricamento...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Carica
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Note:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Il backup verrà analizzato automaticamente</li>
          <li>File non necessari (node_modules, .git, ecc.) verranno rimossi</li>
          <li>I backup scadono automaticamente dopo 24 ore</li>
        </ul>
      </div>
    </div>
  );
}
