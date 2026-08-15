import { useSyntaxTreeStore } from '../store';
import { useTokenStore } from './tokenStore';

const API_BASE = '/api';
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractAndRecordTokens(obj: unknown) {
  if (!obj || typeof obj !== 'object') return;
  const record = obj as Record<string, unknown>;
  
  // Check if this level contains token metadata
  const tokensIn = record.tokens_in ?? record.tokensIn;
  const tokensOut = record.tokens_out ?? record.tokensOut;
  const model = record.model || record.llm_model || record.model_name || 'default';
  
  if (typeof tokensIn === 'number' && typeof tokensOut === 'number') {
    useTokenStore.getState().recordApiCall(tokensIn, tokensOut, String(model));
  } else {
    // Search properties for nested objects (e.g. overview.metrics)
    for (const val of Object.values(record)) {
      if (val && typeof val === 'object') {
        extractAndRecordTokens(val);
      }
    }
  }
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  const { analysisJobId: jobId, analysisRunId: runId } = useSyntaxTreeStore.getState();
  const startsAnalysis = path === '/analyze';
  if (jobId && !startsAnalysis) {
    headers.set('X-Syntax-Tree-Job-Id', jobId);
  }
  if (runId && !startsAnalysis) {
    headers.set('X-Syntax-Tree-Run-Id', runId);
  }

  const controller = new AbortController();
  const upstreamSignal = options?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) {
    abortFromUpstream();
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  }
  const timeout = globalThis.setTimeout(() => {
    controller.abort(new DOMException(`Request exceeded ${DEFAULT_TIMEOUT_MS / 1000} seconds.`, 'TimeoutError'));
  }, DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        const detail = body.detail || body.message;
        message = typeof detail === 'string' ? detail : detail?.message || message;
      } catch { /* ignore parse error */ }
      throw new ApiError(res.status, message);
    }

    const data = await res.json();
    try {
      extractAndRecordTokens(data);
    } catch (err) {
      console.error('Failed to parse tokens from response:', err);
    }
    return data as T;
  } catch (error) {
    if (controller.signal.aborted && !upstreamSignal?.aborted) {
      throw new ApiError(408, 'The request timed out after 15 seconds. You can retry safely.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

