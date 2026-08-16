import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VoiceRail from './VoiceRail';
import type { ObservatoryNode } from './types';
import type { ArchitectureNodeExplanationDTO } from '../architecture-map/apiTypes';

// Architectural Explanation only ever resolves against a real parsed
// symbol (api/routes/architectural_explanation.py 404s "Entity not found"
// for anything else). A prior usability audit documented that leaving the
// panel open while navigation transiently selects a non-symbol (module/
// package/component-group) node produced pointless 404 console noise --
// this file locks in the fix: the button (and therefore any fetch) is
// gated to symbol-kind entities only.
vi.mock('../../api/client', () => ({
  fetchApi: vi.fn().mockResolvedValue(null),
  ApiError: class extends Error {},
}));

function buildNode(overrides: Partial<ObservatoryNode>): ObservatoryNode {
  return {
    id: 'symbol:abc123',
    label: 'OrderService.create_order',
    kind: 'code_group',
    description: '',
    status: 'verified',
    confidence: 1,
    evidenceCount: 1,
    childrenCount: 0,
    canDrilldown: false,
    primaryFiles: [],
    accent: 'blue',
    icon: 'FileCode2',
    position: { x: 0, y: 0 },
    summary: '',
    whatHappens: [],
    relatedLenses: [],
    ...overrides,
  } as ObservatoryNode;
}

describe('VoiceRail Architectural Explanation gating', () => {
  it('shows the Architectural statements button for a real symbol entity', () => {
    render(<VoiceRail node={buildNode({ id: 'symbol:abc123' })} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /architectural statements/i })).toBeInTheDocument();
  });

  it('hides the Architectural statements button for a structural-module container node', () => {
    render(<VoiceRail node={buildNode({ id: 'structural-module:def456', canDrilldown: true })} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /architectural statements/i })).not.toBeInTheDocument();
  });

  it('hides the Architectural statements button for a synthetic architecture-grouping node', () => {
    render(<VoiceRail node={buildNode({ id: 'arch-child:789abc', canDrilldown: true })} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /architectural statements/i })).not.toBeInTheDocument();
  });
});

/**
 * Regression coverage for Claude Design UX audit finding F01: this node's
 * static-analysis "confidence" percentage previously rendered as bare "NN%
 * confidence", visually and lexically indistinguishable from a claim's
 * SUPPORTED/INSUFFICIENT EVIDENCE verification status. It must now read
 * unambiguously as a map/structural score, never as claim verification or
 * AI confidence.
 */
describe('VoiceRail map-confidence labeling', () => {
  it('labels the node confidence percentage as map confidence, not a verification status', () => {
    render(<VoiceRail node={buildNode({ confidence: 0.72 })} onClose={vi.fn()} />);

    const confidenceEl = screen.getByText('72% map confidence');
    expect(confidenceEl).toBeInTheDocument();
    // Must never read as if it were the claim-level vocabulary.
    expect(screen.queryByText(/^SUPPORTED$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^INSUFFICIENT EVIDENCE$/)).not.toBeInTheDocument();
  });

  it('exposes the map-confidence meaning in accessible text, not hover-only', () => {
    render(<VoiceRail node={buildNode({ confidence: 0.5 })} onClose={vi.fn()} />);

    const confidenceEl = screen.getByText('50% map confidence');
    expect(confidenceEl.getAttribute('aria-label')).toMatch(/not a claim.*verification status/i);
  });

  it('never shows a fabricated "0% map confidence" for a node with no confidence metric (e.g. a Phase B structural_group) -- shows nothing at all', () => {
    render(<VoiceRail node={buildNode({ kind: 'structural_group', confidence: null })} onClose={vi.fn()} />);

    // Design-system vocabulary cleanup: where no meaningful value exists,
    // no confidence line renders at all — neither a fabricated 0% nor the
    // old "map confidence not available" placeholder.
    expect(screen.queryByText(/0% map confidence/)).not.toBeInTheDocument();
    expect(screen.queryByText(/map confidence/)).not.toBeInTheDocument();
  });
});

function buildExplanation(overrides: Partial<ArchitectureNodeExplanationDTO>): ArchitectureNodeExplanationDTO {
  return {
    analysis_run_id: 'run:1', node_id: 'symbol:abc123', status: 'verified', generation_status: 'llm_generated',
    model: '', summary: '', simple_explanation: '', technical_explanation: '', responsibilities: [], what_happens: [],
    key_files: [], relationships: [], gaps: [], warnings: [], suggested_questions: [], evidence_ids: [],
    prompt_hash: '', input_hash: '',
    ...overrides,
  };
}

/**
 * Regression for a live product audit finding: a deterministic-only
 * explanation (no AI provider configured, generation_status
 * "fallback_no_llm") rendered as the raw enum "fallback no llm" -- an
 * internal implementation detail leaking into ordinary UX.
 */
describe('VoiceRail explanation status labeling', () => {
  it('never shows the raw "fallback_no_llm" enum for a deterministic-only explanation', () => {
    render(<VoiceRail node={buildNode({})} explanation={buildExplanation({ generation_status: 'fallback_no_llm' })} onClose={vi.fn()} />);

    expect(screen.queryByText(/fallback.?no.?llm/i)).not.toBeInTheDocument();
    expect(screen.getByText('generated without AI')).toBeInTheDocument();
  });
});
