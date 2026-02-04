'use client';

import { useState } from 'react';
import { Mail, Edit2, Trash2, Key, MoreVertical, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmailAccount } from '@/store/emailStore';

interface EmailAccountCardProps {
  email: EmailAccount;
  onEdit: (email: EmailAccount) => void;
  onDelete: (id: string) => void;
  onChangePassword: (email: EmailAccount) => void;
}

export function EmailAccountCard({
  email,
  onEdit,
  onDelete,
  onChangePassword,
}: EmailAccountCardProps) {
  const [showActions, setShowActions] = useState(false);

  const usagePercentage = email.usedSpace && email.quota
    ? Math.round((email.usedSpace / email.quota) * 100)
    : 0;

  const formatSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb} MB`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 75) return 'text-warning';
    return 'text-success';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {email.email}
              </h3>
              {email.clientName && (
                <p className="text-sm text-muted-foreground">
                  {email.clientName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={email.isActive ? 'success' : 'default'}>
              {email.isActive ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Attivo
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Inattivo
                </>
              )}
            </Badge>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      onEdit(email);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted hover:bg-accent flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Modifica Impostazioni
                  </button>
                  <button
                    onClick={() => {
                      onChangePassword(email);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted hover:bg-accent flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Cambia Password
                  </button>
                  <button
                    onClick={() => {
                      onDelete(email.id);
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Storage Usage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Uso Spazio</span>
              <span className={`font-semibold ${getUsageColor(usagePercentage)}`}>
                {email.usedSpace ? formatSize(email.usedSpace) : '0 MB'} / {formatSize(email.quota)}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usagePercentage >= 90
                    ? 'bg-destructive'
                    : usagePercentage >= 75
                    ? 'bg-warning'
                    : 'bg-success'
                }`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {usagePercentage}% utilizzato
            </p>
          </div>

          {/* Email Settings */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Risposta Automatica</p>
              <p className="text-sm font-medium text-foreground">
                {email.autoReply ? 'Abilitata' : 'Disabilitata'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inoltro</p>
              <p className="text-sm font-medium text-foreground">
                {email.forwardTo || 'Nessuno'}
              </p>
            </div>
          </div>

          {/* Notes */}
          {email.notes && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm text-foreground">{email.notes}</p>
            </div>
          )}

          {/* Hostinger Status */}
          {email.hostingerId && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Badge variant="info" className="text-xs">
                Sincronizzato con Hostinger
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
