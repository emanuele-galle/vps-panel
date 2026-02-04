'use client';

import { useState } from 'react';
import { FolderOpen, Play, Square, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FileBrowserInstance {
  projectId: string;
  projectSlug: string;
  url: string;
  port: number;
  isRunning: boolean;
  containerId?: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface FileBrowserCardProps {
  project: Project;
  instance: FileBrowserInstance | null;
  onStart: (projectId: string) => Promise<void>;
  onStop: (projectId: string) => Promise<void>;
}

export function FileBrowserCard({
  project,
  instance,
  onStart,
  onStop,
}: FileBrowserCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await onStart(project.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await onStop(project.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBrowser = () => {
    if (instance?.url) {
      window.open(instance.url, '_blank');
    }
  };

  const isRunning = instance?.isRunning ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {project.slug}
              </p>
            </div>
          </div>

          <Badge
            variant={isRunning ? 'success' : 'default'}
            className="capitalize"
          >
            {isRunning ? 'In esecuzione' : 'Fermato'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Instance Information */}
          {instance && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Porta:</span>
                <span className="font-mono text-foreground">
                  {instance.port}
                </span>
              </div>
              {instance.containerId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    ID Container:
                  </span>
                  <span className="font-mono text-xs text-foreground">
                    {instance.containerId.substring(0, 12)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isRunning ? (
              <Button
                onClick={handleStart}
                disabled={isLoading || project.status !== 'running'}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Avvio...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Avvia FileBrowser
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleOpenBrowser}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apri FileBrowser
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Project Status Warning */}
          {project.status !== 'running' && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-xs text-warning">
                Il progetto deve essere in esecuzione per avviare FileBrowser
              </p>
            </div>
          )}

          {/* FileBrowser Info */}
          {!instance && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
              <p className="text-xs text-primary">
                FileBrowser ti permette di navigare e gestire i file del tuo progetto
                direttamente dall'interfaccia web.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
