import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface WsMessage {
  type: string;
  data: unknown;
}

interface WebSocketContextValue {
  connected: boolean;
  send: (type: string, data?: unknown) => void;
  subscribe: (handler: (msg: WsMessage) => void) => () => void;
  lastMessage: WsMessage | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<(msg: WsMessage) => void>>(new Set());
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    let ticket = '';
    try {
      const res = await fetch('/api/ws-ticket', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        ticket = data.ticket ?? '';
      }
    } catch { /* unauthenticated — connect without ticket, server will close gracefully */ }

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (ticket) ws.send(JSON.stringify({ type: 'auth', data: { ticket } }));
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data);
        setLastMessage(msg);
        handlersRef.current.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current ?? undefined);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, data: unknown = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const subscribe = useCallback((handler: (msg: WsMessage) => void) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, send, subscribe, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}
