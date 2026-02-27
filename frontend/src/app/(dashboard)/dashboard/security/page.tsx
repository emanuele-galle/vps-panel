'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Shield, RefreshCw, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/motion';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ipAddress?: string;
  userId?: string;
  description: string;
  blocked?: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface SecurityStats {
  totalEvents: number;
  failedLogins: number;
  blockedRequests: number;
  suspiciousIPs: number;
  criticalEvents: number;
  highEvents: number;
}

// ============================================
// HELPERS
// ============================================

const SEVERITY_CONFIG = {
  LOW: { label: 'Bassa', className: 'bg-muted text-muted-foreground' },
  MEDIUM: { label: 'Media', className: 'badge-warning' },
  HIGH: { label: 'Alta', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  CRITICAL: { label: 'Critica', className: 'badge-error' },
};

function formatEventType(type: string | undefined): string {
  if (!type) return 'Evento';
  return type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${colorClass}/10`}>
            <Icon className={`h-5 w-5 ${colorClass}`} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function SecurityPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  // Admin only
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        api.get(`/security/events?hours=${hours}&limit=100`),
        api.get(`/security/stats?hours=${hours}`),
      ]);
      setEvents(eventsRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch {
      toast.error('Errore nel caricamento dei dati di sicurezza');
    } finally {
      setIsLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      const res = await api.post('/security/cleanup', { daysToKeep: 90 });
      toast.success(res.data.data?.message || 'Log di sicurezza puliti');
      setShowCleanupConfirm(false);
      fetchData();
    } catch {
      toast.error('Errore durante la pulizia dei log');
    } finally {
      setCleanupLoading(false);
    }
  };

  if (user?.role !== 'ADMIN') return null;

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
            <Shield className="h-7 w-7 text-primary" />
            Sicurezza
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoraggio eventi di sicurezza e accessi
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="text-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            <option value={24}>Ultime 24h</option>
            <option value={168}>Ultimi 7 giorni</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          {!showCleanupConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCleanupConfirm(true)}
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Pulisci log
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confermi?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCleanup}
                disabled={cleanupLoading}
              >
                {cleanupLoading ? 'In corso...' : 'Sì, pulisci'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCleanupConfirm(false)}
              >
                Annulla
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      {stats && (
        <motion.div
          variants={staggerContainer}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            title="Totale eventi"
            value={stats.totalEvents}
            icon={Shield}
            colorClass="text-primary"
          />
          <StatCard
            title="Login falliti"
            value={stats.failedLogins}
            icon={Shield}
            colorClass="text-warning"
          />
          <StatCard
            title="Richieste bloccate"
            value={stats.blockedRequests}
            icon={Shield}
            colorClass="text-orange-500"
          />
          <StatCard
            title="IP sospetti"
            value={stats.suspiciousIPs}
            icon={Shield}
            colorClass="text-destructive"
          />
        </motion.div>
      )}

      {/* Events Table */}
      <motion.div variants={fadeInUp}>
        <Card className="glass border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Eventi recenti ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="animate-spin h-6 w-6 border-2 border-border border-t-primary rounded-full mx-auto mb-2" />
                Caricamento eventi...
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
                Nessun evento di sicurezza nel periodo selezionato
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                      <th className="text-left px-4 py-3 font-medium">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium">Gravità</th>
                      <th className="text-left px-4 py-3 font-medium">IP</th>
                      <th className="text-left px-4 py-3 font-medium">Descrizione</th>
                      <th className="text-left px-4 py-3 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => {
                      const sev = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.LOW;
                      return (
                        <tr
                          key={event.id}
                          className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(event.createdAt), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs">
                              {formatEventType(event.eventType)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`text-xs ${sev.className}`}>
                              {sev.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {event.ipAddress || '—'}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <span className="line-clamp-2 text-foreground/80">
                              {event.description}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {event.blocked ? (
                              <Badge className="badge-error text-xs">Bloccato</Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground text-xs">
                                Registrato
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
