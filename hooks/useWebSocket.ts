import { useCallback, useEffect, useRef, useState } from "react";
import type { WSEvent, WSEventType } from "@/lib/types";

export type WSStatus = "connecting" | "connected" | "disconnected" | "error";

type EventHandler = (payload: Record<string, unknown>) => void;

interface UseWebSocketOptions {
  onEvent?: (event: WSEvent) => void;
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  status: WSStatus;
  send: (event: WSEvent) => void;
  on: (type: WSEventType, handler: EventHandler) => () => void;
  disconnect: () => void;
}

const WS_BASE = (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000").replace(
  /^http/,
  "ws"
);

export function useWebSocket(
  sessionId: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { onEvent, reconnectDelayMs = 2000, maxReconnectAttempts = 5 } = options;

  const [status, setStatus] = useState<WSStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<WSEventType, Set<EventHandler>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!sessionId || !isMountedRef.current) return;

    clearReconnectTimer();

    const url = `${WS_BASE}/ws/${sessionId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const parsed: WSEvent = JSON.parse(event.data as string);
        onEvent?.(parsed);
        const handlers = handlersRef.current.get(parsed.type);
        handlers?.forEach((h) => h(parsed.payload));
      } catch {
        // Silently ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
      setStatus("error");
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setStatus("disconnected");
      wsRef.current = null;

      const attempts = reconnectAttemptsRef.current;
      if (attempts < maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs);
      }
    };
  }, [sessionId, onEvent, reconnectDelayMs, maxReconnectAttempts]);

  // Auto-connect when sessionId is set
  useEffect(() => {
    isMountedRef.current = true;
    if (sessionId) connect();
    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, connect]);

  const send = useCallback((event: WSEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  /** Register a typed event handler. Returns an unsubscribe function. */
  const on = useCallback((type: WSEventType, handler: EventHandler) => {
    const set = handlersRef.current.get(type) ?? new Set<EventHandler>();
    set.add(handler);
    handlersRef.current.set(type, set);

    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    wsRef.current?.close();
  }, [maxReconnectAttempts]);

  return { status, send, on, disconnect };
}
