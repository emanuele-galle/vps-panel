'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Server } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { isLoading: authLoading } = useAuth(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password, twoFactorCode || undefined);

      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Credenziali non valide');
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="space-y-4 items-center text-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Server className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-foreground leading-tight">VPS Console</p>
              <p className="text-xs text-muted-foreground">by FODI S.r.l.</p>
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold">Accedi</CardTitle>
            <CardDescription>
              Inserisci le tue credenziali per accedere al pannello
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {!requiresTwoFactor ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="email@esempio.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Codice Autenticazione a Due Fattori</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Inserisci il codice a 6 cifre dalla tua app di autenticazione
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Accesso in corso...' : requiresTwoFactor ? 'Verifica Codice' : 'Accedi'}
            </Button>

            {requiresTwoFactor && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setTwoFactorCode('');
                  setError('');
                }}
              >
                Indietro
              </Button>
            )}

            <p className="text-sm text-center text-muted-foreground">
              Non hai un account? Contatta l'amministratore per richiedere l'accesso
            </p>
            <p className="text-xs text-center text-muted-foreground/50 pt-2">
              VPS Console v1.7.1 &middot; FODI S.r.l.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
