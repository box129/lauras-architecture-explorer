import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { ApiError, fetchApi } from '../../api/client';
import { useSyntaxTreeStore } from '../../store';
import { getArchExplanationSettings } from '../settings/api';
import type { ArchExplanationSettings } from '../settings/types';
import ClaimCard from '../architectural-explanation/ClaimCard';
import type { ArchitecturalClaimDTO } from '../architectural-explanation/apiTypes';

/**
 * Mirrors `ComponentDocGenerationResponse` in
 * `api/dto/docs_generation.py`. `purpose`/`responsibilities`/
 * `relationship_notes` are LLM-written interpretation and are always
 * rendered under an explicit AI-generated label; `claims` are the
 * deterministically verified ArchitecturalClaims the prose was grounded
 * against -- their support_status is the verifier's verdict and is never
 * restated or overridden by the prose.
 */
export interface RelationshipNoteDTO {
  claim_id: string;
  note: string;
}

export interface GeneratedComponentDocResponse {
  analysis_run_id: string;
  component_id: string;
  ai_generated: boolean;
  unavailable_reason: 'not_configured' | null;
  message: string;
  purpose: string;
  responsibilities: string[];
  relationship_notes: RelationshipNoteDTO[];
  discarded_relationship_notes: number;
  claims: ArchitecturalClaimDTO[];
  supported_count: number;
  insufficient_evidence_count: number;
  run_metadata: {
    provider: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
  };
}

// Two LLM calls (claim proposal + documentation writing) legitimately run
// past the shared 15s default budget.
const GENERATION_TIMEOUT_MS = 120_000;

const UNAVAILABLE_COPY =
  'AI features unavailable. Deterministic documentation and dependencies below still work.';

type Phase = 'idle' | 'generating' | 'done' | 'error';

interface GeneratedDocsSectionProps {
  componentId: string;
}

/**
 * "Generate documentation" for the live Doc Studio. Everything
 * interpretive the model wrote is visibly labeled AI-generated; the
 * verified claims render through the existing ClaimCard -> evidence chain
 * -> Open source path, which stays the authoritative record.
 */
export default function GeneratedDocsSection({ componentId }: GeneratedDocsSectionProps) {
  const openSettings = useSyntaxTreeStore((s) => s.openSettings);
  const [settings, setSettings] = useState<ArchExplanationSettings | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [doc, setDoc] = useState<GeneratedComponentDocResponse | null>(null);
  const [error, setError] = useState<{ unavailable: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArchExplanationSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch(() => {
        // Settings unavailable: keep the button; the generation endpoint
        // itself answers honestly when AI is not configured.
        if (!cancelled) setSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async () => {
    setPhase('generating');
    setError(null);
    try {
      const response = await fetchApi<GeneratedComponentDocResponse>(
        `/docs/components/${encodeURIComponent(componentId)}/generate`,
        { method: 'POST' },
        GENERATION_TIMEOUT_MS,
      );
      setDoc(response);
      setPhase('done');
    } catch (err) {
      const unavailable = err instanceof ApiError && (err.status === 503 || err.status === 408);
      setError({
        unavailable,
        message: err instanceof Error ? err.message : 'Documentation generation failed.',
      });
      setPhase('error');
    }
  };

  const aiKnownUnavailable =
    (settings !== null && !settings.configured) ||
    (phase === 'done' && doc !== null && !doc.ai_generated);

  return (
    <section className="obs-docs-detail__section obs-docs-generated" aria-labelledby="generated-docs-heading">
      <h3 id="generated-docs-heading">
        <Sparkles size={16} /> AI documentation
      </h3>

      {aiKnownUnavailable ? (
        <div className="obs-docs-generated__unavailable" role="status">
          <p><strong>AI documentation is unavailable</strong></p>
          <p>{UNAVAILABLE_COPY}</p>
          <button type="button" onClick={openSettings}>Open Settings</button>
        </div>
      ) : phase === 'generating' ? (
        <p className="obs-docs-generated__status" role="status">Generating documentation... This performs a real model request and can take up to two minutes.</p>
      ) : phase === 'error' && error ? (
        <div className="obs-docs-generated__unavailable" role="alert">
          <p><strong>{error.unavailable ? 'AI documentation is unavailable' : 'Documentation generation failed'}</strong></p>
          <p>{error.unavailable ? UNAVAILABLE_COPY : error.message}</p>
          <div className="obs-docs-generated__actions">
            <button type="button" onClick={() => void generate()}><RefreshCw size={14} /> Retry</button>
            <button type="button" onClick={openSettings}>Open Settings</button>
          </div>
        </div>
      ) : phase === 'done' && doc ? (
        <GeneratedDocBody doc={doc} onRegenerate={() => void generate()} />
      ) : (
        <div className="obs-docs-generated__intro">
          <p>
            Generate plain-language documentation for this component. Interpretive text is written
            by the configured model and clearly labeled; every stated relationship is checked
            deterministically against source evidence first.
          </p>
          <button className="obs-docs-generated__generate" type="button" onClick={() => void generate()}>
            <Sparkles size={14} /> Generate documentation
          </button>
        </div>
      )}
    </section>
  );
}

function GeneratedDocBody({
  doc,
  onRegenerate,
}: {
  doc: GeneratedComponentDocResponse;
  onRegenerate: () => void;
}) {
  const claimsById = new Map(doc.claims.map((claim) => [claim.id, claim]));
  const notedClaimIds = new Set(doc.relationship_notes.map((note) => note.claim_id));
  const unnotedClaims = doc.claims.filter((claim) => !notedClaimIds.has(claim.id));

  return (
    <div className="obs-docs-generated__body">
      <div className="obs-docs-generated__meta">
        <span
          className="obs-chip obs-docs-generated__badge"
          title={`Generated by ${doc.run_metadata.model} (${doc.run_metadata.provider}) · ${doc.run_metadata.tokens_in} tokens in / ${doc.run_metadata.tokens_out} out · ${doc.run_metadata.latency_ms} ms`}
        >
          <Sparkles size={12} /> AI-generated · {doc.run_metadata.model}
        </span>
        <button type="button" onClick={onRegenerate}><RefreshCw size={13} /> Regenerate</button>
      </div>
      <p className="obs-docs-generated__disclaimer">
        Purpose and responsibilities are AI-written interpretation of parsed structural facts.
        The architectural claims below were verified deterministically &mdash; their evidence and
        source links are the authoritative record.
      </p>

      <h4>Purpose</h4>
      {doc.purpose
        ? <p className="obs-docs-generated__purpose">{doc.purpose}</p>
        : <p className="obs-muted">The model did not return a purpose description.</p>}

      <h4>Responsibilities</h4>
      {doc.responsibilities.length ? (
        <ul className="obs-docs-generated__responsibilities">
          {doc.responsibilities.map((responsibility) => (
            <li key={responsibility}>{responsibility}</li>
          ))}
        </ul>
      ) : (
        <p className="obs-muted">The model did not return responsibility statements.</p>
      )}

      <h4>Important relationships</h4>
      {doc.relationship_notes.length ? (
        <ul className="obs-docs-generated__notes">
          {doc.relationship_notes.map((note) => {
            const claim = claimsById.get(note.claim_id);
            return (
              <li key={note.claim_id}>
                <p className="obs-docs-generated__note">
                  <span className="obs-chip obs-docs-generated__note-chip"><Sparkles size={11} /> AI note</span>
                  {note.note}
                </p>
                {claim && <ul className="la-claim-list"><ClaimCard claim={claim} /></ul>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="obs-muted">The model did not attach notes to any verified relationship.</p>
      )}

      <h4>{doc.relationship_notes.length ? 'Other verified claims' : 'Verified architectural claims'}</h4>
      {unnotedClaims.length ? (
        <ul className="la-claim-list">
          {unnotedClaims.map((claim) => (
            <ClaimCard claim={claim} key={claim.id} />
          ))}
        </ul>
      ) : (
        <p className="obs-muted">
          {doc.claims.length
            ? 'Every verified claim is covered under Important relationships above.'
            : 'No architectural claims could be verified for this component in this run.'}
        </p>
      )}
    </div>
  );
}
