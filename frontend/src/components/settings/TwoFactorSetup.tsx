'use client';

import { useState } from 'react';
import { Shield, Smartphone, Copy, Check, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: () => void;
}

type Step = 'idle' | 'setup' | 'verify' | 'disable';

export function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/2fa/setup');
      if (response.data.success) {
        setQrCode(response.data.data.qrCode);
        setSecret(response.data.data.secret);
        setStep('setup');
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Errore durante la configurazione';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Inserisci un codice di 6 cifre');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/2fa/enable', { code: verificationCode });
      toast.success('Autenticazione a due fattori abilitata!');
      setStep('idle');
      setVerificationCode('');
      setQrCode('');
      setSecret('');
      onStatusChange();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Codice non valido';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Inserisci un codice di 6 cifre');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/2fa/disable', { code: verificationCode });
      toast.success('Autenticazione a due fattori disabilitata');
      setStep('idle');
      setVerificationCode('');
      onStatusChange();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Codice non valido';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('idle');
    setVerificationCode('');
    setError(null);
    setQrCode('');
    setSecret('');
  };

  return (
    <>
      {/* Status and Actions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Autenticazione a Due Fattori
              </h3>
              <p className="text-sm text-muted-foreground">
                Aggiungi un ulteriore livello di sicurezza al tuo account
              </p>
            </div>
          </div>
          <Badge variant={isEnabled ? 'success' : 'default'}>
            {isEnabled ? 'Abilitato' : 'Disabilitato'}
          </Badge>
        </div>

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-primary mb-2">
            Come funziona:
          </h4>
          <ul className="text-xs text-primary space-y-1 list-disc list-inside">
            <li>Installa un'app di autenticazione (Google Authenticator, Authy, ecc.)</li>
            <li>Scansiona il codice QR con la tua app</li>
            <li>Inserisci il codice di verifica per completare la configurazione</li>
            <li>Avrai bisogno del codice ogni volta che effettui l'accesso</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={isEnabled ? () => setStep('disable') : handleSetup}
            disabled={isLoading}
            variant={isEnabled ? 'outline' : 'default'}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {isEnabled ? 'Disabilita 2FA' : 'Abilita 2FA'}
          </Button>
        </div>
      </div>

      {/* Setup Dialog */}
      <Dialog open={step === 'setup'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configura Autenticazione a Due Fattori
            </DialogTitle>
            <DialogDescription>
              Scansiona il codice QR con la tua app di autenticazione
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-card p-4 rounded-lg shadow-sm">
                {qrCode && (
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                )}
              </div>
            </div>

            {/* Manual Entry */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Non riesci a scansionare? Inserisci manualmente questo codice:
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {secret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Codice di verifica</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setVerificationCode(value);
                  setError(null);
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button
              onClick={handleEnable}
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Verifica e Abilita
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={step === 'disable'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Disabilita 2FA
            </DialogTitle>
            <DialogDescription>
              Inserisci il codice dalla tua app di autenticazione per disabilitare il 2FA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-sm text-warning">
                Attenzione: Disabilitando il 2FA, il tuo account sarà meno sicuro.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disable-code">Codice di verifica</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setVerificationCode(value);
                  setError(null);
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Disabilita 2FA
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
