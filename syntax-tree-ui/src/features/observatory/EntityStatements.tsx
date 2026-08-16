import { ShieldCheck } from 'lucide-react';
import type {
  ArchitectureMapEvidenceDTO,
  ArchitectureNodeExplanationDTO,
  CodeCompanionSelection,
  ExplanationClaimDTO,
} from '../architecture-map/apiTypes';
import type { ObservatoryNode } from './types';

/**
 * Entity Focus statements strip (06_ENTITY_FOCUS_SPEC): the entity's
 * verified statements sit beneath the graph and lead to evidence. Each
 * card carries the reserved uppercase verdict, the shape-coded dot and a
 * left status bar; the evidence count is always stated, including zero,
 * worded as "no evidence found". Unproven statements are never hidden.
 */
export default function EntityStatements({
  node,
  explanation,
  evidence,
  onOpenProof,
}: {
  node: ObservatoryNode;
  explanation: ArchitectureNodeExplanationDTO | null;
  evidence: ArchitectureMapEvidenceDTO[];
  onOpenProof?: (selection: CodeCompanionSelection) => void;
}) {
  const claims: ExplanationClaimDTO[] = [
    ...(explanation?.responsibilities ?? []),
    ...(explanation?.what_happens ?? []),
  ];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  return (
    <section className="entity-statements" aria-label="Architectural statements">
      <header className="entity-statements__header">
        <h3>Architectural statements</h3>
        <span className="entity-statements__badge"><ShieldCheck size={11} /> Verified statement</span>
      </header>
      {claims.length === 0 ? (
        <p className="entity-statements__empty">
          No architectural statements were produced for this module in this run.
        </p>
      ) : (
        <div className="entity-statements__grid">
          {claims.map((claim, index) => {
            const verdict = claim.support === 'verified' ? 'supported' : claim.support === 'unsupported' ? 'contradicted' : 'insufficient';
            const verdictWord = verdict === 'supported' ? 'SUPPORTED' : verdict === 'contradicted' ? 'CONTRADICTED' : 'INSUFFICIENT EVIDENCE';
            const cited = claim.evidence_ids
              .map((id) => evidenceById.get(id))
              .filter((item): item is ArchitectureMapEvidenceDTO => Boolean(item));
            const primary = cited[0];
            return (
              <article className={`entity-statements__card entity-statements__card--${verdict}`} key={`${claim.text}-${index}`}>
                <p className="entity-statements__verdict">
                  <span className={`obs-status obs-status--${claim.support === 'verified' ? 'verified' : claim.support === 'unsupported' ? 'unsupported' : 'insufficient'}`} aria-hidden="true" />
                  {verdictWord}
                </p>
                <p className="entity-statements__text">{claim.text}</p>
                <footer>
                  <span>{cited.length === 0 ? 'no evidence found' : `${cited.length} evidence item${cited.length === 1 ? '' : 's'}`}</span>
                  {primary && onOpenProof && (
                    <button
                      type="button"
                      onClick={() => onOpenProof({
                        subject_type: 'architecture_node',
                        subject_id: node.id,
                        title: node.label,
                        evidence_id: primary.id,
                        file_path: primary.file_path,
                        span_id: primary.source_ref_id,
                        start_line: primary.start_line,
                        reason: claim.text,
                        open: true,
                      })}
                    >
                      View evidence →
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
