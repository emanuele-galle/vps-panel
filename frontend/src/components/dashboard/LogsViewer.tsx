'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, Trash2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { projectsApi, dockerApi } from '@/lib/api';
import { Container } from '@/types';

interface LogsViewerProps {
  projectId: string;
  containers?: Container[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function LogsViewer({
  projectId,
  containers = [],
  autoRefresh = false,
  refreshInterval = 5000,
}: LogsViewerProps) {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tailLines, setTailLines] = useState<number>(100);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState<string>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let logsData = '';

      if (selectedContainer === 'all') {
        // Fetch project logs (all containers combined)
        const response = await projectsApi.getLogs(projectId, tailLines);
        logsData = response.data.data?.logs || '';
      } else {
        // Fetch specific container logs
        const response = await dockerApi.getContainerLogs(selectedContainer, tailLines);
        logsData = response.data.data?.logs || '';
      }

      setLogs(logsData);

      if (autoScroll && logsContainerRef.current) {
        setTimeout(() => {
          // Use scrollTop instead of scrollIntoView to avoid scrolling the entire page
          if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [projectId, tailLines, autoRefresh, refreshInterval, selectedContainer]);

  const handleDownload = () => {
    const containerName = selectedContainer === 'all' ? 'all' : selectedContainer;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${containerName}-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs('');
  };

  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;

    setAutoScroll(isAtBottom);
  };

  // Parse logs to add syntax highlighting
  const formatLogs = (rawLogs: string) => {
    return rawLogs.split('\n').map((line, index) => {
      // Determine line color based on content
      let colorClass = 'text-foreground';

      if (line.includes('ERROR') || line.includes('error') || line.includes('Error')) {
        colorClass = 'text-destructive';
      } else if (line.includes('WARN') || line.includes('warn') || line.includes('Warning')) {
        colorClass = 'text-warning';
      } else if (line.includes('INFO') || line.includes('info')) {
        colorClass = 'text-primary';
      } else if (line.includes('DEBUG') || line.includes('debug')) {
        colorClass = 'text-muted-foreground';
      } else if (line.startsWith('[')) {
        // Container name prefix
        const match = line.match(/^\[([^\]]+)\]/);
        if (match) {
          const containerName = match[1];
          const rest = line.substring(match[0].length);
          return (
            <div key={index} className="hover:bg-card/50">
              <span className="text-purple-400">[{containerName}]</span>
              <span className={colorClass}>{rest}</span>
            </div>
          );
        }
      }

      return (
        <div key={index} className={`${colorClass} hover:bg-card/50`}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      {/* Container Tabs */}
      {containers.length > 0 && (
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto border-b border-border">
          <button
            onClick={() => setSelectedContainer('all')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedContainer === 'all'
                ? 'bg-card text-white'
                : 'text-muted-foreground hover:bg-muted hover:bg-accent'
            }`}
          >
            <Box className="h-4 w-4" />
            Tutti
          </button>
          {containers.map((container) => (
            <button
              key={container.id}
              onClick={() => setSelectedContainer(container.name)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                selectedContainer === container.name
                  ? 'bg-card text-white'
                  : 'text-muted-foreground hover:bg-muted hover:bg-accent'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${
                container.status === 'RUNNING' ? 'bg-success' : 'bg-muted-foreground'
              }`} />
              {container.name.replace(/^[^-]+-/, '')}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">
            {selectedContainer === 'all'
              ? 'Logs Progetto'
              : selectedContainer || 'Container Logs'}
          </h3>

          {/* Tail Lines Selector */}
          <select
            value={tailLines}
            onChange={(e) => setTailLines(Number(e.target.value))}
            className="text-sm px-2 py-1 border border-border rounded bg-card text-foreground"
          >
            <option value="50">Ultime 50 righe</option>
            <option value="100">Ultime 100 righe</option>
            <option value="200">Ultime 200 righe</option>
            <option value="500">Ultime 500 righe</option>
            <option value="1000">Ultime 1000 righe</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-scroll Toggle */}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-border"
            />
            Auto-scroll
          </label>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!logs}
          >
            <Download className="h-4 w-4" />
          </Button>

          {/* Clear Button */}
          <Button variant="outline" size="sm" onClick={handleClear} disabled={!logs}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Logs Content */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="p-4 h-[500px] overflow-y-auto bg-card dark:bg-black font-mono text-sm"
      >
        {error && (
          <div className="text-destructive mb-4">
            <p className="font-semibold">Errore caricamento logs:</p>
            <p>{error}</p>
          </div>
        )}

        {isLoading && !logs && (
          <div className="text-muted-foreground flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-border border-t-transparent"></div>
            <span>Caricamento logs...</span>
          </div>
        )}

        {!isLoading && !error && !logs && (
          <div className="text-muted-foreground">Nessun log disponibile per questo container</div>
        )}

        {logs && (
          <div className="whitespace-pre-wrap break-words">
            {formatLogs(logs)}
          </div>
        )}

        <div ref={logsEndRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {logs.split('\n').filter((line) => line.trim()).length} righe di log
        </span>
        {autoRefresh && (
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse"></span>
            Auto-refresh ogni {refreshInterval / 1000}s
          </span>
        )}
      </div>
    </div>
  );
}
