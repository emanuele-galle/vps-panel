'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCw,
  Trash2,
  Server,
  HardDrive,
  Network,
  Calendar,
  Activity,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useContainersStore, getContainerStatus, getContainerStartedAt } from '@/store/containersStore';
import { useAuthStore } from '@/store/authStore';
import { dockerApi } from '@/lib/api';
import { WebTerminal } from '@/components/terminal/WebTerminal';

export default function ContainerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const containerId = params.id as string;

  const {
    currentContainer,
    containerStats,
    isLoading,
    error,
    fetchContainer,
    fetchContainerStats,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
  } = useContainersStore();

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [tailLines, setTailLines] = useState(100);
  const [terminalOpen, setTerminalOpen] = useState(false);

  useEffect(() => {
    if (containerId) {
      fetchContainer(containerId);
      fetchContainerStats(containerId);
      fetchLogs();

      // Auto-refresh stats every 5 seconds
      const statsInterval = setInterval(() => {
        fetchContainerStats(containerId);
      }, 5000);

      return () => clearInterval(statsInterval);
    }
  }, [containerId]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await dockerApi.getContainerLogs(containerId, tailLines);
      setLogs(response.data.data?.logs || '');
    } catch (error: unknown) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [tailLines]);

  const getStatusVariant = (
    state: string
  ): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (state?.toLowerCase()) {
      case 'running':
        return 'success';
      case 'exited':
      case 'stopped':
        return 'error';
      case 'created':
        return 'info';
      case 'paused':
        return 'warning';
      case 'restarting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startContainer(containerId);
      await fetchContainer(containerId);
    } catch (error: unknown) {
      console.error('Failed to start container:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await stopContainer(containerId);
      await fetchContainer(containerId);
    } catch (error: unknown) {
      console.error('Failed to stop container:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await restartContainer(containerId);
      await fetchContainer(containerId);
    } catch (error: unknown) {
      console.error('Failed to restart container:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    const containerName = currentContainer?.Name || containerId;
    if (
      !confirm(
        'Sei sicuro di voler rimuovere "' + containerName + '"? Questa azione non può essere annullata.'
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const force = getContainerStatus(currentContainer?.State).toLowerCase() === 'running';
      await removeContainer(containerId, force);
      router.push('/dashboard/containers');
    } catch (error: unknown) {
      console.error('Failed to remove container:', error);
      setActionLoading(false);
    }
  };

  if (isLoading && !currentContainer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-blue-600"></div>
          <p className="text-muted-foreground mt-4">
            Caricamento container...
          </p>
        </div>
      </div>
    );
  }

  if (error && !currentContainer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-6 py-4 rounded-lg">
            <p className="font-semibold">Errore caricamento container</p>
            <p className="text-sm mt-2">{error}</p>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/containers')}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna ai Container
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentContainer) {
    return null;
  }

  const containerName = currentContainer.Name?.replace(/^\//, '') || containerId;
  const containerState = getContainerStatus(currentContainer.State);
  const containerStartedAt = getContainerStartedAt(currentContainer.State);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/containers')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {containerName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              {containerId.substring(0, 12)}
            </p>
          </div>
          <Badge variant={getStatusVariant(containerState)}>
            {containerState}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {containerState.toLowerCase() === 'running' ? (
            <>
              <Button
                variant="outline"
                onClick={handleStop}
                disabled={actionLoading}
              >
                <Square className="h-4 w-4 mr-2" />
                Ferma
              </Button>
              <Button
                variant="outline"
                onClick={handleRestart}
                disabled={actionLoading}
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Riavvia
              </Button>
            </>
          ) : (
            <Button onClick={handleStart} disabled={actionLoading}>
              <Play className="h-4 w-4 mr-2" />
              Avvia
            </Button>
          )}
          {isAdmin && containerState.toLowerCase() === 'running' && (
            <Button
              variant="outline"
              onClick={() => setTerminalOpen(!terminalOpen)}
            >
              <TerminalSquare className="h-4 w-4 mr-2" />
              Terminal
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={actionLoading}
            className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive hover:bg-destructive/15"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Elimina
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {containerStats && containerState.toLowerCase() === 'running' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Utilizzo CPU
                </h3>
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {containerStats.cpu.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Utilizzo Memoria
                </h3>
                <HardDrive className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">
                {containerStats.memory.percentage.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatBytes(containerStats.memory.used)} /{' '}
                {formatBytes(containerStats.memory.limit)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Rete
                </h3>
                <Network className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  <span className="text-success">↓</span>{' '}
                  {formatBytes(containerStats.network.received)}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="text-primary">↑</span>{' '}
                  {formatBytes(containerStats.network.transmitted)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Container Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">
              Informazioni Container
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Immagine</p>
              <p className="font-medium text-foreground mt-1">
                {currentContainer.Config?.Image || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Comando</p>
              <p className="text-sm font-mono text-foreground mt-1">
                {currentContainer.Config?.Cmd?.join(' ') || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Creato</p>
              <p className="text-sm text-foreground mt-1">
                {new Date(currentContainer.Created).toLocaleString()}
              </p>
            </div>

            {containerStartedAt && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Avviato
                </p>
                <p className="text-sm text-foreground mt-1">
                  {new Date(containerStartedAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">
              Rete e Porte
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentContainer.NetworkSettings?.Ports &&
            Object.keys(currentContainer.NetworkSettings.Ports).length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Mappatura Porte
                </p>
                <div className="space-y-2">
                  {Object.entries(currentContainer.NetworkSettings.Ports).map(
                    ([port, bindings]) => (
                      <div
                        key={port}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded"
                      >
                        <span className="text-sm font-mono">{port}</span>
                        {bindings && bindings.length > 0 ? (
                          <Badge variant="success">
                            {bindings[0].HostIp}:{bindings[0].HostPort}
                          </Badge>
                        ) : (
                          <Badge variant="default">Non esposta</Badge>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessuna mappatura porte
              </p>
            )}

            {currentContainer.NetworkSettings?.Networks && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Reti
                </p>
                <div className="space-y-1">
                  {Object.keys(currentContainer.NetworkSettings.Networks).map(
                    (network) => (
                      <Badge key={network} variant="info">
                        {network}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mounts/Volumes */}
      {currentContainer.Mounts && currentContainer.Mounts.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">
              Volumi e Mount
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentContainer.Mounts.map((mount, index) => (
                <div
                  key={index}
                  className="p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="default">{mount.Type}</Badge>
                    <Badge variant={mount.Mode === 'rw' ? 'success' : 'warning'}>
                      {mount.Mode === 'rw' ? 'Lettura/Scrittura' : 'Sola lettura'}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground space-y-1">
                    <p>
                      <span className="text-muted-foreground">
                        Origine:
                      </span>{' '}
                      {mount.Source}
                    </p>
                    <p>
                      <span className="text-muted-foreground">
                        Destinazione:
                      </span>{' '}
                      {mount.Destination}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Web Terminal */}
      {terminalOpen && containerState.toLowerCase() === 'running' && (
        <WebTerminal
          containerId={containerId}
          containerName={containerName}
          onClose={() => setTerminalOpen(false)}
        />
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Log Container
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={tailLines}
                onChange={(e) => setTailLines(Number(e.target.value))}
                className="text-sm px-2 py-1 border border-border rounded bg-card"
              >
                <option value="50">Ultime 50 righe</option>
                <option value="100">Ultime 100 righe</option>
                <option value="200">Ultime 200 righe</option>
                <option value="500">Ultime 500 righe</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={logsLoading}
              >
                <RotateCw
                  className={'h-4 w-4' + (logsLoading ? ' animate-spin' : '')}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-card dark:bg-black rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-sm">
            {logsLoading ? (
              <div className="text-muted-foreground">Caricamento log...</div>
            ) : logs ? (
              <pre className="text-foreground whitespace-pre-wrap break-words">
                {logs}
              </pre>
            ) : (
              <div className="text-muted-foreground">Nessun log disponibile</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
