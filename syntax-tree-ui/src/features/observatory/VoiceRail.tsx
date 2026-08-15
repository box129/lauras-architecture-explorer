import { ArrowUpRight, BookmarkPlus, Copy, FileText, MessageSquareText, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';
import { MAP_CONFIDENCE_EXPLANATION, formatMapConfidencePercent } from '../../design/mapConfidence';
import { useRunOrientation } from '../../api/hooks';
import type {
  ArchitectureMapEvidenceDTO,
  ArchitectureNodeExplanationDTO,
  CodeCompanionSelection,
  ExplanationClaimDTO,
  FlowListItemDTO,
} from '../architecture-map/apiTypes';
import RepoOrientationPanel from '../../components/shared/RepoOrientationPanel';
import { useSyntaxTreeStore } from '../../store';
import ArchitecturalExplanationPanel from '../architectural-explanation/ArchitecturalExplanationPanel';
import StatusBadge from './StatusBadge';
import type { ObservatoryNode } from './types';

type RailTab = 'simple' | 'technical' | 'evidence';

interface VoiceRailProps {
  node: ObservatoryNode | null;
  focalNode?: ObservatoryNode | null;
  explanation?: ArchitectureNodeExplanationDTO | null;
  evidence?: ArchitectureMapEvidenceDTO[];
  explanationLoading?: boolean;
  explanationError?: string | null;
  onClose: () => void;
  onZoomInto?: (node: ObservatoryNode) => void;
  onBackToParent?: () => void;
  onAskAboutNode?: (node: ObservatoryNode) => void;
  onCopyLink?: (node: ObservatoryNode) => void;
  onOpenProof?: (selection: CodeCompanionSelection) => void;
  onSaveLens?: () => void;
  relatedFlows?: FlowListItemDTO[];
  onOpenFlow?: (flowId: string) => void;
  activeEvidenceId?: string;
}

export default function VoiceRail({
  node,
  focalNode = null,
  explanation = null,
  evidence = [],
  explanationLoading = false,
  explanationError = null,
  onClose,
  onZoomInto,
  onBackToParent,
  onAskAboutNode,
  onCopyLink,
  onOpenProof,
  onSaveLens,
  relatedFlows = [],
  onOpenFlow,
  activeEvidenceId = '',
}: VoiceRailProps) {
  const [activeTab, setActiveTab] = useState<RailTab>(() => initialRailTab());
  const [showArchExplanation, setShowArchExplanation] = useState(false);
  const displayNode = node ?? focalNode;
  const evidenceById = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);
  const analysisRunId = useSyntaxTreeStore((state) => state.analysisRunMetadata?.analysis_run_id ?? null);
  const {
    data: orientation,
    loading: orientationLoading,
    error: orientationError,
  } = useRunOrientation(analysisRunId, analysisRunId ? 5000 : 0);

  if (!displayNode) {
    return (
      <aside className="obs-voice obs-voice--quiet" aria-label="Observatory guide">
        {analysisRunId ? (
          <RepoOrientationPanel
            orientation={orientation}
            loading={orientationLoading}
            error={orientationError}
            compact
          />
        ) : (
          <p>Select an architecture area to see the cached explanation, its source evidence, and what the backend still cannot prove.</p>
        )}
      </aside>
    );
  }

  const nodeStatus = evidenceStatusMeta[displayNode.status];
  const explanationStatus = explanation?.generation_status ?? 'not_generated';
  const summary = explanation?.summary || displayNode.summary;
  const warnings = [
    ...(explanation?.warnings ?? []),
    ...((displayNode.warnings && displayNode.warnings.length > 0) ? displayNode.warnings : displayNode.warning ? [displayNode.warning] : []),
  ].filter(Boolean);
  const keyFiles = explanation?.key_files?.length
    ? explanation.key_files
    : displayNode.primaryFiles.slice(0, 4).map((file) => ({ file_path: file, reason: 'Primary file returned by the architecture map.', evidence_ids: [] }));
  const responsibilities = explanation?.responsibilities?.length
    ? explanation.responsibilities
    : displayNode.whatHappens.map((text) => ({ text, support: displayNode.status === 'verified' ? 'verified' : 'insufficient', evidence_ids: [] }) as ExplanationClaimDTO);
  const whatHappens = explanation?.what_happens ?? [];
  // Architectural Explanation only ever resolves against a real parsed
  // symbol (see api/routes/architectural_explanation.py, which 404s
  // "Entity not found" for any id that isn't a ParsedSymbol) -- module/
  // package/component-group nodes can never have one. Gating on the id
  // prefix here avoids both a dead button on container nodes and a
  // pointless refetch/404 if the panel is left open while navigation
  // transiently selects a non-symbol node.
  const isExplainableEntity = displayNode.id.startsWith('symbol:');

  return (
    <aside className="obs-voice" aria-label={`${displayNode.label} explanation`}>
      <div className="obs-voice__header">
        <div>
          <div className="obs-voice__title-row">
            <h2>{displayNode.label}</h2>
            <span className="obs-chip">
              <StatusBadge status={displayNode.status} />
              {nodeStatus.label}
            </span>
          </div>
          <p>{summary}</p>
          <div className="obs-voice__facts">
            <span>{displayNode.kind.replaceAll('_', ' ')}</span>
            {displayNode.confidence != null ? (
              <span
                className="obs-voice__map-confidence"
                title={MAP_CONFIDENCE_EXPLANATION}
                aria-label={`${formatMapConfidencePercent(displayNode.confidence)}% map confidence. ${MAP_CONFIDENCE_EXPLANATION}`}
              >
                {formatMapConfidencePercent(displayNode.confidence)}% map confidence
              </span>
            ) : (
              // No fabricated percentage: a Phase B structural_group (and
              // any other node with no independently justified confidence
              // metric) has no map-confidence number to show at all,
              // rather than a misleading "0%" that would read as "we are
              // 0% confident" instead of "not applicable."
              <span className="obs-voice__map-confidence" title={MAP_CONFIDENCE_EXPLANATION}>
                map confidence not available
              </span>
            )}
            <span>{displayNode.evidenceCount} evidence</span>
            <span>{displayNode.childrenCount} child areas</span>
            <span>{explanationLabel(explanationStatus)}</span>
          </div>
          <div className="obs-voice__actions">
            {node && node.canDrilldown && onZoomInto && (
              <button type="button" onClick={() => onZoomInto(node)}>
                <ArrowUpRight size={14} strokeWidth={1.8} />
                Zoom into this area
              </button>
            )}
            {focalNode && onBackToParent && (
              <button type="button" onClick={onBackToParent}>Back to parent</button>
            )}
            {onAskAboutNode && (
              <button type="button" onClick={() => onAskAboutNode(displayNode)}>
                <MessageSquareText size={14} strokeWidth={1.8} />
                Ask about this
              </button>
            )}
            {onCopyLink && (
              <button type="button" onClick={() => onCopyLink(displayNode)}>
                <Copy size={14} strokeWidth={1.8} />
                Copy node link
              </button>
            )}
            {onOpenProof && (
              <button type="button" onClick={() => onOpenProof(nodeProofSelection(displayNode))}>View source proof</button>
            )}
            {isExplainableEntity && (
              <button
                aria-expanded={showArchExplanation}
                onClick={() => setShowArchExplanation((current) => !current)}
                type="button"
              >
                <Sparkles size={14} strokeWidth={1.8} />
                Architectural Explanation
              </button>
            )}
            {onSaveLens && (
              <button type="button" onClick={onSaveLens}>
                <BookmarkPlus size={14} strokeWidth={1.8} />
                Save Lens
              </button>
            )}
          </div>
        </div>
        <button className="obs-icon-button" type="button" aria-label="Close explanation" onClick={onClose}>
          <X size={17} strokeWidth={1.7} />
        </button>
      </div>

      {showArchExplanation && isExplainableEntity && (
        <ArchitecturalExplanationPanel
          entityId={displayNode.id}
          entityLabel={displayNode.label}
          key={displayNode.id}
          onClose={() => setShowArchExplanation(false)}
        />
      )}

      {explanationLoading && (
        <div className="obs-warning">
          <StatusBadge status="candidate" />
          <span>Reading cached architectural explanation...</span>
        </div>
      )}

      {explanationError && (
        <div className="obs-warning obs-warning--unsupported">
          <StatusBadge status="unsupported" />
          <span>{explanationError}</span>
        </div>
      )}

      {!explanationLoading && !explanation && !explanationError && (
        <div className="obs-warning">
          <StatusBadge status="insufficient" />
          <span>This node has architecture-map data, but no generated architectural explanation yet.</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="obs-warning">
          <StatusBadge status={displayNode.status} />
          <span>{warnings[0]}</span>
        </div>
      )}

      {displayNode.unsupportedReason && (
        <div className="obs-warning obs-warning--unsupported">
          <StatusBadge status="unsupported" />
          <span>{displayNode.unsupportedReason.replaceAll('_', ' ')}</span>
        </div>
      )}

      <div className="obs-voice-tabs" role="tablist" aria-label="Explanation modes">
        {(['simple', 'technical', 'evidence'] as RailTab[]).map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'obs-voice-tabs__tab obs-voice-tabs__tab--active' : 'obs-voice-tabs__tab'}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'simple' && (
        <>
          <section className="obs-voice__section">
            <h3>Simple explanation</h3>
            <p>{explanation?.simple_explanation || displayNode.description || displayNode.summary}</p>
          </section>
          <ClaimList
            activeEvidenceId={activeEvidenceId}
            claims={responsibilities}
            evidenceById={evidenceById}
            node={displayNode}
            onOpenProof={onOpenProof}
            title="Main responsibilities"
          />
          <section className="obs-voice__section">
            <h3>Useful questions</h3>
            <div className="obs-related">
              {(explanation?.suggested_questions.length ? explanation.suggested_questions : displayNode.relatedLenses).slice(0, 4).map((question) => (
                <button key={question} type="button">{question}</button>
              ))}
            </div>
          </section>
          {relatedFlows.length > 0 && (
            <section className="obs-voice__section">
              <h3>Related flows</h3>
              <div className="obs-flow-chip-list">
                {relatedFlows.map((flow) => (
                  <button key={flow.id} type="button" onClick={() => onOpenFlow?.(flow.id)}>
                    <span>
                      <StatusBadge status={flow.status === 'verified' ? 'verified' : 'insufficient'} />
                      {flow.name}
                    </span>
                    <small>{flow.step_count} steps - {flow.gap_count} gaps</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === 'technical' && (
        <>
          <section className="obs-voice__section">
            <h3>Technical explanation</h3>
            <p>{explanation?.technical_explanation || displayNode.description || 'No technical explanation was generated yet.'}</p>
          </section>
          <ClaimList
            activeEvidenceId={activeEvidenceId}
            claims={whatHappens}
            evidenceById={evidenceById}
            node={displayNode}
            onOpenProof={onOpenProof}
            title="What happens here"
          />
          <section className="obs-voice__section">
            <h3>Relationships</h3>
            <div className="obs-relationship-list">
              {(explanation?.relationships ?? []).length > 0 ? explanation?.relationships.map((relationship) => (
                <div className="obs-relationship-list__item" key={`${relationship.target_id}-${relationship.label}`}>
                  <strong>{relationship.label}</strong>
                  <span>{relationship.reason}</span>
                </div>
              )) : (
                <span className="obs-related__empty">No related concept or flow explanation was generated.</span>
              )}
            </div>
          </section>
          <section className="obs-voice__section">
            <h3>Gaps</h3>
            <ul className="obs-gap-list">
              {(explanation?.gaps.length ? explanation.gaps : [displayNode.unsupportedReason || 'No explicit gaps reported.']).map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      {activeTab === 'evidence' && (
        <>
          <section className="obs-voice__section">
            <div className="obs-section-heading">
              <h3>Key files ({keyFiles.length})</h3>
              <button type="button">View all files</button>
            </div>
            <div className="obs-file-list">
              {keyFiles.length > 0 ? keyFiles.map((file, index) => (
                <button
                  className={index === 0 ? 'obs-file-list__item obs-file-list__item--active' : 'obs-file-list__item'}
                  key={file.file_path}
                  onClick={() => onOpenProof?.({
                    ...nodeProofSelection(displayNode),
                    file_path: file.file_path,
                    span_id: file.evidence_ids[0] ? evidenceById.get(file.evidence_ids[0])?.source_ref_id : undefined,
                    evidence_id: file.evidence_ids[0],
                    reason: file.reason,
                  })}
                  type="button"
                >
                  <FileText size={14} strokeWidth={1.7} />
                  <span>{file.file_path}</span>
                  <small>{file.reason}</small>
                </button>
              )) : (
                <div className="obs-file-list__empty">No key files returned yet.</div>
              )}
            </div>
          </section>
          <section className="obs-voice__section">
            <h3>Evidence rows</h3>
            <div className="obs-evidence-list">
              {evidence.length > 0 ? evidence.slice(0, 12).map((item) => (
                <button
                  className={item.id === activeEvidenceId ? 'obs-evidence-list__item obs-evidence-list__item--active' : 'obs-evidence-list__item'}
                  key={item.id}
                  onClick={() => onOpenProof?.({
                    ...nodeProofSelection(displayNode),
                    evidence_id: item.id,
                    file_path: item.file_path,
                    span_id: item.source_ref_id,
                    start_line: item.start_line,
                    reason: item.reason,
                  })}
                  type="button"
                >
                  <StatusBadge status={item.status as EvidenceStatus} />
                  <div>
                    <strong>{item.file_path}:{item.start_line}-{item.end_line}</strong>
                    <span>{item.reason || item.evidence_kind}</span>
                    {item.text_preview && <p>{item.text_preview}</p>}
                  </div>
                </button>
              )) : (
                <span className="obs-related__empty">No source evidence rows returned for this node.</span>
              )}
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

function ClaimList({
  title,
  claims,
  evidenceById,
  node,
  onOpenProof,
  activeEvidenceId,
}: {
  title: string;
  claims: ExplanationClaimDTO[];
  evidenceById: Map<string, ArchitectureMapEvidenceDTO>;
  node: ObservatoryNode;
  onOpenProof?: (selection: CodeCompanionSelection) => void;
  activeEvidenceId: string;
}) {
  return (
    <section className="obs-voice__section">
      <h3>{title}</h3>
      <ul className="obs-step-list obs-step-list--claims">
        {claims.length > 0 ? claims.map((claim, index) => {
          const cited = claim.evidence_ids
            .map((id) => evidenceById.get(id))
            .filter((item): item is ArchitectureMapEvidenceDTO => Boolean(item));
          const primaryEvidence = cited[0];
          return (
            <li className={claim.evidence_ids.includes(activeEvidenceId) ? 'obs-claim--active' : ''} key={`${claim.text}-${index}`}>
              <button
                aria-label="Open source proof for claim"
                disabled={!primaryEvidence || !onOpenProof}
                onClick={() => primaryEvidence && onOpenProof?.({
                  ...nodeProofSelection(node),
                  evidence_id: primaryEvidence.id,
                  file_path: primaryEvidence.file_path,
                  span_id: primaryEvidence.source_ref_id,
                  start_line: primaryEvidence.start_line,
                  reason: claim.text,
                })}
                type="button"
              >
                <StatusBadge status={claim.support as EvidenceStatus} />
              </button>
              <span>
                {claim.text}
                {cited.length > 0 && (
                  <small>{cited.slice(0, 2).map((item) => `${item.file_path}:${item.start_line}`).join(', ')}</small>
                )}
              </span>
            </li>
          );
        }) : (
          <li>
            <StatusBadge status="insufficient" />
            <span>No generated claims for this section yet.</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function nodeProofSelection(node: ObservatoryNode): CodeCompanionSelection {
  return {
    subject_type: 'architecture_node',
    subject_id: node.id,
    title: node.label,
    open: true,
  };
}

function explanationLabel(status: string) {
  switch (status) {
    case 'llm_generated':
      return 'LLM generated';
    case 'cached':
      return 'cached explanation';
    case 'stale':
      return 'stale explanation';
    case 'llm_failed':
      return 'LLM failed';
    case 'fallback_no_llm':
      // Deterministic explanation only -- no AI provider was configured, so
      // this did not fall back FROM a failure, it simply never had one to
      // call. Surfacing the raw enum ("fallback no llm") reads as internal
      // debug text; this is the plain-language, actionable equivalent.
      return 'generated without AI';
    case 'not_generated':
      return 'not generated';
    default:
      return status.replaceAll('_', ' ');
  }
}

function initialRailTab(): RailTab {
  if (typeof window === 'undefined') return 'simple';
  const value = new URLSearchParams(window.location.search).get('railTab');
  return value === 'technical' || value === 'evidence' ? value : 'simple';
}
