'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { X, Circle } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface WebTerminalProps {
  containerId: string;
  containerName?: string;
  onClose?: () => void;
}

export function WebTerminal({ containerId, containerName, onClose }: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWsUrl = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '').replace(/\/api$/, '') || 'localhost:3001';
    return `${wsProtocol}//${apiHost}/ws/terminal/${containerId}`;
  }, [containerId]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      scrollback: 5000,
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Fit after a brief delay to let DOM settle
    setTimeout(() => fitAddon.fit(), 50);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data') {
          term.write(msg.data);
        } else if (msg.type === 'connected') {
          term.write('\r\n\x1b[32mConnesso al container.\x1b[0m\r\n\r\n');
        } else if (msg.type === 'exit') {
          term.write(`\r\n\x1b[31mProcesso terminato (exit code: ${msg.exitCode})\x1b[0m\r\n`);
          setConnected(false);
        }
      } catch {
        // Raw data
        term.write(event.data);
      }
    };

    ws.onclose = (event) => {
      setConnected(false);
      if (event.code === 4001) {
        setError('Autenticazione richiesta');
      } else if (event.code === 4003) {
        setError('Accesso admin richiesto');
      } else if (event.code === 4004) {
        setError('Container non trovato o non in esecuzione');
      } else if (event.code === 4005) {
        setError(event.reason || 'Errore creazione sessione');
      } else if (event.code !== 1000) {
        term.write('\r\n\x1b[31mConnessione chiusa.\x1b[0m\r\n');
      }
    };

    ws.onerror = () => {
      setError('Errore connessione WebSocket');
      setConnected(false);
    };

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          }));
        }
      } catch {
        // Ignore resize errors
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [containerId, getWsUrl]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-sm text-gray-400 font-mono">
            {containerName || containerId.substring(0, 12)}
          </span>
          <div className="flex items-center gap-1.5">
            <Circle className={`h-2.5 w-2.5 fill-current ${connected ? 'text-green-400' : 'text-red-400'}`} />
            <span className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connesso' : 'Disconnesso'}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Chiudi terminale"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 text-red-400 text-sm border-b border-red-900/50">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="w-full"
        style={{ height: '400px', backgroundColor: '#0d1117' }}
      />
    </div>
  );
}
