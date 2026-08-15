import { useState, useCallback, useRef } from 'react';
import type { QueryResponse, WSMessage } from '../../api/types';
import { useSyntaxTreeStore } from '../../store';

export interface StreamState {
  streaming: boolean;
  intent: string | null;
  entities: { qn: string; name: string }[];
  textChunks: string[];
  complete: QueryResponse | null;
  error: string | null;
}

export function useQueryStream() {
  const [state, setState] = useState<StreamState>({
    streaming: false,
    intent: null,
    entities: [],
    textChunks: [],
    complete: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const sendQuestion = useCallback((question: string, conversationId?: string) => {
    setState({
      streaming: true,
      intent: null,
      entities: [],
      textChunks: [],
      complete: null,
      error: null,
    });

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/query`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        question,
        conversation_id: conversationId,
        analysis_job_id: useSyntaxTreeStore.getState().analysisJobId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'status':
            // Status updates (classifying_intent, etc.) — we can show these
            break;
          case 'intent':
            setState((s) => ({ ...s, intent: (msg.data.intent as string) || null }));
            break;
          case 'entities':
            setState((s) => ({
              ...s,
              entities: (msg.data.entities as { qn: string; name: string }[]) || [],
            }));
            break;
          case 'text_chunk':
            setState((s) => ({
              ...s,
              textChunks: [...s.textChunks, (msg.data.text as string) || ''],
            }));
            break;
          case 'complete':
            setState((s) => ({
              ...s,
              streaming: false,
              complete: msg.data as unknown as QueryResponse,
            }));
            ws.close();
            break;
          case 'error':
            setState((s) => ({
              ...s,
              streaming: false,
              error: (msg.data.message as string) || 'Query failed',
            }));
            ws.close();
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, streaming: false, error: 'WebSocket connection failed' }));
    };

    ws.onclose = () => {
      setState((s) => {
        if (s.streaming) return { ...s, streaming: false };
        return s;
      });
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    setState((s) => ({ ...s, streaming: false }));
  }, []);

  return { ...state, sendQuestion, disconnect };
}
