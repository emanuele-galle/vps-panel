'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Eye,
  Clock,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useContainersStore } from '@/store/containersStore';
import { DockerContainer } from '@/types';

interface ContainerCardProps {
  container: DockerContainer;
}

export function ContainerCard({ container }: ContainerCardProps) {
  const router = useRouter();
  const { startContainer, stopContainer, restartContainer, removeContainer, containerSizes, fetchContainerSizes, isLoadingSizes } =
    useContainersStore();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch sizes on first mount if not already loaded
  useEffect(() => {
    if (Object.keys(containerSizes).length === 0 && !isLoadingSizes) {
      fetchContainerSizes();
    }
  }, []);

  // Get size for this container
  const getContainerSize = () => {
    const containerId = container.Id.substring(0, 12);
    const containerName = getContainerName(container.Names);
    return containerSizes[containerId] || containerSizes[containerName];
  };

  const getStatusVariant = (
    state: string
  ): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'success';
      case 'exited':
      case 'stopped':
        return 'error';
      case 'created':
        return 'info';
      case 'paused':
        return 'warning';
      case 'restarting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatCreatedDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getContainerName = (names: string[]) => {
    if (!names || names.length === 0) return 'Unknown';
    return names[0].replace(/^\//, '');
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startContainer(container.Id);
    } catch (error: any) {
      console.error('Failed to start container:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await stopContainer(container.Id);
    } catch (error: any) {
      console.error('Failed to stop container:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await restartContainer(container.Id);
    } catch (error: any) {
      console.error('Failed to restart container:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const containerName = getContainerName(container.Names);
    if (
      !confirm(
        `Are you sure you want to remove "${containerName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const force = container.State.toLowerCase() === 'running';
      await removeContainer(container.Id, force);
    } catch (error: any) {
      console.error('Failed to remove container:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/containers/${container.Id}`);
  };

  const getProjectName = () => {
    const projectLabel = container.Labels?.['com.docker.compose.project'];
    return projectLabel || null;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {getContainerName(container.Names)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
              {container.Id.substring(0, 12)}
            </p>
          </div>
          <Badge variant={getStatusVariant(container.State)}>
            {container.State}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Image</p>
            <p className="text-sm font-medium text-foreground truncate">
              {container.Image}
            </p>
          </div>

          {getProjectName() && (
            <div>
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="text-sm font-medium text-foreground">
                {getProjectName()}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatCreatedDate(container.Created)}</span>
            </div>
            {container.Ports && container.Ports.length > 0 && (
              <div className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                <span>{container.Ports.length} port(s)</span>
              </div>
            )}
          </div>

          {container.Ports && container.Ports.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ports</p>
              <div className="flex flex-wrap gap-1">
                {container.Ports.slice(0, 3).map((port, index) => (
                  <Badge key={index} variant="default" className="text-xs">
                    {port.PublicPort
                      ? `${port.PublicPort}:${port.PrivatePort}`
                      : port.PrivatePort}
                  </Badge>
                ))}
                {container.Ports.length > 3 && (
                  <Badge variant="default" className="text-xs">
                    +{container.Ports.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground">Stato</p>
            <p className="text-xs text-foreground mt-0.5">
              {container.Status}
            </p>
          </div>

          {/* Container Size */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HardDrive className="h-3.5 w-3.5" />
            <span>Spazio:</span>
            {isLoadingSizes ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            ) : getContainerSize() ? (
              <span title={`Virtual: ${getContainerSize()?.virtualSizeFormatted || 'N/A'}`}>
                {getContainerSize()?.sizeFormatted || 'N/A'}
              </span>
            ) : (
              <span>N/A</span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1">
            {container.State.toLowerCase() === 'running' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStop}
                  disabled={isLoading}
                  className="h-8"
                >
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Stop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestart}
                  disabled={isLoading}
                  className="h-8"
                >
                  <RotateCw className="h-3.5 w-3.5 mr-1" />
                  Restart
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStart}
                disabled={isLoading}
                className="h-8"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Start
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetails}
              className="h-8"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
              className="h-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive hover:bg-destructive/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
