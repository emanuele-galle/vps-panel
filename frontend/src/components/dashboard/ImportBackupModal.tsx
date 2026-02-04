'use client';

import { useState } from 'react';
import { X, Package, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackupUpload } from '@/types';
import { useBackupsStore } from '@/store/backupsStore';
import { useRouter } from 'next/navigation';

interface ImportBackupModalProps {
  backup: BackupUpload;
  isOpen: boolean;
  onClose: () => void;
}

export function ImportBackupModal({ backup, isOpen, onClose }: ImportBackupModalProps) {
  const router = useRouter();
  const { importBackup } = useBackupsStore();
  const [projectName, setProjectName] = useState(
    backup.originalName.replace('.zip', '')
  );
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!projectName.trim()) {
      setError('Il nome del progetto è obbligatorio');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      await importBackup(backup.id, projectName.trim());

      // Redirect to projects page
      router.push('/dashboard/projects');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'importazione');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Importa Backup come Progetto
          </h3>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted/50/50 rounded-lg">
            <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {backup.originalName}
              </p>
              <p className="text-sm text-muted-foreground">
                {((Number(backup.size) / 1024 / 1024).toFixed(2))} MB
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="projectName"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Nome Progetto
            </label>
            <Input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="es: mio-progetto"
              disabled={isImporting}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Il nome verrà usato per creare il progetto
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-primary/10 border border-primary/30 text-primary px-3 py-2 rounded-lg text-sm">
            <p className="font-medium mb-1">Il backup verrà processato:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Estrazione automatica del contenuto</li>
              <li>Rilevamento framework e dipendenze</li>
              <li>Pulizia file non necessari</li>
              <li>Creazione progetto Docker</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Annulla
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !projectName.trim()}>
            {isImporting ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Importazione...
              </>
            ) : (
              'Importa Progetto'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
