'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useProjectsStore } from '@/store/projectsStore';
import { Logger } from '@/lib/logger';

const logger = Logger.create('ProjectsWebSocket');

interface WebSocketMessage {
  event: string;
  data: any;
  timestamp: number;
}

interface UseProjectsWebSocketOptions {
  projectId?: string;
  onProjectCreated?: (data: any) => void;
  onProjectUpdated?: (data: any) => void;
  onProjectDeleted?: (data: any) => void;
  onStatusChanged?: (data: any) => void;
  onCredentialsSynced?: (data: any) => void;
  onContainerStatusChanged?: (data: any) => void;
}

export function useProjectsWebSocket(options: UseProjectsWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  
  const { fetchProjects, fetchProject } = useProjectsStore();

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
    
    // Remove any existing protocol from host
    const cleanHost = host.replace(/^(wss?:\/\/|https?:\/\/)/, '');
    
    if (options.projectId) {
      return `${protocol}//${cleanHost}/ws/projects/${options.projectId}`;
    }
    return `${protocol}//${cleanHost}/ws/projects`;
  }, [options.projectId]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = getWsUrl();
    logger.debug('Connecting to WebSocket', { url: wsUrl });

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        logger.info('WebSocket connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          logger.warn('Failed to parse WebSocket message', { error });
        }
      };

      wsRef.current.onclose = (event) => {
        logger.info('WebSocket closed', { code: event.code, reason: event.reason });
        attemptReconnect();
      };

      wsRef.current.onerror = (error) => {
        logger.error('WebSocket error', { error });
      };
    } catch (error) {
      logger.error('Failed to connect WebSocket', { error });
      attemptReconnect();
    }
  }, [getWsUrl]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    logger.debug('Received WebSocket message', { event: message.event });

    switch (message.event) {
      case 'connected':
        logger.info('WebSocket connection confirmed');
        break;

      case 'project:created':
        options.onProjectCreated?.(message.data);
        // Auto-refresh projects list
        fetchProjects();
        break;

      case 'project:updated':
        options.onProjectUpdated?.(message.data);
        // If we're watching a specific project, refresh it
        if (options.projectId && message.data.projectId === options.projectId) {
          fetchProject(options.projectId);
        }
        break;

      case 'project:deleted':
        options.onProjectDeleted?.(message.data);
        fetchProjects();
        break;

      case 'project:status':
        options.onStatusChanged?.(message.data);
        if (options.projectId && message.data.projectId === options.projectId) {
          fetchProject(options.projectId);
        } else {
          fetchProjects();
        }
        break;

      case 'project:credentials':
        options.onCredentialsSynced?.(message.data);
        if (options.projectId && message.data.projectId === options.projectId) {
          fetchProject(options.projectId);
        }
        break;

      case 'project:container:status':
        options.onContainerStatusChanged?.(message.data);
        if (options.projectId && message.data.projectId === options.projectId) {
          fetchProject(options.projectId);
        }
        break;

      default:
        logger.debug('Unknown WebSocket event', { event: message.event });
    }
  }, [options, fetchProjects, fetchProject]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      logger.warn('Max reconnect attempts reached');
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    
    logger.info('Attempting reconnect', { 
      attempt: reconnectAttempts.current, 
      delay 
    });

    reconnectTimeout.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((projectId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', projectId }));
    }
  }, []);

  const unsubscribe = useCallback((projectId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', projectId }));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    subscribe,
    unsubscribe,
    reconnect: connect,
    disconnect
  };
}
