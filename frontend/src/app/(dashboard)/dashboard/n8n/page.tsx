'use client';

import { useState, useEffect } from 'react';
import { n8nApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCw, ExternalLink, Download, RefreshCw, Zap } from 'lucide-react';

export default function N8nPage() {
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
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
  };

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

  const openN8n = async () => {
    if (status?.url) {
      window.open(status.url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-purple-500" />
            N8N Automazione
          </h1>
          <p className="text-muted-foreground">
            Gestisci workflow e automazioni
          </p>
        </div>
      </div>

      {/* Status Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Stato Servizio</h3>
            <div className="flex items-center gap-3">
              <Badge variant={status?.running ? 'default' : 'destructive'}>
                {status?.running ? 'In Esecuzione' : 'Fermo'}
              </Badge>
              {status?.version && (
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
                <Button variant="outline" onClick={handleRestart} disabled={loading}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  Riavvia
                </Button>
                <Button variant="destructive" onClick={handleStop} disabled={loading}>
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
            <p className="text-sm text-muted-foreground">Nessun workflow trovato</p>
          ) : (
            workflows.map((w: any) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {w.nodes} nodi • Aggiornato: {new Date(w.updatedAt).toLocaleDateString()}
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
          <Button onClick={handleCreateBackup} disabled={loading || !status?.running}>
            <Download className="h-4 w-4 mr-2" />
            Crea Backup
          </Button>
        </div>
        <div className="space-y-2">
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun backup disponibile</p>
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
  );
}
