import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ArchitecturalExplanationPanel from './ArchitecturalExplanationPanel';
import EvidenceItemRow from './EvidenceItemRow';
import { invalidateArchitecturalExplanationCache } from './api';
import { useSyntaxTreeStore } from '../../store';
import type { ArchitecturalExplanationResponse, EvidenceItemDTO, SourceRegionDTO } from './apiTypes';

// Mock the shared fetchApi wrapper -- this feature's API layer (`./api.ts`)
// is required to go through it (never raw fetch), so mocking at that
// boundary is enough to keep every test in this file backend-free.
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
  // getArchitecturalExplanation now dedupes/caches per (runId, entityId) --
  // see requestDeduplication.test.tsx -- so tests in this file that reuse
  // the same entityId/runId must reset that cache between cases or a
  // later test would silently observe an earlier test's cached response.
  invalidateArchitecturalExplanationCache();
});

const producer = {
  producer_type: 'llm',
  name: 'claim-proposer',
  version: '1.0.0',
  produced_at: '2026-01-01T00:00:00Z',
};

function buildExplanation(): ArchitecturalExplanationResponse {
  return {
    analysis_run_id: 'run:1',
    target_kind: 'entity',
    target_id: 'symbol:abc123',
    explanation_id: 'explanation:deadbeef',
    narrative: 'OrderController is responsible for order placement.',
    claims: [
      {
        id: 'claim:supported-1',
        run_id: 'run:1',
        statement: 'OrderController.place_order calls OrderService.create_order.',
        epistemic_type: 'observed',
        support_status: 'supported',
        confidence: null,
        producer,
        evidence_chain: {
          id: 'evidence-chain:1',
          run_id: 'run:1',
          claim_id: 'claim:supported-1',
          reasoning: '',
          hop_count: 1,
          items: [
            {
              kind: 'relationship',
              id: 'evidence-rel:1',
              run_id: 'run:1',
              producer,
              description: 'Direct call site found in place_order.',
              relationship_kind: 'calls',
              from_symbol_id: 'symbol:order-controller',
              to_symbol_id: 'symbol:order-service',
              source_region_id: 'region:1',
            },
          ],
        },
        proposition: {
          kind: 'direct_relation',
          subject_entity_id: 'symbol:order-controller',
          relation_kind: 'calls',
          object_entity_id: 'symbol:order-service',
          path_entity_ids: [],
        },
        subject_symbol_ids: ['symbol:order-controller'],
        related_lens_ids: [],
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'claim:insufficient-1',
        run_id: 'run:1',
        statement: 'OrderController.place_order emits a PaymentAuthorized event.',
        epistemic_type: 'observed',
        support_status: 'insufficient_evidence',
        confidence: null,
        producer,
        evidence_chain: {
          id: 'evidence-chain:2',
          run_id: 'run:1',
          claim_id: 'claim:insufficient-1',
          reasoning: '',
          hop_count: 0,
          items: [],
        },
        proposition: {
          kind: 'direct_relation',
          subject_entity_id: 'symbol:order-controller',
          relation_kind: 'emits',
          object_entity_id: 'symbol:payment-authorized-event',
          path_entity_ids: [],
        },
        subject_symbol_ids: ['symbol:order-controller'],
        related_lens_ids: [],
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    supported_count: 1,
    insufficient_evidence_count: 1,
    producer,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('ArchitecturalExplanationPanel', () => {
  it('renders a loading state before data arrives', async () => {
    let resolveFetch: (value: ArchitecturalExplanationResponse) => void = () => {};
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    expect(screen.getByText(/loading architectural explanation/i)).toBeInTheDocument();

    resolveFetch(buildExplanation());
    expect(await screen.findByText(/OrderController is responsible for order placement/i)).toBeInTheDocument();
  });

  it('renders a supported claim and an insufficient-evidence claim with visually distinct badges', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation());

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    const supportedCard = (await screen.findByText(/place_order calls OrderService.create_order/i)).closest('li');
    const insufficientCard = screen.getByText(/emits a PaymentAuthorized event/i).closest('li');

    expect(supportedCard).not.toBeNull();
    expect(insufficientCard).not.toBeNull();
    expect(supportedCard).toHaveClass('la-claim-card--supported');
    expect(insufficientCard).toHaveClass('la-claim-card--insufficient_evidence');

    expect(within(supportedCard as HTMLElement).getByText('SUPPORTED')).toBeInTheDocument();
    expect(within(insufficientCard as HTMLElement).getByText('INSUFFICIENT EVIDENCE')).toBeInTheDocument();
  });

  it('reveals the evidence chain when a claim is clicked', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation());
    const user = userEvent.setup();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    const header = await screen.findByRole('button', { name: /place_order calls OrderService.create_order/i });
    expect(screen.queryByText(/Direct call site found in place_order/i)).not.toBeInTheDocument();

    await user.click(header);

    expect(screen.getByText(/Direct call site found in place_order/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Open source$/i })).toBeInTheDocument();
  });

  it('never shows a supported-style badge or confident copy on an insufficient-evidence claim', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation());
    const user = userEvent.setup();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    const header = await screen.findByRole('button', { name: /emits a PaymentAuthorized event/i });
    const card = header.closest('li') as HTMLElement;

    expect(within(card).queryByText('SUPPORTED')).not.toBeInTheDocument();
    expect(card).not.toHaveClass('la-claim-card--supported');

    await user.click(header);

    expect(
      within(card).getByText(/could not find direct evidence for this relationship in the current run/i),
    ).toBeInTheDocument();
  });

  it('renders gracefully when the API call rejects', async () => {
    fetchApiMock.mockRejectedValueOnce(new Error('Network unavailable'));

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    expect(await screen.findByText('Network unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/loading architectural explanation/i)).not.toBeInTheDocument();
  });

  it('shows "Architectural explanation unavailable" with Retry/Open Settings on a 503 (product-hardening PHASE 2/7)', async () => {
    const { ApiError } = await import('../../api/client');
    fetchApiMock.mockRejectedValueOnce(
      new ApiError(503, 'The configured language-model provider could not be reached.'),
    );
    const user = userEvent.setup();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    expect(await screen.findByText('Architectural explanation unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    fetchApiMock.mockResolvedValueOnce(buildExplanation());
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/OrderController is responsible/i)).toBeInTheDocument();
  });

  it('always shows the model-proposes/Laura\'s-verifies explanation and both status definitions, not hover-only (findings F02, F06)', async () => {
    let resolveFetch: (value: ArchitecturalExplanationResponse) => void = () => {};
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    // Present immediately, before the explanation has even loaded --
    // this is not conditional on data arriving, unlike the claim badges
    // themselves, because a user should understand what SUPPORTED /
    // INSUFFICIENT EVIDENCE mean the moment the panel opens.
    // `selector` scopes each query to its specific element -- with a plain
    // regex, a match inside a nested `<dd>`/`<strong>` would otherwise also
    // "match" every ancestor whose concatenated text includes it as a
    // substring, which is a well-known testing-library false-positive risk
    // for multi-match assertions.
    expect(screen.getByText(/model proposes architectural statements/i, { selector: 'strong' })).toBeInTheDocument();
    expect(
      screen.getByText(/laura.?s.*then independently.*checks each one against recovered source evidence/i, {
        selector: 'p.la-arch-explanation__legend-intro',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('SUPPORTED')).toBeInTheDocument();
    expect(screen.getByText('INSUFFICIENT EVIDENCE')).toBeInTheDocument();
    expect(
      screen.getByText(/deterministic source-derived evidence establishing this proposition/i, { selector: 'dd' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does NOT automatically mean the statement is false/i, { selector: 'dd' })).toBeInTheDocument();

    resolveFetch(buildExplanation());
    await screen.findByText(/OrderController is responsible/i);
  });

  it('exposes each claim badge\'s full meaning as accessible text, reachable without hovering (finding F02)', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation());

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    const header = await screen.findByRole('button', { name: /place_order calls OrderService.create_order/i });
    // The button's accessible name is computed from its content, which
    // includes the badge's aria-label -- so the full help copy is exposed
    // to assistive tech via focus alone, not mouse hover.
    expect(header.textContent ?? '').toMatch(/SUPPORTED/);
    const badge = within(header).getByLabelText(/SUPPORTED:.*deterministic source-derived evidence/i);
    expect(badge).toBeInTheDocument();
  });

  it('shows a short, always-visible plain-language caption under every individual badge, not just the shared legend (Participant 1 finding)', async () => {
    fetchApiMock.mockResolvedValueOnce(buildExplanation());

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    // A real participant read SUPPORTED as "the system prefers those kind
    // of modules" and INSUFFICIENT EVIDENCE as "the system hasn't been
    // fully built yet" -- despite the legend already being on screen. This
    // caption travels with the badge itself, with no interaction required.
    await screen.findByRole('button', { name: /place_order calls OrderService.create_order/i });
    expect(screen.getByText('Verified from available source evidence')).toBeInTheDocument();
    expect(
      screen.getByText('Not verified from the available source evidence — this does not mean the statement is false'),
    ).toBeInTheDocument();
  });

  it('uses "architectural statement(s)" in user-facing copy, not "claim" (Participant 1 finding)', async () => {
    let resolveFetch: (value: ArchitecturalExplanationResponse) => void = () => {};
    fetchApiMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    expect(screen.getByText(/architectural statements/i, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText(/architectural claims/i)).not.toBeInTheDocument();

    resolveFetch(buildExplanation());
    await screen.findByText(/OrderController is responsible/i);
  });

  it('"Open Settings" on the unavailable state opens the Settings panel', async () => {
    const { ApiError } = await import('../../api/client');
    fetchApiMock.mockRejectedValueOnce(new ApiError(503, 'unavailable'));
    const user = userEvent.setup();
    useSyntaxTreeStore.getState().closeSettings();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    await screen.findByText('Architectural explanation unavailable');
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));

    expect(useSyntaxTreeStore.getState().settingsOpen).toBe(true);
    useSyntaxTreeStore.getState().closeSettings();
  });
});

describe('EvidenceItemRow source resolution', () => {
  const region: SourceRegionDTO = {
    id: 'region:1',
    analysis_run_id: 'run:1',
    path: 'app/order_controller.py',
    start_line: 42,
    end_line: 48,
    content_hash: 'hash',
    text: 'def place_order(self):\n    return self.order_service.create_order()',
    region_type: 'range',
    token_count: 20,
    parser_confidence: 1,
  };

  it('resolves and displays the exact source location for an evidence item', async () => {
    fetchApiMock
      .mockResolvedValueOnce(buildExplanation())
      .mockResolvedValueOnce(region);
    const user = userEvent.setup();

    render(<ArchitecturalExplanationPanel entityId="symbol:abc123" onClose={() => {}} />);

    const header = await screen.findByRole('button', { name: /place_order calls OrderService.create_order/i });
    await user.click(header);
    await user.click(screen.getByRole('button', { name: /^Open source$/i }));

    expect(await screen.findByText(/app\/order_controller\.py:42-48/)).toBeInTheDocument();
    expect(fetchApiMock).toHaveBeenLastCalledWith('/source-regions/region%3A1');
  });

  it('clicking Open source invokes real navigation (goToCode) to the exact file/line', async () => {
    fetchApiMock.mockResolvedValueOnce(region);
    const user = userEvent.setup();
    const item: EvidenceItemDTO = {
      kind: 'relationship',
      id: 'evidence-rel:1',
      run_id: 'run:1',
      producer,
      description: 'Direct call site found in place_order.',
      relationship_kind: 'calls',
      from_symbol_id: 'symbol:order-controller',
      to_symbol_id: 'symbol:order-service',
      source_region_id: 'region:1',
    };

    render(<EvidenceItemRow item={item} />);
    await user.click(screen.getByRole('button', { name: /^Open source$/i }));

    await screen.findByText(/app\/order_controller\.py:42-48/);
    const state = useSyntaxTreeStore.getState();
    expect(state.mainSurface).toBe('code');
    expect(state.openFilePath).toBe('app/order_controller.py');
    expect(state.openFileLine).toBe(42);
  });

  it('leads with the human-readable relation and defers raw ids/producer metadata behind Technical details (finding F03)', () => {
    const item: EvidenceItemDTO = {
      kind: 'relationship',
      id: 'evidence-rel:1',
      run_id: 'run:1',
      producer,
      description: 'Direct call site found in place_order.',
      relationship_kind: 'calls',
      from_symbol_id: 'symbol:order-controller',
      to_symbol_id: 'symbol:order-service',
      source_region_id: 'region:1',
    };

    render(<EvidenceItemRow item={item} />);

    // Human-readable relation leads, plainly visible, outside any
    // disclosure.
    const relationEl = screen.getByText('calls');
    expect(relationEl.closest('details')).toBeNull();

    // Raw ids/producer metadata are real provenance data -- never
    // destroyed -- but collapsed by default behind "Technical details" so
    // they don't dominate the ordinary reading path.
    const details = screen.getByText('Technical details').closest('details') as HTMLElement;
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('symbol:order-controller').closest('details')).toBe(details);
    expect(within(details).getByText('symbol:order-controller')).toBeInTheDocument();
    expect(within(details).getByText('symbol:order-service')).toBeInTheDocument();
    expect(within(details).getByText(/Direct call site found in place_order/i, { selector: 'dd' })).toBeInTheDocument();
    expect(within(details).getByText(/claim-proposer@1\.0\.0/, { selector: 'dd' })).toBeInTheDocument();
  });

  it('renders a disabled button with honest copy when the evidence item has no source_region_id', () => {
    const item: EvidenceItemDTO = {
      kind: 'relationship',
      id: 'evidence-rel:2',
      run_id: 'run:1',
      producer,
      description: 'Containment edge derived from symbol nesting.',
      relationship_kind: 'contains',
      from_symbol_id: 'symbol:module',
      to_symbol_id: 'symbol:class',
      source_region_id: null,
    };

    render(<EvidenceItemRow item={item} />);

    const button = screen.getByRole('button', { name: /^Open source$/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/No source region recorded for this evidence item -- navigation is unavailable\./i),
    ).toBeInTheDocument();
    expect(fetchApiMock).not.toHaveBeenCalled();
  });
});
