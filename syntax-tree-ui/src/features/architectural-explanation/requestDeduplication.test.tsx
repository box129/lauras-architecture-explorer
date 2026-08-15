import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArchitecturalExplanationPanel from './ArchitecturalExplanationPanel';
import { getArchitecturalExplanation, invalidateArchitecturalExplanationCache } from './api';
import type { ArchitecturalExplanationResponse } from './apiTypes';

/**
 * Regression coverage for a real product defect: React StrictMode's
 * development-only mount -> unmount -> remount effect probe caused
 * useArchitecturalExplanation's effect to run twice, and -- before the
 * fix -- each invocation called getArchitecturalExplanation() directly,
 * issuing two independent real POST .../architectural-explanation
 * requests (two separately billed, independently-sampled LLM calls) for
 * one semantic explanation load. See
 * qa-audit/architectural-explanation-request-dedup/REPORT.md.
 *
 * These tests render through <StrictMode> deliberately (React Testing
 * Library honors StrictMode's double-invoke behavior even under jsdom)
 * to reproduce the exact real-world trigger, not just the fix's own
 * cache module in isolation.
 */

const fetchApiMock = vi.fn();
vi.mock('../../api/client', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    fetchApi: (...args: unknown[]) => fetchApiMock(...args),
    ApiError: MockApiError,
  };
});

afterEach(() => {
  fetchApiMock.mockReset();
  invalidateArchitecturalExplanationCache();
});

const producer = {
  producer_type: 'llm',
  name: 'claim-proposer',
  version: '1.0.0',
  produced_at: '2026-01-01T00:00:00Z',
};

function buildExplanation(narrative: string): ArchitecturalExplanationResponse {
  return {
    analysis_run_id: 'run:1',
    target_kind: 'entity',
    target_id: 'symbol:abc123',
    explanation_id: 'explanation:deadbeef',
    narrative,
    claims: [],
    supported_count: 0,
    insufficient_evidence_count: 0,
    producer,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('architectural-explanation request deduplication', () => {
  it('CASE 1: StrictMode mount/effect probing -- one semantic target load produces exactly one backend request', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation('Only one real request should have been made.'));

    render(
      <StrictMode>
        <ArchitecturalExplanationPanel entityId="symbol:abc123" runId="run:1" onClose={() => {}} />
      </StrictMode>,
    );

    expect(await screen.findByText(/Only one real request should have been made/i)).toBeInTheDocument();

    const explanationCalls = fetchApiMock.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/architectural-explanation'),
    );
    expect(explanationCalls).toHaveLength(1);
  });

  it('CASE 2: two truly concurrent callers for the same (runId, entityId) share one in-flight request', async () => {
    let resolveFetch: (value: ArchitecturalExplanationResponse) => void = () => {};
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = getArchitecturalExplanation('symbol:abc123', 'run:1');
    const second = getArchitecturalExplanation('symbol:abc123', 'run:1');

    expect(fetchApiMock).toHaveBeenCalledTimes(1);

    const explanation = buildExplanation('shared response');
    resolveFetch(explanation);

    await expect(first).resolves.toBe(explanation);
    await expect(second).resolves.toBe(explanation);
  });

  it('CASE 3: the same entity remaining selected across an ordinary rerender does not regenerate', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation('first and only load'));

    const { rerender } = render(
      <ArchitecturalExplanationPanel entityId="symbol:abc123" runId="run:1" entityLabel="v1" onClose={() => {}} />,
    );
    await screen.findByText(/first and only load/i);

    // An ordinary rerender that does not change entityId/runId (only an
    // unrelated prop) must not trigger a second request.
    rerender(
      <ArchitecturalExplanationPanel entityId="symbol:abc123" runId="run:1" entityLabel="v2" onClose={() => {}} />,
    );
    await screen.findByText(/Architectural Explanation: v2/i);

    const explanationCalls = fetchApiMock.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/architectural-explanation'),
    );
    expect(explanationCalls).toHaveLength(1);
  });

  it('CASE 4: deliberately selecting a different entity DOES issue a new request', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation('entity A'));
    fetchApiMock.mockResolvedValueOnce(buildExplanation('entity B'));

    const { rerender } = render(
      <ArchitecturalExplanationPanel entityId="symbol:a" runId="run:1" onClose={() => {}} />,
    );
    await screen.findByText(/^entity A$/i);

    rerender(<ArchitecturalExplanationPanel entityId="symbol:b" runId="run:1" onClose={() => {}} />);
    await screen.findByText(/^entity B$/i);

    const explanationUrls = fetchApiMock.mock.calls
      .map(([url]) => url)
      .filter((url): url is string => typeof url === 'string' && url.includes('/architectural-explanation'));
    expect(explanationUrls).toHaveLength(2);
    expect(explanationUrls[0]).toContain(encodeURIComponent('symbol:a'));
    expect(explanationUrls[1]).toContain(encodeURIComponent('symbol:b'));
  });

  it('CASE 5: leaving entity A before it resolves, then selecting B, never lets A overwrite B', async () => {
    let resolveA: (value: ArchitecturalExplanationResponse) => void = () => {};
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveA = resolve;
      }),
    );
    fetchApiMock.mockResolvedValueOnce(buildExplanation('entity B loaded'));

    const { rerender } = render(
      <ArchitecturalExplanationPanel entityId="symbol:a" runId="run:1" onClose={() => {}} />,
    );

    // Switch to B before A's request has resolved at all.
    rerender(<ArchitecturalExplanationPanel entityId="symbol:b" runId="run:1" onClose={() => {}} />);
    await screen.findByText(/entity B loaded/i);

    // A's request finally resolves AFTER B is already showing.
    resolveA(buildExplanation('entity A loaded (stale)'));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByText(/entity B loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/entity A loaded \(stale\)/i)).not.toBeInTheDocument();
  });

  it('CASE 6: an explicit Retry after a failure issues a genuinely fresh request, bypassing any cached failure', async () => {
    const { ApiError } = await import('../../api/client');
    fetchApiMock.mockRejectedValueOnce(new ApiError(503, 'unavailable'));
    fetchApiMock.mockResolvedValueOnce(buildExplanation('recovered after retry'));
    const userEventModule = await import('@testing-library/user-event');
    const user = userEventModule.default.setup();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" runId="run:1" onClose={() => {}} />);
    await screen.findByText('Architectural explanation unavailable');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(/recovered after retry/i);

    const explanationCalls = fetchApiMock.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/architectural-explanation'),
    );
    expect(explanationCalls).toHaveLength(2);
  });

  it('invalidateArchitecturalExplanationCache() forces the next load for that entity to re-fetch', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation('first'));
    fetchApiMock.mockResolvedValueOnce(buildExplanation('second'));

    const first = await getArchitecturalExplanation('symbol:abc123', 'run:1');
    expect(first.narrative).toBe('first');
    expect(fetchApiMock).toHaveBeenCalledTimes(1);

    // Without invalidation, a repeat call would reuse the cached promise.
    const cached = await getArchitecturalExplanation('symbol:abc123', 'run:1');
    expect(cached.narrative).toBe('first');
    expect(fetchApiMock).toHaveBeenCalledTimes(1);

    invalidateArchitecturalExplanationCache('symbol:abc123', 'run:1');
    const fresh = await getArchitecturalExplanation('symbol:abc123', 'run:1');
    expect(fresh.narrative).toBe('second');
    expect(fetchApiMock).toHaveBeenCalledTimes(2);
  });

  it('never includes any credential-shaped value in the request cache key or URL', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation('no secrets here'));
    await getArchitecturalExplanation('symbol:abc123', 'run:1');

    const [url] = fetchApiMock.mock.calls[0] as [string, unknown];
    expect(url).not.toMatch(/api[_-]?key/i);
    expect(url).not.toMatch(/sk-[a-zA-Z0-9]/);
  });
});
