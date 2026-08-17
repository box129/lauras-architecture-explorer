import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeneratedDocsSection from './GeneratedDocs';
import type { GeneratedComponentDocResponse } from './GeneratedDocs';
import { useSyntaxTreeStore } from '../../store';

// Mock the shared fetchApi wrapper (the only sanctioned HTTP boundary)
// and the settings API this section uses to know whether AI is
// configured -- keeps every test backend-free.
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
    BACKEND_UNREACHABLE_MESSAGE: 'The analysis service is not reachable. Start the backend (port 8000) and retry.',
    isBackendUnreachable: (error: unknown) =>
      (error instanceof MockApiError && (error.status === 0 || error.status === 502 || error.status === 504))
      || error instanceof TypeError,
  };
});

const settingsMock = vi.fn();
vi.mock('../settings/api', () => ({
  getArchExplanationSettings: (...args: unknown[]) => settingsMock(...args),
}));

afterEach(() => {
  fetchApiMock.mockReset();
  settingsMock.mockReset();
  useSyntaxTreeStore.setState({ settingsOpen: false });
});

function configuredSettings(configured = true) {
  return {
    enabled: configured,
    provider: 'openai',
    base_url: '',
    model: 'gpt-test',
    configured,
    credentials_present: configured,
    credential_source: 'runtime',
    config_source: 'runtime',
  };
}

const producer = {
  producer_type: 'llm',
  name: 'docs-component-generation-service',
  version: '',
  produced_at: '2026-01-01T00:00:00Z',
};

function buildDoc(): GeneratedComponentDocResponse {
  return {
    analysis_run_id: 'run:1',
    component_id: 'symbol:target',
    ai_generated: true,
    unavailable_reason: null,
    message: '',
    purpose: 'Coordinates order placement end to end.',
    responsibilities: ['Validates incoming order payloads.'],
    relationship_notes: [
      {
        claim_id: 'claim:supported-1',
        note: 'Order placement delegates persistence to the order service.',
      },
    ],
    discarded_relationship_notes: 0,
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
    ],
    supported_count: 1,
    insufficient_evidence_count: 0,
    run_metadata: {
      provider: 'openai',
      model: 'gpt-test',
      tokens_in: 812,
      tokens_out: 240,
      latency_ms: 3200,
    },
  };
}

describe('GeneratedDocsSection', () => {
  it('generates documentation and renders labeled AI sections with verified claims', async () => {
    settingsMock.mockResolvedValue(configuredSettings());
    fetchApiMock.mockResolvedValue(buildDoc());
    const user = userEvent.setup();

    render(<GeneratedDocsSection componentId="symbol:target" />);

    const generateButton = await screen.findByRole('button', { name: /Generate documentation/ });
    await user.click(generateButton);

    // The generation endpoint was called for the selected component.
    expect(fetchApiMock).toHaveBeenCalledWith(
      '/docs/components/symbol%3Atarget/generate',
      expect.objectContaining({ method: 'POST' }),
      expect.any(Number),
    );

    // Clear AI-generated labeling with the real model id.
    expect(await screen.findByText(/AI-generated · gpt-test/)).toBeInTheDocument();
    // Interpretive sections.
    expect(screen.getByText('Purpose')).toBeInTheDocument();
    expect(screen.getByText('Coordinates order placement end to end.')).toBeInTheDocument();
    expect(screen.getByText('Responsibilities')).toBeInTheDocument();
    expect(screen.getByText('Validates incoming order payloads.')).toBeInTheDocument();
    // Relationship note is labeled as an AI note and paired with its claim.
    expect(screen.getByText('Important relationships')).toBeInTheDocument();
    expect(screen.getByText(/Order placement delegates persistence/)).toBeInTheDocument();
    expect(screen.getByText('AI note')).toBeInTheDocument();
    expect(
      screen.getByText('OrderController.place_order calls OrderService.create_order.'),
    ).toBeInTheDocument();
  });

  it('expands a verified claim down to its evidence chain', async () => {
    settingsMock.mockResolvedValue(configuredSettings());
    fetchApiMock.mockResolvedValue(buildDoc());
    const user = userEvent.setup();

    render(<GeneratedDocsSection componentId="symbol:target" />);
    await user.click(await screen.findByRole('button', { name: /Generate documentation/ }));

    await user.click(
      await screen.findByText('OrderController.place_order calls OrderService.create_order.'),
    );

    expect(screen.getByText('Direct call site found in place_order.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open source' })).toBeEnabled();
  });

  it('shows the AI-unavailable state with Open Settings when AI is not configured', async () => {
    settingsMock.mockResolvedValue(configuredSettings(false));
    const user = userEvent.setup();

    render(<GeneratedDocsSection componentId="symbol:target" />);

    expect(await screen.findByText('AI documentation is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate documentation/ })).toBeNull();
    // No fabricated content is shown.
    expect(screen.queryByText(/AI-generated ·/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(useSyntaxTreeStore.getState().settingsOpen).toBe(true);
  });

  it('shows unavailable + Retry when the provider fails with 503', async () => {
    settingsMock.mockResolvedValue(configuredSettings());
    const { ApiError } = await import('../../api/client');
    fetchApiMock.mockRejectedValue(
      new ApiError(503, 'The configured language-model provider could not be reached.'),
    );
    const user = userEvent.setup();

    render(<GeneratedDocsSection componentId="symbol:target" />);
    await user.click(await screen.findByRole('button', { name: /Generate documentation/ }));

    expect(await screen.findByText('AI documentation is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
  });

  it('honors an honest ai_generated=false backend body without fabricating content', async () => {
    settingsMock.mockResolvedValue(configuredSettings());
    fetchApiMock.mockResolvedValue({
      ...buildDoc(),
      ai_generated: false,
      unavailable_reason: 'not_configured',
      purpose: '',
      responsibilities: [],
      relationship_notes: [],
      claims: [],
      run_metadata: { provider: 'off', model: 'none', tokens_in: 0, tokens_out: 0, latency_ms: 0 },
    });
    const user = userEvent.setup();

    render(<GeneratedDocsSection componentId="symbol:target" />);
    await user.click(await screen.findByRole('button', { name: /Generate documentation/ }));

    expect(await screen.findByText('AI documentation is unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/AI-generated ·/)).toBeNull();
  });
});
