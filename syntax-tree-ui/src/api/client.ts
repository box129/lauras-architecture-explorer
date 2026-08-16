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

export const BACKEND_UNREACHABLE_MESSAGE =
  'The analysis service is not reachable. Start the backend (port 8000) and retry.';

/**
 * True when a request failed because the BACKEND SERVICE itself could not
 * be reached — a dev-proxy 502/504 (backend process down) or a plain
 * network failure — as opposed to the backend answering with an
 * application error. Callers use this to show a retryable
 * "service unavailable" state instead of misreporting the failure as an
 * AI-configuration condition (live-audit defect: a 502 while the backend
 * was down rendered as "No model configured. Analysis is unaffected.").
 * A backend-emitted 503 is deliberately NOT included: that is the
 * "configured provider could not be reached" state and keeps its own copy.
 */
export function isBackendUnreachable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 502 || error.status === 504;
  }
  // fetch() rejects with TypeError when the connection itself fails.
  return error instanceof TypeError;
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

export async function fetchApi<T>(
  path: string,
  options?: RequestInit,
  // LLM-backed endpoints (e.g. documentation generation) legitimately run
  // longer than the default; callers pass a larger budget explicitly.
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
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
    controller.abort(new DOMException(`Request exceeded ${timeoutMs / 1000} seconds.`, 'TimeoutError'));
  }, timeoutMs);

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
      if (res.status === 502 || res.status === 504) {
        // The dev proxy answers 502/504 itself when the backend process is
        // down — this is a service-availability failure, never an
        // application response.
        message = BACKEND_UNREACHABLE_MESSAGE;
      }
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
      throw new ApiError(408, `The request timed out after ${timeoutMs / 1000} seconds. You can retry safely.`);
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

