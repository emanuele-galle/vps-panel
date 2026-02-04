'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Play,
  Square,
  RefreshCw,
  MoreVertical,
  Terminal,
  FileText,
  Cpu,
  HardDrive,
  Network,
  Loader2,
  Box,
} from 'lucide-react';
import { useContainersStore } from '@/store/containersStore';
import { Container } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContainerControlsProps {
  container: Container;
  onLogsClick?: (containerId: string) => void;
  onTerminalClick?: (containerId: string) => void;
  compact?: boolean;
}

export function ContainerControls({
  container,
  onLogsClick,
  onTerminalClick,
  compact = false,
}: ContainerControlsProps) {
  const { startContainer, stopContainer, restartContainer } = useContainersStore();
  const [isLoading, setIsLoading] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'restart' | null>(null);

  const isRunning = container.status === 'RUNNING';
  const isStopped = container.status === 'EXITED' || container.status === 'STOPPED';

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setIsLoading(action);
    setConfirmAction(null);

    try {
      switch (action) {
        case 'start':
          await startContainer(container.id);
          toast.success(`Container ${container.name} avviato`);
          break;
        case 'stop':
          await stopContainer(container.id);
          toast.success(`Container ${container.name} fermato`);
          break;
        case 'restart':
          await restartContainer(container.id);
          toast.success(`Container ${container.name} riavviato`);
          break;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Operazione fallita';
      toast.error(`Errore: ${errorMsg}`);
    } finally {
      setIsLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-success';
      case 'exited':
      case 'stopped':
        return 'bg-muted/500';
      case 'restarting':
        return 'bg-warning/100';
      case 'paused':
        return 'bg-primary';
      default:
        return 'bg-destructive';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running':
        return 'In esecuzione';
      case 'exited':
      case 'stopped':
        return 'Fermato';
      case 'restarting':
        return 'Riavvio in corso';
      case 'paused':
        return 'In pausa';
      default:
        return status;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1.5">
          <span className={cn('w-2 h-2 rounded-full', getStatusColor(container.status))} />
          {getStatusLabel(container.status)}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isStopped && (
              <DropdownMenuItem
                onClick={() => handleAction('start')}
                disabled={isLoading !== null}
              >
                {isLoading === 'start' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Avvia
              </DropdownMenuItem>
            )}
            {isRunning && (
              <>
                <DropdownMenuItem
                  onClick={() => setConfirmAction('restart')}
                  disabled={isLoading !== null}
                >
                  {isLoading === 'restart' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Riavvia
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setConfirmAction('stop')}
                  disabled={isLoading !== null}
                  className="text-destructive"
                >
                  {isLoading === 'stop' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  Ferma
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {onLogsClick && (
              <DropdownMenuItem onClick={() => onLogsClick(container.id)}>
                <FileText className="h-4 w-4 mr-2" />
                Visualizza Logs
              </DropdownMenuItem>
            )}
            {onTerminalClick && (
              <DropdownMenuItem onClick={() => onTerminalClick(container.id)}>
                <Terminal className="h-4 w-4 mr-2" />
                Terminale
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === 'stop' ? 'Fermare il container?' : 'Riavviare il container?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === 'stop'
                  ? `Stai per fermare il container "${container.name}". I servizi associati non saranno più disponibili.`
                  : `Stai per riavviare il container "${container.name}". Ci sarà un breve downtime durante il riavvio.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction(confirmAction!)}
                className={confirmAction === 'stop' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {confirmAction === 'stop' ? 'Ferma' : 'Riavvia'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Box className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">{container.name}</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', getStatusColor(container.status))} />
            {getStatusLabel(container.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cpu className="h-4 w-4" />
            <span>Image: {container.image?.split(':')[0] || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span>ID: {container.dockerId?.slice(0, 12) || 'N/A'}</span>
          </div>
          {container.ports && container.ports.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Network className="h-4 w-4" />
              <span>
                Ports: {container.ports.map((p: any) => `${p.internal}:${p.external}`).join(', ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStopped && (
            <Button
              size="sm"
              onClick={() => handleAction('start')}
              disabled={isLoading !== null}
            >
              {isLoading === 'start' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Avvia
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmAction('restart')}
                disabled={isLoading !== null}
              >
                {isLoading === 'restart' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Riavvia
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmAction('stop')}
                disabled={isLoading !== null}
              >
                {isLoading === 'stop' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                Ferma
              </Button>
            </>
          )}
          {onLogsClick && (
            <Button size="sm" variant="ghost" onClick={() => onLogsClick(container.id)}>
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </Button>
          )}
          {onTerminalClick && (
            <Button size="sm" variant="ghost" onClick={() => onTerminalClick(container.id)}>
              <Terminal className="h-4 w-4 mr-2" />
              Shell
            </Button>
          )}
        </div>

        <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === 'stop' ? 'Fermare il container?' : 'Riavviare il container?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === 'stop'
                  ? `Stai per fermare il container "${container.name}". I servizi associati non saranno più disponibili.`
                  : `Stai per riavviare il container "${container.name}". Ci sarà un breve downtime durante il riavvio.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleAction(confirmAction!)}
                className={confirmAction === 'stop' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {confirmAction === 'stop' ? 'Ferma' : 'Riavvia'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default ContainerControls;
