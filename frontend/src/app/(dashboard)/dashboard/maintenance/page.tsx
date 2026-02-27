'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  Wrench,
  RefreshCw,
  Trash2,
  HardDrive,
  Package,
  FileText,
  Layers,
  Database,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AnalysisItem {
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

interface CleanupJobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  totalFreedFormatted?: string;
  error?: string;
}

// ============================================
// CONFIG
// ============================================

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; label: string; apiEndpoint: string }> = {
  'Docker Build Cache': {
    icon: Layers,
    label: 'Cache Build Docker',
    apiEndpoint: '/optimization/clean/docker-cache',
  },
  'Docker Unused Images': {
    icon: Package,
    label: 'Immagini non usate',
    apiEndpoint: '/optimization/prune/unused-images',
  },
  'Docker Volumes': {
    icon: Database,
    label: 'Volumi Docker',
    apiEndpoint: '/optimization/prune/volumes',
  },
  'NPM Cache': {
    icon: Package,
    label: 'Cache NPM',
    apiEndpoint: '/optimization/clean/npm-cache',
  },
  'System Logs': {
    icon: FileText,
    label: 'Log di sistema',
    apiEndpoint: '/optimization/clean/logs',
  },
};

const RISK_CONFIG = {
  low: { label: 'Sicuro', className: 'badge-success' },
  medium: { label: 'Medio', className: 'badge-warning' },
  high: { label: 'Alto rischio', className: 'badge-error' },
};

// ============================================
// CLEANUP CARD COMPONENT
// ============================================

function CleanupCard({
  item,
  onCleaned,
}: {
  item: AnalysisItem;
  onCleaned: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const config = CATEGORY_CONFIG[item.name] || CATEGORY_CONFIG[item.category];
  const Icon = config?.icon || HardDrive;
  const risk = RISK_CONFIG[item.risk] || RISK_CONFIG.low;

  const handleClean = async () => {
    if (!config?.apiEndpoint) return;
    setLoading(true);
    setConfirm(false);
    try {
      await api.post(config.apiEndpoint);
      toast.success(`${item.name}: pulizia completata`);
      onCleaned();
    } catch {
      toast.error(`Errore durante la pulizia di ${item.name}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-muted/50 flex-shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {item.description}
              </p>
            </div>
          </div>
          <Badge className={`text-xs flex-shrink-0 ${risk.className}`}>
            {risk.label}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Dimensione attuale</p>
            <p className="text-lg font-bold text-foreground">{item.currentSizeFormatted}</p>
            {item.reclaimable > 0 && (
              <p className="text-xs text-success mt-0.5">
                ~{item.reclaimableFormatted} recuperabili
              </p>
            )}
          </div>

          {config?.apiEndpoint && (
            <div>
              {!confirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm(true)}
                  disabled={loading || item.reclaimable === 0}
                  className="gap-1.5"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Pulisci
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClean}
                    disabled={loading}
                  >
                    Conferma
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm(false)}
                  >
                    No
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MaintenancePage() {
  const [analysis, setAnalysis] = useState<AnalysisItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fullCleanupLoading, setFullCleanupLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<CleanupJobStatus | null>(null);
  const [jobPolling, setJobPolling] = useState<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const res = await api.get('/optimization/analyze');
      setAnalysis(res.data.data?.items || []);
    } catch {
      toast.error('Errore durante l\'analisi del disco');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
    return () => {
      if (jobPolling) clearInterval(jobPolling);
    };
  }, [fetchAnalysis]);

  const pollJobStatus = useCallback((jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/optimization/clean-all/status/${jobId}`);
        const status: CleanupJobStatus = res.data.data;
        setJobStatus(status);
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setJobPolling(null);
          setFullCleanupLoading(false);
          if (status.status === 'completed') {
            toast.success(`Pulizia completata! Spazio liberato: ${status.totalFreedFormatted || '0'}`);
            fetchAnalysis();
          } else {
            toast.error(`Pulizia fallita: ${status.error || 'Errore sconosciuto'}`);
          }
        }
      } catch {
        clearInterval(interval);
        setJobPolling(null);
        setFullCleanupLoading(false);
      }
    }, 2000);
    setJobPolling(interval);
  }, [fetchAnalysis]);

  const handleFullCleanup = async () => {
    setFullCleanupLoading(true);
    setJobStatus(null);
    try {
      const res = await api.post('/optimization/clean-all');
      const { jobId } = res.data.data;
      setJobStatus({ id: jobId, status: 'pending', progress: 0, currentStep: 'Avvio...' });
      pollJobStatus(jobId);
    } catch {
      toast.error('Errore nell\'avvio della pulizia completa');
      setFullCleanupLoading(false);
    }
  };

  const totalReclaimable = analysis.reduce((sum, item) => sum + item.reclaimable, 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        variants={fadeInUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            Manutenzione
          </h1>
          <p className="text-muted-foreground mt-1">
            Analisi e pulizia dello spazio disco
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalysis}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Analizza
          </Button>
          <Button
            size="sm"
            onClick={handleFullCleanup}
            disabled={fullCleanupLoading || totalReclaimable === 0}
            className="gap-1.5"
          >
            {fullCleanupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Pulizia Completa
          </Button>
        </div>
      </motion.div>

      {/* Total reclaimable banner */}
      {totalReclaimable > 0 && (
        <motion.div variants={fadeInUp}>
          <Card className="glass border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  {formatBytes(totalReclaimable)} di spazio recuperabili
                </p>
                <p className="text-sm text-muted-foreground">
                  Esegui la pulizia completa o le singole operazioni per liberare spazio
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Full cleanup progress */}
      {jobStatus && (
        <motion.div variants={fadeInUp}>
          <Card className="glass border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {jobStatus.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : jobStatus.status === 'failed' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                <div>
                  <p className="font-medium text-foreground">{jobStatus.currentStep}</p>
                  {jobStatus.status === 'completed' && jobStatus.totalFreedFormatted && (
                    <p className="text-sm text-success">
                      Liberato: {jobStatus.totalFreedFormatted}
                    </p>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-500',
                    jobStatus.status === 'failed' ? 'bg-destructive' : 'bg-primary'
                  )}
                  style={{ width: `${jobStatus.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{jobStatus.progress}%</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Analysis Grid */}
      {isAnalyzing ? (
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </motion.div>
      ) : analysis.length > 0 ? (
        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {analysis.map((item) => (
            <motion.div key={item.name} variants={fadeInUp}>
              <CleanupCard item={item} onCleaned={fetchAnalysis} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp}>
          <Card className="glass border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nessun dato disponibile. Clicca Analizza per iniziare.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
