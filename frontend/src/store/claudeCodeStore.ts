import { create } from 'zustand';
import { claudeCodeApi } from '@/lib/api';

interface ClaudeCodeSession {
  id: string;
  status: 'STARTING' | 'RUNNING' | 'IDLE' | 'STOPPED' | 'ERROR';
  workingDir: string;
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  lastActivityAt?: string;
}

interface ClaudeCodeMessage {
  type: 'content' | 'error' | 'raw' | 'system';
  content: string;
  timestamp: Date;
}

interface UsageStats {
  totalTokens: number;
  totalCostCents: number;
  byDay: Array<{ date: string; tokens: number; costCents: number }>;
  byProject: Array<{ projectId: string; projectName: string; tokens: number; costCents: number }>;
}

interface ApiKeyInfo {
  hasPersonalKey: boolean;
  personalKey?: {
    name: string;
    maskedKey: string;
    isActive: boolean;
    monthlyLimitCents: number | null;
    currentMonthCents: number;
    createdAt: string;
  };
  hasSystemKey: boolean;
  systemKeyName?: string;
}

interface ClaudeCodeState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  ws: WebSocket | null;

  // Session state
  sessions: ClaudeCodeSession[];
  currentSession: ClaudeCodeSession | null;
  isExecuting: boolean;

  // Messages
  messages: ClaudeCodeMessage[];

  // Usage & API keys
  usageStats: UsageStats | null;
  apiKeyInfo: ApiKeyInfo | null;

  // Errors
  error: string | null;
  isLoading: boolean;

  // Actions - Connection
  connect: (onMessage?: (msg: ClaudeCodeMessage) => void) => Promise<void>;
  disconnect: () => void;

  // Actions - Sessions
  startSession: (projectId?: string) => Promise<void>;
  stopSession: (sessionId?: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchAllSessions: () => Promise<void>;

  // Actions - Prompt execution
  sendPrompt: (prompt: string) => Promise<void>;
  clearMessages: () => void;

  // Actions - Usage
  fetchUsageStats: (startDate?: string, endDate?: string, userId?: string) => Promise<void>;

  // Actions - API Keys
  fetchApiKeyInfo: () => Promise<void>;
  setApiKey: (apiKey: string, name?: string, monthlyLimitCents?: number) => Promise<void>;
  deleteApiKey: () => Promise<void>;
  setSystemApiKey: (apiKey: string, name?: string) => Promise<void>;
}

// LocalStorage keys
const STORAGE_KEYS = {
  SESSION_ID: 'claude_code_session_id',
  MESSAGES: 'claude_code_messages',
};

// Helper to load from localStorage
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Helper to save to localStorage
const saveToStorage = (key: string, value: any): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
};

export const useClaudeCodeStore = create<ClaudeCodeState>((set, get) => ({
  // Initial state - try to restore from localStorage
  isConnected: false,
  isConnecting: false,
  ws: null,
  sessions: [],
  currentSession: loadFromStorage(STORAGE_KEYS.SESSION_ID, null),
  isExecuting: false,
  messages: loadFromStorage(STORAGE_KEYS.MESSAGES, []).map((m: any) => ({
    ...m,
    timestamp: new Date(m.timestamp)
  })),
  usageStats: null,
  apiKeyInfo: null,
  error: null,
  isLoading: false,

  // Connect to WebSocket
  connect: async (onMessage) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    set({ isConnecting: true, error: null });

    try {
      const wsUrl = claudeCodeApi.getWebSocketUrl();
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        set({ isConnected: true, isConnecting: false, ws: socket });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              // Connection confirmed
              break;

            case 'session_started':
              const newSession = {
                id: data.sessionId,
                status: 'RUNNING' as const,
                workingDir: data.workingDir,
                createdAt: new Date().toISOString()
              };
              set({ currentSession: newSession });
              saveToStorage(STORAGE_KEYS.SESSION_ID, newSession);
              break;

            case 'execution_started':
              set({ isExecuting: true });
              break;

            case 'output':
            case 'content':
            case 'raw':
              // Handle various output formats from Claude
              let outputContent = '';

              // Check if content is an array (Claude message format)
              if (Array.isArray(data.content)) {
                outputContent = data.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('\n');
              } else if (typeof data.content === 'object' && data.content?.text) {
                outputContent = data.content.text;
              } else if (typeof data.content === 'string') {
                outputContent = data.content;
              }

              // Skip empty messages
              if (!outputContent.trim()) break;

              const message: ClaudeCodeMessage = {
                type: data.type === 'error' ? 'error' : 'content',
                content: outputContent,
                timestamp: new Date()
              };
              set((state) => {
                const newMessages = [...state.messages, message];
                saveToStorage(STORAGE_KEYS.MESSAGES, newMessages);
                return { messages: newMessages };
              });
              onMessage?.(message);
              break;

            case 'execution_completed':
              set({ isExecuting: false });
              break;

            case 'session_stopped':
              const { currentSession } = get();
              if (currentSession?.id === data.sessionId) {
                set({ currentSession: null });
                localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
              }
              break;

            case 'error':
              set({
                error: data.message,
                isExecuting: false
              });
              const errorMsg: ClaudeCodeMessage = {
                type: 'error',
                content: data.message,
                timestamp: new Date()
              };
              set((state) => ({
                messages: [...state.messages, errorMsg]
              }));
              onMessage?.(errorMsg);
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({
          isConnected: false,
          isConnecting: false,
          error: 'Errore di connessione WebSocket'
        });
      };

      socket.onclose = () => {
        set({
          isConnected: false,
          isConnecting: false,
          ws: null
        });
      };

    } catch (error: any) {
      set({
        isConnecting: false,
        error: error.message
      });
    }
  },

  // Disconnect WebSocket
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false, currentSession: null });
    }
  },

  // Start a new session
  startSession: async (projectId) => {
    const { ws, isConnected, currentSession } = get();

    // Try to reconnect to existing session first (after page refresh)
    if (currentSession && !isConnected) {
      try {
        const response = await claudeCodeApi.reconnectSession(currentSession.id);
        set({
          currentSession: {
            ...currentSession,
            status: 'RUNNING'
          },
          error: null
        });
        // Re-establish WebSocket connection after successful reconnect
        await get().connect();
        return;
      } catch (error) {
        // Reconnection failed - clear old session and create new one
        console.warn('Failed to reconnect to session, creating new one');
        localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        set({ currentSession: null });
      }
    }

    // If using WebSocket
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'start',
        projectId
      }));
      return;
    }

    // Fallback to HTTP
    set({ isLoading: true, error: null });
    try {
      const response = await claudeCodeApi.startSession(projectId);
      const newSession = {
        id: response.data.data.sessionId,
        status: 'RUNNING' as const,
        workingDir: response.data.data.workingDir,
        createdAt: new Date().toISOString()
      };
      set({
        currentSession: newSession,
        isLoading: false
      });
      saveToStorage(STORAGE_KEYS.SESSION_ID, newSession);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Stop a session
  stopSession: async (sessionId) => {
    const { ws, isConnected, currentSession } = get();
    const targetSessionId = sessionId || currentSession?.id;

    if (!targetSessionId) return;

    // If using WebSocket
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'stop',
        sessionId: targetSessionId
      }));
      return;
    }

    // Fallback to HTTP
    set({ isLoading: true, error: null });
    try {
      await claudeCodeApi.stopSession(targetSessionId);
      if (currentSession?.id === targetSessionId) {
        set({ currentSession: null });
      }
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch user's sessions
  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await claudeCodeApi.getSessions();
      set({ sessions: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch all sessions (admin)
  fetchAllSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await claudeCodeApi.getAllSessions();
      set({ sessions: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Send a prompt
  sendPrompt: async (prompt) => {
    const { ws, isConnected, currentSession } = get();

    if (!currentSession) {
      set({ error: 'Nessuna sessione attiva' });
      return;
    }

    // Add user message to history
    set((state) => ({
      messages: [...state.messages, {
        type: 'system' as const,
        content: `> ${prompt}`,
        timestamp: new Date()
      }]
    }));

    // If using WebSocket
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'prompt',
        sessionId: currentSession.id,
        prompt
      }));
      set({ isExecuting: true });
      return;
    }

    // Fallback to HTTP (collects all output at once)
    set({ isExecuting: true, error: null });
    try {
      const response = await claudeCodeApi.executePrompt(currentSession.id, prompt);
      const outputs = response.data.data.outputs || [];

      set((state) => ({
        messages: [
          ...state.messages,
          ...outputs.map((o: any) => ({
            type: o.type === 'error' ? 'error' : 'content',
            content: o.content || '',
            timestamp: new Date()
          }))
        ],
        isExecuting: false
      }));
    } catch (error: any) {
      set({
        error: error.message,
        isExecuting: false,
        messages: [...get().messages, {
          type: 'error',
          content: error.message,
          timestamp: new Date()
        }]
      });
    }
  },

  // Clear messages
  clearMessages: () => {
    set({ messages: [] });
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  },

  // Fetch usage stats
  fetchUsageStats: async (startDate, endDate, userId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await claudeCodeApi.getUsageStats({ startDate, endDate, userId });
      set({ usageStats: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Fetch API key info
  fetchApiKeyInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await claudeCodeApi.getApiKeyInfo();
      set({ apiKeyInfo: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Set personal API key
  setApiKey: async (apiKey, name, monthlyLimitCents) => {
    set({ isLoading: true, error: null });
    try {
      await claudeCodeApi.setApiKey({ apiKey, name, monthlyLimitCents });
      await get().fetchApiKeyInfo();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Delete personal API key
  deleteApiKey: async () => {
    set({ isLoading: true, error: null });
    try {
      await claudeCodeApi.deleteApiKey();
      await get().fetchApiKeyInfo();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Set system API key (admin)
  setSystemApiKey: async (apiKey, name) => {
    set({ isLoading: true, error: null });
    try {
      await claudeCodeApi.setSystemApiKey({ apiKey, name });
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  }
}));
