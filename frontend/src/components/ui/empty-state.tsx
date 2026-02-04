/**
 * Empty state component for VPS Panel
 * Displays when lists or data containers have no content
 */

'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon, FolderOpen, Package, Database, Globe, Container, FileText } from 'lucide-react';

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Main title */
  title: string;
  /** Description text */
  description?: string;
  /** Action button config */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  /** Additional className */
  className?: string;
  /** Compact mode for smaller areas */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {/* Icon container with muted background */}
      <div
        className={cn(
          'rounded-full bg-muted border flex items-center justify-center',
          compact ? 'h-12 w-12 mb-3' : 'h-16 w-16 mb-4'
        )}
      >
        <Icon
          className={cn(
            'text-muted-foreground',
            compact ? 'h-6 w-6' : 'h-8 w-8'
          )}
        />
      </div>

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-muted-foreground max-w-sm',
            compact ? 'mt-1 text-xs' : 'mt-2 text-sm'
          )}
        >
          {description}
        </p>
      )}

      {/* Action button */}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || 'default'}
          className={compact ? 'mt-3' : 'mt-4'}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common use cases

export function EmptyProjects({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Nessun progetto"
      description="Inizia creando il tuo primo progetto o importandone uno esistente."
      action={
        onAdd
          ? {
              label: 'Crea Progetto',
              onClick: onAdd,
            }
          : undefined
      }
    />
  );
}

export function EmptyContainers({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Container}
      title="Nessun container"
      description="I container Docker appariranno qui quando saranno creati dai tuoi progetti."
      action={
        onAdd
          ? {
              label: 'Vai ai Progetti',
              onClick: onAdd,
              variant: 'outline',
            }
          : undefined
      }
    />
  );
}

export function EmptyDatabases({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Database}
      title="Nessun database"
      description="Crea un nuovo database per i tuoi progetti."
      action={
        onAdd
          ? {
              label: 'Crea Database',
              onClick: onAdd,
            }
          : undefined
      }
    />
  );
}

export function EmptyDomains({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Globe}
      title="Nessun dominio"
      description="Aggiungi un dominio ai tuoi progetti per renderli accessibili online."
      action={
        onAdd
          ? {
              label: 'Aggiungi Dominio',
              onClick: onAdd,
            }
          : undefined
      }
    />
  );
}

export function EmptyBackups({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="Nessun backup"
      description="Carica un backup ZIP per importarlo come nuovo progetto."
      action={
        onAdd
          ? {
              label: 'Carica Backup',
              onClick: onAdd,
            }
          : undefined
      }
    />
  );
}

export function EmptyFiles() {
  return (
    <EmptyState
      icon={FileText}
      title="Nessun file"
      description="Questa cartella è vuota."
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="Nessun risultato"
      description={'Nessun elemento trovato per "' + query + '". Prova con un termine diverso.'}
    />
  );
}
