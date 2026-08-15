import type {
  ArchitectureMapEvidenceDTO,
  QueryResponseDTO,
  QuestionLensDTO,
  QuestionLensStepDTO,
} from '../../architecture-map/apiTypes';

type QuestionFixtureKey = 'login' | 'rag-upload' | 'model-provider' | 'unsupported' | 'partial' | 'concept' | 'no-lens';

function evidence(
  id: string,
  filePath: string,
  startLine: number,
  endLine: number,
  reason: string,
  status: ArchitectureMapEvidenceDTO['status'] = 'verified',
): ArchitectureMapEvidenceDTO {
  return {
    id,
    analysis_run_id: 'fixture-run',
    node_id: id,
    evidence_kind: 'question_lens',
    source_ref_kind: 'source_span',
    source_ref_id: id,
    file_path: filePath,
    language: filePath.endsWith('.py') ? 'python' : 'typescript',
    start_line: startLine,
    end_line: endLine,
    text_preview: reason,
    status,
    confidence: status === 'verified' ? 0.9 : 0.56,
    score: status === 'verified' ? 0.9 : 0.56,
    reason,
    is_stale: false,
  };
}

function step(
  id: string,
  label: string,
  type: string,
  filePath: string,
  startLine: number,
  endLine: number,
  status: QuestionLensStepDTO['status'] = 'verified',
  gapReason = '',
): QuestionLensStepDTO {
  return {
    id,
    label,
    step_type: type,
    status,
    confidence: status === 'verified' ? 0.9 : 0.58,
    source_span_id: id,
    file_path: filePath,
    start_line: startLine,
    end_line: endLine,
    gap_reason: gapReason,
  };
}

const loginLens: QuestionLensDTO = {
  id: 'question_lens:flow:login-flow',
  analysis_run_id: 'fixture-run',
  type: 'flow',
  title: 'Question Lens: How login works',
  status: 'verified',
  intent: 'explanatory',
  subject_type: 'flow',
  subject_id: 'login-flow',
  description: 'A source-backed walkthrough of login from the UI to backend session creation.',
  simple_explanation: 'The user submits credentials, the frontend API wrapper sends them to the backend login route, and the backend verifies the user before creating session state.',
  technical_explanation: 'The lens connects the login form submit handler, API client wrapper, auth route, auth service, user repository lookup, and token boundary.',
  confidence: 0.9,
  steps: [
    step('span-login-submit', 'User submits the login form', 'frontend_event', 'frontend/src/routes/login/Login.svelte', 12, 22),
    step('span-api-login', 'Frontend posts credentials to /auth/login', 'api_call', 'frontend/src/lib/api-client.ts', 4, 6),
    step('span-auth-route', 'Backend login route receives the request', 'route_handler', 'backend/open_webui/routers/auth.py', 3, 7),
    step('span-auth-service', 'Auth service validates the password', 'auth_guard', 'backend/open_webui/services/auth.py', 1, 9),
    step('span-user-repo', 'User record is loaded from persistence', 'repository_call', 'backend/open_webui/models/users.py', 1, 3),
    step('span-auth-token', 'Session token is issued', 'external_boundary', 'backend/open_webui/services/auth.py', 7, 9),
  ],
  evidence: [
    evidence('span-api-login', 'frontend/src/lib/api-client.ts', 4, 6, 'Frontend wrapper posts credentials to the login endpoint.'),
    evidence('span-auth-route', 'backend/open_webui/routers/auth.py', 3, 7, 'Backend route calls password verification and token creation.'),
    evidence('span-auth-service', 'backend/open_webui/services/auth.py', 1, 9, 'Auth service verifies passwords and creates tokens.'),
  ],
  source_tabs: [],
  related_architecture_node_ids: ['auth-users', 'web-api'],
  related_concept_ids: [],
  related_flow_ids: ['login-flow'],
  gaps: [],
  searched_areas: ['Auth & Users', 'Web & API Layer'],
  unsupported_reason: '',
  metadata: { audience: 'mixed' },
};

const ragLens: QuestionLensDTO = {
  id: 'question_lens:flow:rag-document-flow',
  analysis_run_id: 'fixture-run',
  type: 'flow',
  title: 'Question Lens: How uploaded documents affect answers',
  status: 'verified',
  intent: 'explanatory',
  subject_type: 'flow',
  subject_id: 'rag-document-flow',
  description: 'A source-backed RAG journey from upload to prompt context.',
  simple_explanation: 'The uploaded document does not train the model. The system stores searchable chunks, retrieves relevant chunks later, and adds them to the prompt before calling the model.',
  technical_explanation: 'The lens traces upload handling, ingestion, chunking, vector retrieval, prompt construction, and the provider boundary.',
  confidence: 0.88,
  steps: [
    step('span-upload-ui', 'User uploads a document', 'frontend_event', 'frontend/src/routes/documents/Upload.svelte', 18, 32),
    step('span-api-upload', 'Frontend wrapper posts the upload', 'api_call', 'frontend/src/lib/api-client.ts', 8, 12),
    step('span-ingestion', 'Ingestion extracts and chunks text', 'service_call', 'backend/open_webui/retrieval/ingestion.py', 4, 19),
    step('span-retriever', 'Retriever searches for relevant chunks', 'database_boundary', 'backend/open_webui/retrieval/retriever.py', 4, 14),
    step('span-prompt-builder', 'Prompt builder inserts retrieved context', 'service_call', 'backend/open_webui/generation/prompt_builder.py', 2, 8),
    step('span-model-boundary', 'The enriched prompt goes to the model provider', 'external_boundary', 'backend/open_webui/generation/prompt_builder.py', 4, 8),
  ],
  evidence: [
    evidence('span-ingestion', 'backend/open_webui/retrieval/ingestion.py', 4, 19, 'Documents are stored, extracted, and chunked.'),
    evidence('span-retriever', 'backend/open_webui/retrieval/retriever.py', 4, 14, 'Query embedding and vector search retrieve relevant chunks.'),
    evidence('span-prompt-builder', 'backend/open_webui/generation/prompt_builder.py', 2, 8, 'Retrieved chunks are inserted into the model prompt.'),
  ],
  source_tabs: [],
  related_architecture_node_ids: ['rag-pipeline'],
  related_concept_ids: [],
  related_flow_ids: ['rag-document-flow'],
  gaps: [],
  searched_areas: ['RAG Pipeline', 'Data & Storage', 'AI Providers'],
  unsupported_reason: '',
  metadata: { audience: 'mixed' },
};

const providerLens: QuestionLensDTO = {
  id: 'question_lens:flow:provider-routing-flow',
  analysis_run_id: 'fixture-run',
  type: 'flow',
  title: 'Question Lens: Where the model response comes from',
  status: 'verified',
  intent: 'explanatory',
  subject_type: 'flow',
  subject_id: 'provider-routing-flow',
  description: 'A provider-routing answer showing where chat requests leave the app.',
  simple_explanation: 'The selected model decides which provider receives the request. The backend normalizes the request, sends it to an Ollama or OpenAI-compatible boundary, then streams the answer back.',
  technical_explanation: 'The lens connects frontend selected model state, chat API submission, backend provider routing, provider client normalization, and external model boundary.',
  confidence: 0.86,
  steps: [
    step('span-model-select', 'User sends a message with a selected model', 'frontend_event', 'frontend/src/routes/chat/Chat.svelte', 40, 52),
    step('span-chat-api', 'Frontend submits model and prompt', 'api_call', 'frontend/src/lib/chat-api.ts', 7, 18),
    step('span-provider-route', 'Backend receives the chat request', 'route_handler', 'backend/open_webui/routers/openai.py', 22, 38),
    step('span-provider-client', 'Provider router normalizes the request', 'service_call', 'backend/open_webui/providers/router.py', 10, 28),
    step('span-provider-boundary', 'Request crosses to the configured model provider', 'external_boundary', 'backend/open_webui/providers/router.py', 26, 34),
  ],
  evidence: [
    evidence('span-provider-route', 'backend/open_webui/routers/openai.py', 22, 38, 'Backend receives and routes chat requests.'),
    evidence('span-provider-client', 'backend/open_webui/providers/router.py', 10, 28, 'Provider router prepares provider-specific requests.'),
  ],
  source_tabs: [],
  related_architecture_node_ids: ['ai-providers'],
  related_concept_ids: [],
  related_flow_ids: ['provider-routing-flow'],
  gaps: [],
  searched_areas: ['AI Providers', 'Web & API Layer'],
  unsupported_reason: '',
  metadata: { audience: 'mixed' },
};

const unsupportedLens: QuestionLensDTO = {
  id: 'question_lens:unsupported:kafka-blockchain',
  analysis_run_id: 'fixture-run',
  type: 'unsupported',
  title: 'Question Lens: No source-backed Kafka or blockchain usage',
  status: 'unsupported',
  intent: 'negative',
  subject_type: 'question_lens',
  subject_id: 'kafka-blockchain',
  description: 'The fixture intentionally shows an unsupported answer.',
  simple_explanation: 'The system did not find source-backed evidence that this repo uses Kafka or blockchain.',
  technical_explanation: 'The searched architecture areas and source evidence did not produce matching routes, imports, concepts, flows, or source spans.',
  confidence: 0.72,
  steps: [],
  evidence: [],
  source_tabs: [],
  related_architecture_node_ids: [],
  related_concept_ids: [],
  related_flow_ids: [],
  gaps: [{ reason: 'no_source_evidence_for_requested_technology', severity: 'info', source_ref_kind: '', source_ref_id: '' }],
  searched_areas: ['imports', 'configuration', 'source summaries', 'flows'],
  unsupported_reason: 'No source-backed evidence was found for Kafka or blockchain.',
  metadata: { terms: ['kafka', 'blockchain'] },
};

const partialLens: QuestionLensDTO = {
  ...ragLens,
  id: 'question_lens:partial:upload-route',
  title: 'Question Lens: Upload path with one unresolved call',
  status: 'insufficient',
  simple_explanation: 'The system can prove the upload wrapper and retrieval path, but one dynamic URL target could not be resolved to a backend route.',
  technical_explanation: 'The frontend wrapper evidence is present, but dynamic URL resolution leaves a gap before the backend target.',
  confidence: 0.62,
  steps: [
    step('span-upload-ui', 'User starts document upload', 'frontend_event', 'frontend/src/routes/documents/Upload.svelte', 18, 32),
    step('span-api-upload', 'Dynamic wrapper builds upload URL', 'api_call', 'frontend/src/lib/api-client.ts', 8, 12, 'insufficient', 'unresolved_api_route'),
    step('span-api-upload-gap', 'Backend target could not be resolved', 'unresolved_call', 'frontend/src/lib/api-client.ts', 11, 12, 'insufficient', 'dynamic_url_unresolved'),
  ],
  gaps: [{ reason: 'dynamic_url_unresolved', severity: 'warning', source_ref_kind: 'source_span', source_ref_id: 'span-api-upload' }],
  unsupported_reason: 'One dynamic API route could not be resolved from source evidence.',
};

const conceptLens: QuestionLensDTO = {
  ...loginLens,
  id: 'question_lens:concept:auth-users',
  type: 'concept_explanation',
  title: 'Question Lens: Where authentication is enforced',
  subject_type: 'concept',
  subject_id: 'auth-users',
  description: 'A concept-centered answer for the Auth & Users area.',
  simple_explanation: 'Authentication is enforced around the login route and auth service. The route receives credentials, while the service verifies them and creates trusted session state.',
  technical_explanation: 'The evidence points to the route boundary, password verification service, repository lookup, and token creation code.',
  steps: [
    step('span-auth-route', 'Route accepts credentials', 'route_handler', 'backend/open_webui/routers/auth.py', 3, 7),
    step('span-auth-service', 'Service validates password and creates token', 'auth_guard', 'backend/open_webui/services/auth.py', 1, 9),
    step('span-user-repo', 'Repository loads user identity', 'repository_call', 'backend/open_webui/models/users.py', 1, 3),
  ],
};

const fixtures: Record<QuestionFixtureKey, QuestionLensDTO | null> = {
  login: loginLens,
  'rag-upload': ragLens,
  'model-provider': providerLens,
  unsupported: unsupportedLens,
  partial: partialLens,
  concept: conceptLens,
  'no-lens': null,
};

const questionText: Record<QuestionFixtureKey, string> = {
  login: 'How does login work?',
  'rag-upload': 'How does an uploaded document affect the answer?',
  'model-provider': 'Where does the model response come from?',
  unsupported: 'Does this repo use Kafka or blockchain?',
  partial: 'What happens after I upload a document?',
  concept: 'Where is authentication enforced?',
  'no-lens': 'What should I understand first?',
};

export function normalizeQuestionFixtureKey(value: string | null): QuestionFixtureKey | null {
  if (!value) return null;
  return value in fixtures ? value as QuestionFixtureKey : null;
}

export function getFixtureQueryResponse(key: QuestionFixtureKey): QueryResponseDTO {
  const lens = fixtures[key];
  const answer = lens?.simple_explanation
    ?? 'The backend returned a plain answer, but no visual lens was available for this question. The UI keeps the architecture map visible instead of inventing one.';
  return {
    analysis_run_id: 'fixture-run',
    answer_text: answer,
    intent: lens?.intent ?? 'explanatory',
    citations: [],
    confidence: lens?.confidence ?? 0.54,
    follow_ups: [
      'Show the source proof for this answer.',
      'Which files matter most here?',
      'What is still uncertain?',
    ],
    diagrams: [],
    visual_lenses: lens ? [lens] : [],
    lens_count: lens ? 1 : 0,
    unsupported_reasons: lens?.unsupported_reason ? [lens.unsupported_reason] : [],
    evidence_coverage: {
      lens_count: lens ? 1 : 0,
      evidence_count: lens?.evidence.length ?? 0,
      source_tab_count: lens?.source_tabs.length ?? 0,
    },
    conversation_id: 'fixture-conversation',
    turn_number: 1,
    run_metadata: { fixture: true },
  };
}

export function getFixtureQuestionLens(key: QuestionFixtureKey | null, lensId?: string | null): QuestionLensDTO | null {
  if (lensId) {
    return Object.values(fixtures).find((lens) => lens?.id === lensId) ?? null;
  }
  return key ? fixtures[key] : null;
}

export function getFixtureQuestionText(key: QuestionFixtureKey | null): string {
  return key ? questionText[key] : '';
}
