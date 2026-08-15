import type {
  ArchitectureMapEvidenceDTO,
  ArchitectureMapStatus,
  ArchitectureNodeExplanationDTO,
} from '../../architecture-map/apiTypes';
import type { ObservatoryNode } from '../types';

type FixtureExplanationState =
  | 'normal'
  | 'loading'
  | 'empty'
  | 'error'
  | 'stale-lens'
  | 'unsupported-node'
  | 'stale-node'
  | 'no-explanation'
  | 'llm-failed';

const baseEvidence: ArchitectureMapEvidenceDTO[] = [
  {
    id: 'ev-rag-ingestion',
    analysis_run_id: 'fixture-run',
    node_id: 'rag-pipeline',
    evidence_kind: 'concept_evidence',
    source_ref_kind: 'source_span',
    source_ref_id: 'span-ingestion',
    file_path: 'backend/open_webui/retrieval/ingestion.py',
    language: 'python',
    start_line: 32,
    end_line: 118,
    text_preview: 'Processes uploaded files, extracts text, chunks content, and prepares document records for embedding.',
    status: 'verified',
    confidence: 0.92,
    score: 0.94,
    reason: 'Document ingestion evidence.',
    is_stale: false,
  },
  {
    id: 'ev-rag-retriever',
    analysis_run_id: 'fixture-run',
    node_id: 'rag-pipeline',
    evidence_kind: 'flow_step',
    source_ref_kind: 'source_span',
    source_ref_id: 'span-retriever',
    file_path: 'backend/open_webui/retrieval/retriever.py',
    language: 'python',
    start_line: 45,
    end_line: 198,
    text_preview: 'Embeds the query, searches the vector database, and reranks matching chunks before prompt assembly.',
    status: 'verified',
    confidence: 0.9,
    score: 0.91,
    reason: 'Retrieval flow evidence.',
    is_stale: false,
  },
  {
    id: 'ev-rag-prompt',
    analysis_run_id: 'fixture-run',
    node_id: 'rag-pipeline',
    evidence_kind: 'graph_source',
    source_ref_kind: 'source_span',
    source_ref_id: 'span-prompt-builder',
    file_path: 'backend/open_webui/generation/prompt_builder.py',
    language: 'python',
    start_line: 10,
    end_line: 120,
    text_preview: 'Builds model prompt messages by inserting retrieved document chunks as contextual source material.',
    status: 'verified',
    confidence: 0.86,
    score: 0.84,
    reason: 'Prompt context evidence.',
    is_stale: false,
  },
];

export function getFixtureExplanation(
  node: ObservatoryNode | null,
  state: FixtureExplanationState,
): { explanation: ArchitectureNodeExplanationDTO | null; evidence: ArchitectureMapEvidenceDTO[] } {
  if (!node) return { explanation: null, evidence: [] };
  if (state === 'no-explanation') return { explanation: null, evidence: baseEvidence };

  const stale = state === 'stale-node';
  const unsupported = state === 'unsupported-node';
  const failed = state === 'llm-failed';
  const status: ArchitectureMapStatus = stale
    ? 'stale'
    : unsupported
      ? 'unsupported'
      : node.status === 'partial' || node.status === 'inferred'
        ? 'insufficient'
        : node.status;
  const generationStatus = stale ? 'stale' : failed ? 'llm_failed' : 'llm_generated';
  const evidence = baseEvidence.map((item) => ({
    ...item,
    node_id: node.id,
    status: stale ? 'stale' as const : item.status,
    is_stale: stale,
  }));

  return {
    evidence,
    explanation: {
      analysis_run_id: 'fixture-run',
      node_id: node.id,
      status,
      generation_status: generationStatus,
      model: failed ? 'anthropic/claude-sonnet-4.6 (failed)' : 'anthropic/claude-sonnet-4.6',
      summary: unsupported
        ? 'The backend found this area but marked the explanation unsupported by current evidence.'
        : `${node.label} coordinates document evidence from upload through retrieval-backed prompt context.`,
      simple_explanation: unsupported
        ? 'The system does not have enough source-cited proof to explain this area as a working feature yet.'
        : 'This area helps the app use uploaded documents without training the model. It stores searchable pieces of documents, finds the most relevant pieces later, and adds them to the model prompt so answers can use the uploaded material.',
      technical_explanation: unsupported
        ? 'The projected node exists, but the cited source spans do not prove the claimed behavior. The rail keeps this degraded state visible instead of turning it into a stronger story.'
        : 'The RAG path is supported by ingestion code, retrieval code, and prompt-building code. Ingestion prepares chunks, retrieval uses query embeddings to find matching chunks, and prompt assembly inserts selected chunks into the model request path.',
      responsibilities: [
        {
          text: 'Prepare uploaded document content for later retrieval.',
          support: unsupported ? 'unsupported' : 'verified',
          evidence_ids: unsupported ? [] : ['ev-rag-ingestion'],
        },
        {
          text: 'Find relevant chunks for a user question before the model answers.',
          support: unsupported ? 'insufficient' : 'verified',
          evidence_ids: unsupported ? [] : ['ev-rag-retriever'],
        },
        {
          text: 'Provide document context to the prompt builder.',
          support: 'inferred',
          evidence_ids: ['ev-rag-prompt'],
        },
      ],
      what_happens: [
        {
          text: 'Documents are processed into chunks and searchable records.',
          support: unsupported ? 'unsupported' : 'verified',
          evidence_ids: unsupported ? [] : ['ev-rag-ingestion'],
        },
        {
          text: 'A later question is embedded and matched against stored document chunks.',
          support: unsupported ? 'insufficient' : 'verified',
          evidence_ids: unsupported ? [] : ['ev-rag-retriever'],
        },
        {
          text: 'Selected chunks are inserted as context for model response generation.',
          support: 'verified',
          evidence_ids: ['ev-rag-prompt'],
        },
      ],
      key_files: [
        {
          file_path: 'backend/open_webui/retrieval/ingestion.py',
          reason: 'Owns document ingestion and chunk preparation.',
          evidence_ids: ['ev-rag-ingestion'],
        },
        {
          file_path: 'backend/open_webui/retrieval/retriever.py',
          reason: 'Shows retrieval and ranking behavior.',
          evidence_ids: ['ev-rag-retriever'],
        },
        {
          file_path: 'backend/open_webui/generation/prompt_builder.py',
          reason: 'Connects retrieved chunks to the model prompt.',
          evidence_ids: ['ev-rag-prompt'],
        },
      ],
      relationships: [
        {
          label: 'AI Providers',
          reason: 'Retrieved context eventually feeds model-provider calls.',
          target_id: 'ai-providers',
        },
        {
          label: 'Data & Storage',
          reason: 'Document chunks and vectors require persistence.',
          target_id: 'data-storage',
        },
      ],
      gaps: unsupported
        ? ['Current evidence does not prove the claimed end-to-end RAG behavior.']
        : ['Some fallback retrieval paths are inferred from structure rather than directly cited.'],
      warnings: failed
        ? ['The fixture is showing an LLM failure state. The node falls back to raw architecture-map details.']
        : stale
          ? ['This explanation may be stale because the prompt or source evidence changed.']
          : node.warnings ?? [],
      suggested_questions: [
        'How does a document affect the answer?',
        'Where is the vector database configured?',
        'Which file builds the prompt context?',
      ],
      evidence_ids: evidence.map((item) => item.id),
      prompt_hash: stale ? 'old-prompt-hash' : 'fixture-prompt-hash',
      input_hash: stale ? 'old-input-hash' : 'fixture-input-hash',
      reason: failed ? 'Fixture LLM failure state.' : '',
    },
  };
}
