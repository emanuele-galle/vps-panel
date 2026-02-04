'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Zap,
  Package,
  Database,
  FileText,
  Folder,
  TrendingDown,
  Activity,
  Clock,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';

interface CleanupItem {
  category: string;
  name: string;
  currentSize: number;
  currentSizeFormatted: string;
  reclaimable: number;
  reclaimableFormatted: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
}

interface AnalysisData {
  items: CleanupItem[];
  totalReclaimable: number;
  totalReclaimableFormatted: string;
  diskUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
}

interface CleanupResult {
  success: boolean;
  freedSpace: number;
  freedSpaceFormatted: string;
  message: string;
}

interface CleanupJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  totalFreed?: number;
  totalFreedFormatted?: string;
  error?: string;
  diskUsageBefore?: { used: number; percentage: number };
  diskUsageAfter?: { used: number; percentage: number };
}

const categoryIcons: Record<string, React.ReactNode> = {
  docker: <Package className="h-5 w-5" />,
  cache: <Database className="h-5 w-5" />,
  logs: <FileText className="h-5 w-5" />,
  temp: <Folder className="h-5 w-5" />,
};

const categoryColors: Record<string, string> = {
  docker: 'text-primary',
  cache: 'text-purple-600 dark:text-purple-400',
  logs: 'text-warning',
  temp: 'text-muted-foreground',
};

const riskBadgeVariants: Record<string, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

const riskLabels: Record<string, string> = {
  low: 'Basso',
  medium: 'Medio',
  high: 'Alto',
};

// Only Docker-based cleanup endpoints that actually work in containerized environment
const cleanupEndpoints: Record<string, string> = {
  'Docker Build Cache': '/optimization/clean/docker-cache',
  'Immagini Dangling': '/optimization/prune/images',
  'Volumi Orfani': '/optimization/prune/volumes',
  'Log Container': '/optimization/clean/container-logs',
};

export function OptimizationSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [cleaningItem, setCleaningItem] = useState<string | null>(null);
  const [isCleaningAll, setIsCleaningAll] = useState(false);
  const [cleanupJob, setCleanupJob] = useState<CleanupJob | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await api.get('/optimization/analyze');
      if (response.data.success) {
        setAnalysis(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Errore durante l\'analisi');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const handleCleanItem = async (item: CleanupItem) => {
    const endpoint = cleanupEndpoints[item.name];
    if (!endpoint) return;

    setCleaningItem(item.name);
    setLastResult(null);
    setError(null);

    try {
      const response = await api.post(endpoint, {});
      if (response.data.success) {
        setLastResult(response.data.data);
        // Refresh analysis after cleanup
        await fetchAnalysis();
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Errore durante la pulizia');
    } finally {
      setCleaningItem(null);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await api.get(`/optimization/clean-all/status/${jobId}`);
      if (response.data.success) {
        const job = response.data.data as CleanupJob;
        setCleanupJob(job);

        if (job.status === 'completed') {
          setIsCleaningAll(false);
          const freedSpace = job.totalFreed || 0;
          const message = freedSpace > 0
            ? `Pulizia completata! Liberati ${job.totalFreedFormatted}. Disco: ${job.diskUsageBefore?.percentage}% -> ${job.diskUsageAfter?.percentage}%`
            : 'Sistema già ottimizzato - nessuno spazio da liberare';
          setLastResult({
            success: true,
            freedSpace,
            freedSpaceFormatted: job.totalFreedFormatted || '0 B',
            message,
          });
          setCleanupJob(null);
          await fetchAnalysis();
        } else if (job.status === 'failed') {
          setIsCleaningAll(false);
          setError(job.error || 'Errore durante la pulizia');
          setCleanupJob(null);
        } else {
          // Still running, poll again
          setTimeout(() => pollJobStatus(jobId), 1500);
        }
      }
    } catch (err: any) {
      setIsCleaningAll(false);
      setError(err.response?.data?.error?.message || 'Errore durante il controllo dello stato');
      setCleanupJob(null);
    }
  };

  const handleCleanAll = async () => {
    setIsCleaningAll(true);
    setLastResult(null);
    setError(null);
    setCleanupJob(null);

    try {
      const response = await api.post('/optimization/clean-all', {});
      if (response.data.success) {
        const jobId = response.data.data.jobId;
        setCleanupJob({
          id: jobId,
          status: 'pending',
          progress: 0,
          currentStep: 'Avvio pulizia...',
        });
        // Start polling
        setTimeout(() => pollJobStatus(jobId), 1000);
      }
    } catch (err: any) {
      setIsCleaningAll(false);
      setError(err.response?.data?.error?.message || 'Errore durante l\'avvio della pulizia');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Analisi in corso...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Disk Usage Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Utilizzo Disco
                </h3>
                <p className="text-sm text-muted-foreground">
                  Panoramica dello spazio su disco
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalysis}
              disabled={isAnalyzing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(analysis.diskUsage.used)} / {formatBytes(analysis.diskUsage.total)}
                </span>
                <span className="font-medium text-foreground">
                  {analysis.diskUsage.percentage}% utilizzato
                </span>
              </div>
              <Progress value={analysis.diskUsage.percentage} className="h-3" />

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-success/10 rounded-lg p-4">
                  <p className="text-sm text-success">Spazio Libero</p>
                  <p className="text-2xl font-bold text-success">
                    {formatBytes(analysis.diskUsage.free)}
                  </p>
                </div>
                <div className="bg-warning/10 rounded-lg p-4">
                  <p className="text-sm text-warning">Recuperabile</p>
                  <p className="text-2xl font-bold text-warning">
                    {analysis.totalReclaimableFormatted}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success/Error Messages */}
      {lastResult && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            lastResult.success
              ? 'bg-success/10 border border-success/30'
              : 'bg-destructive/10 border border-destructive/30'
          }`}
        >
          {lastResult.success ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p
              className={`font-medium ${
                lastResult.success
                  ? 'text-success'
                  : 'text-destructive'
              }`}
            >
              {lastResult.message}
            </p>
            {lastResult.freedSpace > 0 && (
              <p className="text-sm text-success">
                Spazio liberato: {lastResult.freedSpaceFormatted}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Quick Cleanup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-warning" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Pulizia Rapida
                </h3>
                <p className="text-sm text-muted-foreground">
                  Libera spazio con un solo click
                </p>
              </div>
            </div>
            <Button
              onClick={handleCleanAll}
              disabled={isCleaningAll || !analysis?.items.length}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {isCleaningAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Pulizia in corso...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Pulisci Tutto ({analysis?.totalReclaimableFormatted})
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {cleanupJob && (
            <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium text-primary">
                  {cleanupJob.currentStep}
                </span>
              </div>
              <Progress value={cleanupJob.progress} className="h-2" />
              <p className="text-xs text-primary mt-2 text-right">
                {cleanupJob.progress}% completato
              </p>
            </div>
          )}
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-warning">
              <strong>Nota:</strong> La pulizia completa rimuove cache e file temporanei non
              necessari. I dati dei progetti e i container attivi non verranno toccati.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Cleanup Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Pulizia Selettiva
              </h3>
              <p className="text-sm text-muted-foreground">
                Scegli cosa pulire individualmente
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {analysis?.items && analysis.items.length > 0 ? (
              analysis.items.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className={categoryColors[item.category]}>
                      {categoryIcons[item.category]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">
                          {item.name}
                        </h4>
                        <Badge variant={riskBadgeVariants[item.risk]}>
                          Rischio {riskLabels[item.risk]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {item.command}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-warning">
                        {item.reclaimableFormatted}
                      </p>
                      <p className="text-xs text-muted-foreground">recuperabili</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCleanItem(item)}
                      disabled={cleaningItem === item.name || isCleaningAll}
                    >
                      {cleaningItem === item.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-success" />
                <p className="font-medium">Sistema ottimizzato!</p>
                <p className="text-sm">Non ci sono elementi da pulire al momento.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stato Sistema e Raccomandazioni */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-success" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Stato Ottimizzazione Sistema
              </h3>
              <p className="text-sm text-muted-foreground">
                Analisi e raccomandazioni automatiche
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {/* Stato Disco Dinamico */}
            {analysis && (
              <div className={`rounded-lg p-4 border ${
                analysis.diskUsage.percentage < 70
                  ? 'bg-success/10 border-success/30'
                  : analysis.diskUsage.percentage < 85
                  ? 'bg-warning/10 border-warning/30'
                  : 'bg-destructive/10 border-destructive/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${
                      analysis.diskUsage.percentage < 70
                        ? 'text-success'
                        : analysis.diskUsage.percentage < 85
                        ? 'text-warning'
                        : 'text-destructive'
                    }`} />
                    <span className={`font-medium text-sm ${
                      analysis.diskUsage.percentage < 70
                        ? 'text-success'
                        : analysis.diskUsage.percentage < 85
                        ? 'text-warning'
                        : 'text-destructive'
                    }`}>
                      {analysis.diskUsage.percentage < 70
                        ? 'Sistema Ottimizzato'
                        : analysis.diskUsage.percentage < 85
                        ? 'Attenzione: Spazio in Esaurimento'
                        : 'Critico: Spazio Quasi Esaurito'}
                    </span>
                  </div>
                  <Badge variant={
                    analysis.diskUsage.percentage < 70 ? 'success'
                    : analysis.diskUsage.percentage < 85 ? 'warning'
                    : 'error'
                  }>
                    {analysis.diskUsage.percentage}% utilizzato
                  </Badge>
                </div>
                <p className={`text-xs ${
                  analysis.diskUsage.percentage < 70
                    ? 'text-success'
                    : analysis.diskUsage.percentage < 85
                    ? 'text-warning'
                    : 'text-destructive'
                }`}>
                  {analysis.diskUsage.percentage < 70
                    ? `Lo spazio disco è in buone condizioni. ${formatBytes(analysis.diskUsage.free)} liberi.`
                    : analysis.diskUsage.percentage < 85
                    ? `Considera di eseguire una pulizia. Solo ${formatBytes(analysis.diskUsage.free)} disponibili.`
                    : `Azione immediata richiesta! Solo ${formatBytes(analysis.diskUsage.free)} rimasti.`}
                </p>
              </div>
            )}

            {/* Raccomandazioni Dinamiche */}
            {analysis && analysis.items.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  <h4 className="text-sm font-medium text-warning">
                    Raccomandazioni ({analysis.totalReclaimableFormatted} recuperabili)
                  </h4>
                </div>
                <ul className="text-xs text-warning space-y-2">
                  {analysis.items.slice(0, 5).map((item, index) => (
                    <li key={index} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                        {item.name}
                      </span>
                      <span className="font-mono font-medium">{item.reclaimableFormatted}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info Pulizia Sicura */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium text-primary">
                  Pulizia Sicura Garantita
                </h4>
              </div>
              <ul className="text-xs text-primary space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  I dati dei progetti non vengono mai toccati
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  I container attivi rimangono operativi
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Le cache si rigenerano automaticamente quando necessario
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Solo file temporanei e cache obsolete vengono rimossi
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardContent className="pt-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-primary/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium text-primary">
                Best Practice per l'Ottimizzazione
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2 text-primary">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                <span>Esegui la pulizia dopo ogni ciclo di sviluppo intensivo</span>
              </div>
              <div className="flex items-start gap-2 text-primary">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                <span>La Docker Build Cache cresce rapidamente - puliscila regolarmente</span>
              </div>
              <div className="flex items-start gap-2 text-primary">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                <span>Verifica i volumi orfani prima di eliminarli</span>
              </div>
              <div className="flex items-start gap-2 text-primary">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                <span>Mantieni il disco sotto il 80% per prestazioni ottimali</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
