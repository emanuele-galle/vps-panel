'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  HardDrive,
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Archive,
  Server,
  Clock,
  FileArchive,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';

interface SystemBackup {
  id: string;
  type: 'SYSTEM_TEMPLATE' | 'FULL_DISASTER';
  filename: string;
  filepath: string;
  size: number;
  sizeFormatted: string;
  checksum: string | null;
  status: string;
  includedComponents: string[] | null;
  notes: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

const statusLabels: Record<string, string> = {
  PROCESSING: 'In elaborazione',
  UPLOADED: 'Completato',
  FAILED: 'Fallito',
  EXPIRED: 'Scaduto',
};

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  PROCESSING: 'warning',
  UPLOADED: 'success',
  FAILED: 'error',
  EXPIRED: 'default',
};

export function SystemBackupSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [backups, setBackups] = useState<SystemBackup[]>([]);
  const [isCreatingSystem, setIsCreatingSystem] = useState(false);
  const [isCreatingFull, setIsCreatingFull] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupProgress, setBackupProgress] = useState<{ type: 'system' | 'full'; elapsed: number } | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const fetchBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/system-backup');
      if (response.data.success) {
        setBackups(response.data.data);
        return response.data.data;
      }
    } catch (err: any) {
      console.error('Error fetching backups:', err);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, []);

  useEffect(() => {
    fetchBackups();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchBackups]);

  // Polling per verificare lo stato del backup
  const startPolling = useCallback((type: 'system' | 'full', initialBackupCount: number) => {
    startTimeRef.current = Date.now();

    const updateProgress = () => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setBackupProgress({ type, elapsed });
      }
    };

    updateProgress();

    pollingRef.current = setInterval(async () => {
      updateProgress();

      try {
        const currentBackups = await fetchBackups();

        // Controlla se c'è un nuovo backup completato
        const hasNewCompletedBackup = currentBackups.some((b: SystemBackup) =>
          b.status === 'UPLOADED' &&
          new Date(b.createdAt).getTime() > (startTimeRef.current || 0) - 5000
        );

        // Controlla se c'è un backup in corso (PROCESSING o PENDING)
        const hasProcessingBackup = currentBackups.some((b: SystemBackup) =>
          (b.status === 'PROCESSING' || b.status === 'PENDING') &&
          new Date(b.createdAt).getTime() > (startTimeRef.current || 0) - 5000
        );

        // Controlla se c'è un backup fallito
        const hasFailedBackup = currentBackups.some((b: SystemBackup) =>
          b.status === 'FAILED' &&
          new Date(b.createdAt).getTime() > (startTimeRef.current || 0) - 5000
        );

        if (hasNewCompletedBackup) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setBackupProgress(null);
          startTimeRef.current = null;

          if (type === 'system') setIsCreatingSystem(false);
          else setIsCreatingFull(false);

          setMessage({
            type: 'success',
            text: `Backup ${type === 'system' ? 'sistema' : 'completo'} creato con successo!`,
          });
        } else if (hasFailedBackup) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setBackupProgress(null);
          startTimeRef.current = null;

          if (type === 'system') setIsCreatingSystem(false);
          else setIsCreatingFull(false);

          setMessage({
            type: 'error',
            text: 'Errore durante la creazione del backup',
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }, [fetchBackups]);

  const handleCreateBackup = async (type: 'system' | 'full') => {
    const setCreating = type === 'system' ? setIsCreatingSystem : setIsCreatingFull;
    setCreating(true);
    setMessage(null);

    const initialBackupCount = backups.length;

    try {
      // Avvia la richiesta ma non aspettare la risposta completa
      // Usa un timeout più breve per evitare che il browser chiuda la connessione
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      api.post('/system-backup/create', { type }, {
        signal: controller.signal,
        timeout: 300000 // 5 minuti max
      }).then(async (response) => {
        clearTimeout(timeoutId);
        if (response.data.success) {
          // La richiesta è completata normalmente (backup veloce)
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setBackupProgress(null);
          startTimeRef.current = null;
          setCreating(false);
          setMessage({
            type: 'success',
            text: `Backup ${type === 'system' ? 'sistema' : 'completo'} creato con successo!`,
          });
          await fetchBackups();
        }
      }).catch((err) => {
        clearTimeout(timeoutId);
        // Se è un abort (timeout) o cancellazione, il polling gestirà il completamento
        // Axios usa err.code === 'ERR_CANCELED' per abort
        if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          // Mostra messaggio informativo che il backup è in corso
          setMessage({
            type: 'success',
            text: `Creazione backup ${type === 'system' ? 'sistema' : 'completo'} in corso... Questo può richiedere alcuni minuti.`,
          });
          return;
        }
        // Errore reale
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setBackupProgress(null);
        startTimeRef.current = null;
        setCreating(false);
        setMessage({
          type: 'error',
          text: err.response?.data?.error?.message || 'Errore durante la creazione del backup',
        });
      });

      // Avvia il polling immediatamente
      startPolling(type, initialBackupCount);

    } catch (err: any) {
      setCreating(false);
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Errore durante la creazione del backup',
      });
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleDownload = async (backup: SystemBackup) => {
    setDownloadingId(backup.id);
    try {
      // 1. Richiedi un download token sicuro dal backend
      const tokenResponse = await api.post(`/system-backup/${backup.id}/download-token`);
      const downloadToken = tokenResponse.data?.data?.token;

      if (!downloadToken) {
        throw new Error('Impossibile ottenere il token di download');
      }

      // 2. Usa il download token per scaricare il file
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.fodivps1.cloud/api';
      const downloadUrl = `${apiUrl}/system-backup/${backup.id}/download?token=${encodeURIComponent(downloadToken)}`;

      // Apri in una nuova finestra per avviare il download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', backup.filename);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage({
        type: 'success',
        text: 'Download avviato. Il file è grande, potrebbe richiedere tempo.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Errore durante il download del backup',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo backup?')) return;

    setDeletingId(id);
    try {
      await api.delete(`/system-backup/${id}`);
      setMessage({ type: 'success', text: 'Backup eliminato con successo' });
      await fetchBackups();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Errore durante l\'eliminazione',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-success/10 border border-success/30'
              : 'bg-destructive/10 border border-destructive/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <p
            className={
              message.type === 'success'
                ? 'text-success'
                : 'text-destructive'
            }
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Create Backup Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Template Backup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/15 rounded-lg">
                <Server className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Sistema (Template)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Per replicare il VPS Panel su una nuova VPS
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/10 rounded-lg p-4">
                <h4 className="text-sm font-medium text-primary mb-2">
                  Include:
                </h4>
                <ul className="text-xs text-primary space-y-1 list-disc list-inside">
                  <li>Codice sorgente VPS Panel</li>
                  <li>Configurazioni Docker Compose</li>
                  <li>Configurazione Traefik (statica)</li>
                  <li>File .env e impostazioni</li>
                  <li>Schema database + utenti/settings</li>
                </ul>
              </div>

              <div className="bg-warning/10 rounded-lg p-4">
                <p className="text-xs text-warning">
                  <strong>Nota:</strong> NON include progetti, container e dati dei progetti.
                  Ideale per creare una nuova installazione pulita.
                </p>
              </div>

              {backupProgress?.type === 'system' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary font-medium flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Backup in corso...
                    </span>
                    <span className="text-primary">
                      {formatElapsedTime(backupProgress.elapsed)}
                    </span>
                  </div>
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-primary text-center">
                    Attendere il completamento. Non chiudere questa pagina.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => handleCreateBackup('system')}
                  disabled={isCreatingSystem || isCreatingFull}
                  className="w-full"
                >
                  {isCreatingSystem ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Avvio backup...
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      Crea Backup Sistema
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Full Disaster Recovery Backup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/15 rounded-lg">
                <Shield className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Completo (Disaster Recovery)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Per ripristino completo dopo un crash
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-warning/10 rounded-lg p-4">
                <h4 className="text-sm font-medium text-warning mb-2">
                  Include:
                </h4>
                <ul className="text-xs text-warning space-y-1 list-disc list-inside">
                  <li>Tutto del backup sistema</li>
                  <li>Database PostgreSQL completo</li>
                  <li>Redis dump</li>
                  <li>Tutti i progetti (/var/www/projects)</li>
                  <li>Volumi Docker progetti</li>
                  <li>Certificati SSL ACME</li>
                </ul>
              </div>

              <div className="bg-destructive/10 rounded-lg p-4">
                <p className="text-xs text-destructive">
                  <strong>Attenzione:</strong> Questo backup può essere molto grande e richiedere
                  tempo. Assicurati di avere spazio sufficiente.
                </p>
              </div>

              {backupProgress?.type === 'full' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-warning font-medium flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Backup completo in corso...
                    </span>
                    <span className="text-warning">
                      {formatElapsedTime(backupProgress.elapsed)}
                    </span>
                  </div>
                  <Progress value={undefined} className="h-2" />
                  <p className="text-xs text-warning text-center">
                    Questo processo può richiedere diversi minuti. Non chiudere questa pagina.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => handleCreateBackup('full')}
                  disabled={isCreatingSystem || isCreatingFull}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  {isCreatingFull ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Avvio backup...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Crea Backup Completo
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileArchive className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Esistenti
                </h3>
                <p className="text-sm text-muted-foreground">
                  Lista dei backup creati
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBackups} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileArchive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nessun backup disponibile</p>
              <p className="text-sm">Crea il tuo primo backup usando i pulsanti sopra</p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        backup.type === 'SYSTEM_TEMPLATE'
                          ? 'bg-primary/15'
                          : 'bg-warning/15'
                      }`}
                    >
                      {backup.type === 'SYSTEM_TEMPLATE' ? (
                        <Server className="h-5 w-5 text-primary" />
                      ) : (
                        <Shield className="h-5 w-5 text-warning" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">
                          {backup.type === 'SYSTEM_TEMPLATE' ? 'Backup Sistema' : 'Backup Completo'}
                        </h4>
                        <Badge variant={statusVariants[backup.status]}>
                          {statusLabels[backup.status] || backup.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {backup.filename}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {backup.sizeFormatted}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(backup.createdAt)}
                        </span>
                      </div>
                      {backup.errorMessage && (
                        <p className="text-xs text-destructive mt-1">
                          Errore: {backup.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {backup.status === 'UPLOADED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(backup)}
                        disabled={downloadingId === backup.id}
                      >
                        {downloadingId === backup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(backup.id)}
                      disabled={deletingId === backup.id}
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive "
                    >
                      {deletingId === backup.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary mb-2">
              Come ripristinare un backup:
            </h4>
            <ol className="text-xs text-primary space-y-1 list-decimal list-inside">
              <li>Scarica il file backup (.tar.gz)</li>
              <li>Trasferisci il file sulla nuova VPS</li>
              <li>Estrai l'archivio: <code className="bg-primary/20 px-1 rounded">tar xzf backup.tar.gz</code></li>
              <li>Esegui lo script di ripristino: <code className="bg-primary/20 px-1 rounded">./restore.sh</code></li>
              <li>Segui le istruzioni a schermo</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
