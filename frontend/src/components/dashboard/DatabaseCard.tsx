'use client';

import { useState } from 'react';
import { Trash2, Copy, Eye, EyeOff, Database as DatabaseIcon, Key, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDatabasesStore } from '@/store/databasesStore';
import { Database } from '@/types';

interface DatabaseCardProps {
  database: Database;
}

export function DatabaseCard({ database }: DatabaseCardProps) {
  const { deleteDatabase, fetchConnectionString } = useDatabasesStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [connectionString, setConnectionString] = useState<string>('');

  const getTypeColor = (type: string): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (type) {
      case 'MYSQL':
        return 'info';
      case 'POSTGRESQL':
        return 'success';
      case 'MONGODB':
        return 'success';
      case 'REDIS':
        return 'error';
      case 'SQLITE':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      MYSQL: '🐬',
      POSTGRESQL: '🐘',
      MONGODB: '🍃',
      REDIS: '⚡',
      SQLITE: '📁',
    };
    return icons[type] || '🗄️';
  };

  // Generate Adminer URL with pre-filled credentials
  const getAdminerUrl = () => {
    const baseUrl = 'https://adminer.fodivps1.cloud';
    const params = new URLSearchParams();

    switch (database.type) {
      case 'POSTGRESQL':
        params.set('pgsql', database.host);
        break;
      case 'MYSQL':
        params.set('server', database.host);
        break;
      case 'MONGODB':
        params.set('mongo', database.host);
        break;
      default:
        params.set('server', database.host);
    }

    params.set('username', database.username);
    params.set('db', database.databaseName);

    return `${baseUrl}/?${params.toString()}`;
  };

  const handleOpenAdminer = () => {
    window.open(getAdminerUrl(), '_blank');
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete database "${database.name}"? This will also remove the Docker container. This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteDatabase(database.id);
    } catch (error: any) {
      console.error('Failed to delete database:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const handleShowConnectionString = async () => {
    if (!showConnectionString) {
      try {
        const connStr = await fetchConnectionString(database.id);
        setConnectionString(connStr);
        setShowConnectionString(true);
      } catch (error: any) {
        console.error('Failed to fetch connection string:', error.message);
      }
    } else {
      setShowConnectionString(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getTypeIcon(database.type)}</span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {database.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {database.databaseName}
                </p>
              </div>
            </div>
            {database.project && (
              <p className="text-sm text-muted-foreground mt-2">
                Project: {database.project.name}
              </p>
            )}
          </div>
          <Badge variant={getTypeColor(database.type)}>
            {database.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          {/* Connection Details */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Host</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono text-foreground">
                  {database.host}:{database.port}
                </code>
                <button
                  onClick={() => handleCopy(`${database.host}:${database.port}`, 'Host')}
                  className="p-1 hover:bg-muted hover:bg-accent rounded"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Username</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono text-foreground">
                  {database.username}
                </code>
                <button
                  onClick={() => handleCopy(database.username, 'Username')}
                  className="p-1 hover:bg-muted hover:bg-accent rounded"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Password</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono text-foreground">
                  {showPassword ? database.password : '••••••••'}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-muted hover:bg-accent rounded"
                >
                  {showPassword ? (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleCopy(database.password, 'Password')}
                  className="p-1 hover:bg-muted hover:bg-accent rounded"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Connection String */}
          {showConnectionString && connectionString && (
            <div className="bg-primary/10 rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-medium text-primary">
                  Connection String
                </span>
                <button
                  onClick={() => handleCopy(connectionString, 'Connection String')}
                  className="p-1 hover:bg-primary/20 hover:bg-primary/20 rounded"
                >
                  <Copy className="h-3 w-3 text-primary" />
                </button>
              </div>
              <code className="text-xs font-mono text-primary break-all">
                {connectionString}
              </code>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Size</p>
              <p className="font-medium text-foreground">
                {formatBytes(database.size)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Creato</p>
              <p className="font-medium text-foreground">
                {new Date(database.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border">
        <div className="flex flex-col gap-2 w-full">
          {/* Adminer Button - prominent */}
          {database.type !== 'REDIS' && database.type !== 'SQLITE' && (
            <Button
              onClick={handleOpenAdminer}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="sm"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Apri in Adminer
            </Button>
          )}

          {/* Secondary actions */}
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowConnectionString}
              className="h-8 flex-1"
            >
              <Key className="h-3.5 w-3.5 mr-1" />
              {showConnectionString ? 'Nascondi' : 'Connessione'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
              className="h-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive hover:bg-destructive/15"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Elimina
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
