/**
 * Error state component for VPS Panel
 * Displays error messages with retry functionality
 */

'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw, XCircle, WifiOff, ShieldAlert, ServerCrash } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message/description */
  message: string;
  /** Retry action */
  onRetry?: () => void;
  /** Dismiss action */
  onDismiss?: () => void;
  /** Visual variant */
  variant?: 'inline' | 'card' | 'fullpage' | 'alert';
  /** Additional className */
  className?: string;
  /** Is currently retrying */
  isRetrying?: boolean;
  /** Error code for specific handling */
  errorCode?: string;
}

// Map error codes to appropriate icons
function getErrorIcon(errorCode?: string): LucideIcon {
  if (!errorCode) return AlertCircle;
  
  if (errorCode.includes('NETWORK') || errorCode.includes('CONNECTION')) {
    return WifiOff;
  }
  if (errorCode.includes('AUTH') || errorCode === '401' || errorCode === '403') {
    return ShieldAlert;
  }
  if (errorCode.includes('SERVER') || errorCode.startsWith('5')) {
    return ServerCrash;
  }
  return XCircle;
}

export function ErrorState({
  title = 'Si è verificato un errore',
  message,
  onRetry,
  onDismiss,
  variant = 'card',
  className,
  isRetrying = false,
  errorCode,
}: ErrorStateProps) {
  const Icon = getErrorIcon(errorCode);

  // Alert variant - compact inline alert
  if (variant === 'alert') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{message}</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="ml-2 h-7 px-2"
            >
              {isRetrying ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                'Riprova'
              )}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Inline variant - minimal inline error
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2 text-destructive text-sm', className)}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="h-6 px-2"
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // Fullpage variant - centered error for empty pages
  if (variant === 'fullpage') {
    return (
      <div
        className={cn(
          'flex h-full min-h-[400px] flex-col items-center justify-center text-center px-6',
          className
        )}
      >
        <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">{message}</p>
        <div className="mt-6 flex gap-3">
          {onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Riprovo...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Riprova
                </>
              )}
            </Button>
          )}
          {onDismiss && (
            <Button variant="outline" onClick={onDismiss}>
              Chiudi
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Card variant (default) - error in a card container
  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/30 bg-destructive/5 p-6',
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <div className="mt-4 flex gap-2">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    Riprovo...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Riprova
                  </>
                )}
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
              >
                Chiudi
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Pre-configured error states for common scenarios

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Errore di connessione"
      message="Impossibile connettersi al server. Verifica la tua connessione internet e riprova."
      onRetry={onRetry}
      errorCode="NETWORK"
      variant="card"
    />
  );
}

export function ServerError({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <ErrorState
      title="Errore del server"
      message={message || 'Il server ha riscontrato un problema. Riprova tra qualche istante.'}
      onRetry={onRetry}
      errorCode="SERVER"
      variant="card"
    />
  );
}

export function AuthError({ onLogin }: { onLogin?: () => void }) {
  return (
    <ErrorState
      title="Sessione scaduta"
      message="La tua sessione è scaduta. Effettua nuovamente il login."
      onRetry={onLogin}
      errorCode="AUTH"
      variant="fullpage"
    />
  );
}
