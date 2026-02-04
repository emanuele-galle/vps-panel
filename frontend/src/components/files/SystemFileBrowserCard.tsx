'use client';

import { Server, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
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
  username?: string;
}

interface SystemFileBrowserCardProps {
  instance: FileBrowserInstance | null;
}

export function SystemFileBrowserCard({ instance }: SystemFileBrowserCardProps) {
  const handleOpen = () => {
    if (instance?.url) {
      window.open(instance.url, '_blank');
    }
  };

  if (!instance) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6">
          <div className="text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive">
              System FileBrowser not available
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check docker-compose configuration
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-warning" />
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                System Files
                <Shield className="h-4 w-4 text-warning" />
              </h3>
              <p className="text-sm text-muted-foreground">
                Full VPS filesystem access
              </p>
            </div>
          </div>

          <Badge variant={instance.isRunning ? 'success' : 'error'}>
            {instance.isRunning ? 'In esecuzione' : 'Offline'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="bg-warning/15 border border-warning/40 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-warning">
                <strong>Admin Only:</strong> Full access to /var/www directory.
                Be careful when modifying system files.
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mount Point:</span>
              <span className="font-mono text-foreground">/var/www</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Port:</span>
              <span className="font-mono text-foreground">
                {instance.port}
              </span>
            </div>
            {instance.username && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span className="font-mono text-foreground">
                  {instance.username}
                </span>
              </div>
            )}
          </div>

          {/* Action */}
          <Button
            onClick={handleOpen}
            disabled={!instance.isRunning}
            className="w-full bg-warning hover:bg-warning/80 text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open System Files
          </Button>

          {!instance.isRunning && (
            <p className="text-xs text-center text-muted-foreground">
              Container is offline. Check docker-compose status.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
