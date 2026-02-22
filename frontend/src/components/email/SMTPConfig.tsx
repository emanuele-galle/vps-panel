'use client';

import { useState } from 'react';
import { Server, Copy, Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function SMTPConfig() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copiato negli appunti');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('Errore durante la copia');
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Server className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Configurazione SMTP - Email Transazionali</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Usa queste credenziali per configurare l&apos;invio di email transazionali dal sistema
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Host SMTP</Label>
          <div className="flex gap-2">
            <Input value="smtp.hostinger.com" readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard('smtp.hostinger.com', 'host')}
            >
              {copiedField === 'host' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Porta</Label>
          <div className="flex gap-2">
            <Input value="465 (SSL) / 587 (STARTTLS)" readOnly className="font-mono text-sm" />
            <Button variant="outline" size="sm" onClick={() => copyToClipboard('465', 'port')}>
              {copiedField === 'port' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Username</Label>
          <div className="flex gap-2">
            <Input value={process.env.NEXT_PUBLIC_SMTP_USER || ''} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(process.env.NEXT_PUBLIC_SMTP_USER || '', 'username')}
            >
              {copiedField === 'username' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Password</Label>
          <div className="flex gap-2">
            <Input value={process.env.NEXT_PUBLIC_SMTP_PASSWORD || ''} type="password" readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(process.env.NEXT_PUBLIC_SMTP_PASSWORD || '', 'password')}
            >
              {copiedField === 'password' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <strong>Nota di sicurezza:</strong> Queste credenziali sono solo per l&apos;invio di email
          transazionali (notifiche, reset password, ecc.). Non condividere queste credenziali.
        </p>
      </div>
    </div>
  );
}
