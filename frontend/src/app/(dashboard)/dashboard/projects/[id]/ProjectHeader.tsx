'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Square, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getStatusVariant } from './utils';

interface ProjectHeaderProps {
  project: any;
  actionLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
}

export function ProjectHeader({
  project,
  actionLoading,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: ProjectHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/projects')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {project.slug}
          </p>
        </div>
        <Badge variant={getStatusVariant(project.status)}>
          {project.status}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {project.status === 'ACTIVE' ? (
          <>
            <Button
              variant="outline"
              onClick={onStop}
              disabled={actionLoading}
            >
              <Square className="h-4 w-4 mr-2" />
              Ferma
            </Button>
            <Button
              variant="outline"
              onClick={onRestart}
              disabled={actionLoading}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Riavvia
            </Button>
          </>
        ) : (
          <Button onClick={onStart} disabled={actionLoading}>
            <Play className="h-4 w-4 mr-2" />
            Avvia
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onDelete}
          disabled={actionLoading}
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive hover:bg-destructive/15"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Elimina
        </Button>
      </div>
    </div>
  );
}
