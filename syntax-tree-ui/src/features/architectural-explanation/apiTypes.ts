/**
 * Types for the V2 vertical-slice "architectural explanation" endpoint.
 *
 * Mirrors, field-for-field, the documented contract in
 * `syntax-tree-refurbished-backend/src/syntax_tree_refurbished/api/dto/architectural_explanation.py`
 * (module docstring) and the `ArchitecturalClaimDTO` shape it reuses from
 * `api/dto/provenance.py`. The backend route (POST
 * /api/entities/{entity_id}/architectural-explanation) is not registered yet
 * -- these types describe the frozen Phase-1 contract only.
 */

export interface ProducerInfoDTO {
  producer_type: string;
  name: string;
  version: string;
  produced_at: string;
}

/**
 * `support_status` is exactly one of these three values. `contradicted`
 * never appears in this first vertical slice, but the type intentionally
 * includes it so UI code cannot assume it can't occur.
 */
export type ArchitecturalClaimSupportStatus = 'supported' | 'insufficient_evidence' | 'contradicted';

export type ClaimPropositionKind = 'direct_relation' | 'reachability' | string;

export interface ClaimPropositionDTO {
  kind: ClaimPropositionKind;
  subject_entity_id: string;
  relation_kind: string;
  object_entity_id: string;
  path_entity_ids: string[];
}

/**
 * A single evidence-chain item. The documented contract only shows the
 * `relationship` kind for this first slice, but `kind` is typed as an open
 * string so a future evidence kind doesn't silently get mis-narrowed here.
 */
export interface EvidenceItemDTO {
  kind: 'relationship' | string;
  id: string;
  run_id: string;
  producer: ProducerInfoDTO;
  description: string;
  relationship_kind: string;
  from_symbol_id: string;
  to_symbol_id: string;
  source_region_id: string | null;
}

export interface EvidenceChainDTO {
  id: string;
  run_id: string;
  claim_id: string;
  reasoning: string;
  hop_count: number;
  items: EvidenceItemDTO[];
}

export interface ArchitecturalClaimDTO {
  id: string;
  run_id: string;
  statement: string;
  epistemic_type: string;
  support_status: ArchitecturalClaimSupportStatus;
  confidence: number | null;
  producer: ProducerInfoDTO;
  evidence_chain: EvidenceChainDTO;
  proposition: ClaimPropositionDTO;
  subject_symbol_ids: string[];
  related_lens_ids: string[];
  created_at: string;
}

export interface ArchitecturalExplanationResponse {
  analysis_run_id: string;
  target_kind: 'entity' | string;
  target_id: string;
  explanation_id: string;
  narrative: string;
  claims: ArchitecturalClaimDTO[];
  supported_count: number;
  insufficient_evidence_count: number;
  producer: ProducerInfoDTO;
  created_at: string;
}

/**
 * Resolves an evidence item's `source_region_id` down to an exact source
 * location. Matches `SourceRegionDTO` in
 * `api/dto/source.py` -- this route (`GET /api/source-regions/{region_id}`)
 * is already registered (see `api/routes/source.py`), unlike the
 * architectural-explanation route above.
 */
export interface SourceRegionDTO {
  id: string;
  analysis_run_id: string;
  path: string;
  start_line: number;
  end_line: number;
  content_hash: string;
  text: string;
  region_type: string;
  token_count: number;
  parser_confidence: number | null;
}
