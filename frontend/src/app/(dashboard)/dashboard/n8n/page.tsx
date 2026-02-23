'use client';

import { useState, useEffect, useCallback } from 'react';
import { n8nApi, dockerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Download,
  RefreshCw,
  Zap,
  Wrench,
  Film,
} from 'lucide-react';

const REMOTION_CONTAINER = 'remotion-studio';
const REMOTION_URL = 'https://remotion.fodivps2.cloud';

export default function AutomazioniPage() {
  // N8N state
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);

  // Remotion state
  const [remotionStatus, setRemotionStatus] = useState<{
    available: boolean;
    running: boolean;
    status?: string;
    cpu?: number;
    memory?: { used: number; limit: number };
  }>({ available: false, running: false });

  const [loading, setLoading] = useState(false);
  const [remotionLoading, setRemotionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusRes, statsRes, workflowsRes, backupsRes] = await Promise.all([
        n8nApi.getStatus(),
        n8nApi.getStats().catch(() => ({ data: { data: null } })),
        n8nApi.getWorkflows().catch(() => ({ data: { data: [] } })),
        n8nApi.listBackups().catch(() => ({ data: { data: [] } })),
      ]);

      setStatus(statusRes.data?.data);
      setStats(statsRes.data?.data);
      setWorkflows(workflowsRes.data?.data || []);
      setBackups(backupsRes.data?.data || []);
    } catch (error) {
      console.error('Error loading N8N data:', error);
    }
  }, []);

  const loadRemotionStatus = useCallback(async () => {
    try {
      const containersRes = await dockerApi.listContainers(true);
      const containers = containersRes.data?.data || [];
      const remotion = containers.find(
        (c: any) =>
          c.name === REMOTION_CONTAINER ||
          c.Names?.includes('/' + REMOTION_CONTAINER)
      );

      if (!remotion) {
        setRemotionStatus({ available: false, running: false });
        return;
      }

      const running =
        remotion.State === 'running' || remotion.status?.includes('Up');

      let cpu: number | undefined;
      let memory: { used: number; limit: number } | undefined;

      if (running) {
        try {
          const statsRes = await dockerApi.getContainerStats(remotion.id || remotion.Id);
          const s = statsRes.data?.data;
          if (s) {
            cpu = s.cpu;
            memory = s.memory;
          }
        } catch {
          // stats non disponibili
        }
      }

      setRemotionStatus({
        available: true,
        running,
        status: remotion.State || remotion.status,
        cpu,
        memory,
      });
    } catch {
      setRemotionStatus({ available: false, running: false });
    }
  }, []);

  useEffect(() => {
    loadData();
    loadRemotionStatus();
    const interval = setInterval(() => {
      loadData();
      loadRemotionStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, loadRemotionStatus]);

  // N8N actions
  const handleStart = async () => {
    setLoading(true);
    try {
      await n8nApi.start();
      setTimeout(loadData, 3000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await n8nApi.stop();
      setTimeout(loadData, 2000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setLoading(true);
    try {
      await n8nApi.restart();
      setTimeout(loadData, 5000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await n8nApi.createBackup();
      alert('Backup creato con successo');
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openN8n = () => {
    if (status?.url) {
      window.open(status.url, '_blank');
    }
  };

  // Remotion actions
  const findRemotionId = async (): Promise<string | null> => {
    const containersRes = await dockerApi.listContainers(true);
    const containers = containersRes.data?.data || [];
    const remotion = containers.find(
      (c: any) =>
        c.name === REMOTION_CONTAINER ||
        c.Names?.includes('/' + REMOTION_CONTAINER)
    );
    return remotion?.id || remotion?.Id || null;
  };

  const handleRemotionStart = async () => {
    setRemotionLoading(true);
    try {
      const id = await findRemotionId();
      if (!id) throw new Error('Container Remotion non trovato');
      await dockerApi.startContainer(id);
      setTimeout(loadRemotionStatus, 3000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setRemotionLoading(false);
    }
  };

  const handleRemotionStop = async () => {
    setRemotionLoading(true);
    try {
      const id = await findRemotionId();
      if (!id) throw new Error('Container Remotion non trovato');
      await dockerApi.stopContainer(id);
      setTimeout(loadRemotionStatus, 2000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setRemotionLoading(false);
    }
  };

  const handleRemotionRestart = async () => {
    setRemotionLoading(true);
    try {
      const id = await findRemotionId();
      if (!id) throw new Error('Container Remotion non trovato');
      await dockerApi.restartContainer(id);
      setTimeout(loadRemotionStatus, 5000);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setRemotionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-purple-500" />
          <Wrench className="h-6 w-6 text-muted-foreground -ml-2" />
          Automazioni & Tools
        </h1>
        <p className="text-muted-foreground">
          Gestisci workflow, automazioni e strumenti
        </p>
      </div>

      {/* ============ N8N SECTION ============ */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500" />
          N8N — Workflow Automation
        </h2>

        {/* N8N Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Stato Servizio</h3>
              <div className="flex items-center gap-3">
                <Badge variant={status?.running ? 'default' : 'destructive'}>
                  {status?.running ? 'In Esecuzione' : 'Fermo'}
                </Badge>
                {status?.version &&
                  status.version !== 'latest' &&
                  status.version !== 'unknown' && (
                    <span className="text-sm text-muted-foreground">
                      v{status.version}
                    </span>
                  )}
                {status?.uptime && (
                  <span className="text-sm text-muted-foreground">
                    Uptime: {status.uptime}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!status?.running ? (
                <Button onClick={handleStart} disabled={loading}>
                  <Play className="h-4 w-4 mr-2" />
                  Avvia
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleRestart}
                    disabled={loading}
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Riavvia
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleStop}
                    disabled={loading}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Ferma
                  </Button>
                  <Button onClick={openN8n}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Apri N8N
                  </Button>
                </>
              )}
            </div>
          </div>

          {stats && status?.running && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div>
                <p className="text-sm text-muted-foreground">CPU</p>
                <p className="text-2xl font-bold">{stats.cpu.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Memoria</p>
                <p className="text-2xl font-bold">
                  {(stats.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Network TX</p>
                <p className="text-2xl font-bold">
                  {(stats.network.transmitted / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Workflows */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Workflow Attivi</h3>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun workflow trovato
              </p>
            ) : (
              workflows.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {w.nodes} nodi • Aggiornato:{' '}
                      {new Date(w.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={w.active ? 'default' : 'secondary'}>
                    {w.active ? 'Attivo' : 'Inattivo'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Backups */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Backup</h3>
            <Button
              onClick={handleCreateBackup}
              disabled={loading || !status?.running}
            >
              <Download className="h-4 w-4 mr-2" />
              Crea Backup
            </Button>
          </div>
          <div className="space-y-2">
            {backups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun backup disponibile
              </p>
            ) : (
              backups.slice(0, 5).map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div>
                    <p className="font-medium">{b.filename}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.workflows} workflow • {b.credentials} credenziali •{' '}
                      {(Number(b.size) / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ============ REMOTION SECTION ============ */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Film className="h-5 w-5 text-blue-500" />
          Remotion Studio — Video Programmatici
        </h2>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">Stato Container</h3>
              <div className="flex items-center gap-3">
                {!remotionStatus.available ? (
                  <Badge variant="secondary">Non Disponibile</Badge>
                ) : (
                  <Badge
                    variant={
                      remotionStatus.running ? 'default' : 'destructive'
                    }
                  >
                    {remotionStatus.running ? 'In Esecuzione' : 'Fermo'}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  React + TypeScript • Remotion 4.x
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!remotionStatus.available ? (
                <Button variant="outline" disabled>
                  Container non trovato
                </Button>
              ) : !remotionStatus.running ? (
                <Button
                  onClick={handleRemotionStart}
                  disabled={remotionLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Avvia
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleRemotionRestart}
                    disabled={remotionLoading}
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Riavvia
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemotionStop}
                    disabled={remotionLoading}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Ferma
                  </Button>
                  <Button
                    onClick={() => window.open(REMOTION_URL, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Apri Studio
                  </Button>
                </>
              )}
            </div>
          </div>

          {remotionStatus.running &&
            (remotionStatus.cpu !== undefined ||
              remotionStatus.memory !== undefined) && (
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
                {remotionStatus.cpu !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">CPU</p>
                    <p className="text-2xl font-bold">
                      {remotionStatus.cpu.toFixed(1)}%
                    </p>
                  </div>
                )}
                {remotionStatus.memory !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Memoria</p>
                    <p className="text-2xl font-bold">
                      {(
                        remotionStatus.memory.used /
                        1024 /
                        1024
                      ).toFixed(0)}{' '}
                      MB
                    </p>
                  </div>
                )}
              </div>
            )}

          {!remotionStatus.available && (
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
              Il container <code>remotion-studio</code> non è presente su
              questa VPS. Remotion Studio è disponibile solo su VPS2.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
