'use client';

import { useState, useEffect } from 'react';
import { Shield, Monitor, Smartphone, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface SessionManagementProps {
  lastLoginAt?: string | null;
}

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: 'Sconosciuto', browser: 'Sconosciuto' };

  const device = /Mobile|Android|iPhone|iPad/.test(ua) ? 'Mobile' : 'Desktop';

  let browser = 'Sconosciuto';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';

  return { device, browser };
}

export function SessionManagement({ lastLoginAt }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/auth/sessions');
      if (response.data.success) {
        setSessions(response.data.data.sessions);
      }
    } catch (error) {
      toast.error('Errore nel caricamento delle sessioni');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    setIsRevoking(sessionId);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      toast.success('Sessione terminata');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Errore durante la terminazione';
      toast.error(message);
    } finally {
      setIsRevoking(null);
    }
  };

  const handleRevokeAllOther = async () => {
    setIsRevokingAll(true);
    try {
      const response = await api.delete('/auth/sessions');
      if (response.data.success) {
        const count = response.data.data.revokedCount;
        toast.success(`${count} sessioni terminate`);
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Errore durante la terminazione';
      toast.error(message);
    } finally {
      setIsRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Gestione Sessioni
            </h3>
            <p className="text-sm text-muted-foreground">
              Gestisci le tue sessioni attive su tutti i dispositivi
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const { device, browser } = parseUserAgent(session.userAgent);
            const DeviceIcon = device === 'Mobile' ? Smartphone : Monitor;

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  session.isCurrent
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/50 border-border '
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      session.isCurrent
                        ? 'bg-primary/20/50'
                        : 'bg-muted'
                    }`}
                  >
                    <DeviceIcon
                      className={`h-5 w-5 ${
                        session.isCurrent
                          ? 'text-primary'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {device} - {browser}
                      </p>
                      {session.isCurrent && (
                        <Badge variant="success" className="text-xs">
                          Sessione Corrente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      IP: {session.ipAddress || 'N/A'} - Creata:{' '}
                      {new Date(session.createdAt).toLocaleString('it-IT')}
                    </p>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={isRevoking === session.id}
                    className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                  >
                    {isRevoking === session.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}

          {sessions.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Nessuna sessione trovata
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {otherSessionsCount > 0
            ? `${otherSessionsCount} ${otherSessionsCount === 1 ? 'altra sessione attiva' : 'altre sessioni attive'}`
            : 'Nessuna altra sessione attiva'}
        </p>

        {otherSessionsCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isRevokingAll}>
                {isRevokingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Disconnetti Tutte le Altre Sessioni
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnetti tutte le altre sessioni?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione terminer&agrave; tutte le altre sessioni attive tranne quella
                  corrente. Dovrai effettuare nuovamente l&apos;accesso sugli altri dispositivi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRevokeAllOther}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Disconnetti Tutte
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
