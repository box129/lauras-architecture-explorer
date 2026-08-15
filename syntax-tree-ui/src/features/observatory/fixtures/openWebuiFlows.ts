import type {
  FlowDetailDTO,
  FlowListItemDTO,
  FlowListResponse,
  FlowStepDTO,
  SourceSpanDTO,
} from '../../architecture-map/apiTypes';

function span(id: string, filePath: string, startLine: number, endLine: number, language = 'python'): SourceSpanDTO {
  return {
    id,
    analysis_run_id: 'fixture-run',
    file_path: filePath,
    language,
    start_line: startLine,
    end_line: endLine,
    text_preview: '',
    text_hash: `hash-${id}`,
    current_text_hash: `hash-${id}`,
    is_stale: false,
    symbol_id: '',
    qualified_name: '',
    kind: 'flow_step',
    status: 'verified',
    confidence: 0.9,
  };
}

function flowItem(
  id: string,
  name: string,
  status: string,
  stepCount: number,
  simple: string,
  technical: string,
  gaps = 0,
): FlowListItemDTO {
  return {
    id,
    analysis_run_id: 'fixture-run',
    name,
    trigger_kind: 'frontend_event',
    trigger_id: `${id}-trigger`,
    status,
    confidence: status === 'verified' ? 0.9 : 0.62,
    unsupported_reason: gaps ? 'unresolved_api_route' : '',
    evidence_count: Math.max(1, stepCount - gaps),
    step_count: stepCount,
    first_source_span: null,
    trigger_summary: name,
    user_action_label: name,
    simple_explanation: simple,
    technical_explanation: technical,
    related_architecture_node_ids: [],
    related_concept_ids: [],
    gap_count: gaps,
    boundary_count: 1,
  };
}

function step(
  id: string,
  order: number,
  type: string,
  description: string,
  sourceSpan: SourceSpanDTO,
  gapReason = '',
): FlowStepDTO {
  return {
    id,
    analysis_run_id: 'fixture-run',
    step_order: order,
    step_type: type,
    description,
    boundary_kind: type.includes('boundary') ? type : null,
    source_span: sourceSpan,
    symbol: null,
    linked_route: type === 'route_handler'
      ? {
        id: `${id}-route`,
        method: 'POST',
        path_template: sourceSpan.file_path.includes('auth') ? '/api/auth/login' : '/api/documents/upload',
        framework: 'FastAPI',
        handler_symbol_id: '',
        span_id: sourceSpan.id,
        auth_hint: '',
        status: 'verified',
        confidence: 0.9,
      }
      : null,
    linked_api_call: type === 'api_call'
      ? {
        id: `${id}-api`,
        method: 'POST',
        url_template: description.toLowerCase().includes('upload') ? '/api/documents/upload' : '/api/auth/login',
        client_kind: 'wrapper',
        span_id: sourceSpan.id,
        caller_symbol_id: '',
        resolved_route_id: '',
        status: gapReason ? 'insufficient' : 'verified',
        confidence: gapReason ? 0.52 : 0.9,
      }
      : null,
    linked_frontend_event: type === 'frontend_event'
      ? {
        id: `${id}-event`,
        event_type: 'submit',
        event_label: description,
        framework: 'SvelteKit',
        span_id: sourceSpan.id,
        component_symbol_id: '',
        handler_symbol_id: '',
        status: 'verified',
        confidence: 0.88,
      }
      : null,
    confidence: gapReason ? 0.48 : 0.9,
    gap_reason: gapReason,
  };
}

const loginFlow = flowItem(
  'login-flow',
  'Login Flow',
  'verified',
  6,
  'The user submits credentials, the frontend API wrapper calls the backend login route, and the backend verifies the user before issuing session state.',
  'This flow connects the UI submit handler, API client wrapper, FastAPI route handler, auth service, user lookup, and token boundary.',
);

const ragFlow = flowItem(
  'rag-document-flow',
  'RAG Document Flow',
  'verified',
  7,
  'Uploaded documents are stored, chunked, embedded, retrieved later, and inserted into the model prompt as context.',
  'The fixture traces upload through ingestion, chunk persistence, embedding/vector search, retrieval, and prompt construction.',
);

const providerFlow = flowItem(
  'provider-routing-flow',
  'Model Provider Routing Flow',
  'verified',
  5,
  'The selected model determines whether a request goes to Ollama, OpenAI-compatible APIs, or another configured provider.',
  'Provider routing combines selected model state, backend routing code, provider client boundaries, and streaming response handling.',
);

const unresolvedFlow = flowItem(
  'unresolved-api-flow',
  'Partial Upload Flow',
  'insufficient',
  4,
  'The upload starts in the frontend and reaches an API wrapper, but one dynamic URL could not be resolved to a backend route.',
  'This partial flow preserves caller evidence and marks the unresolved API route as a gap instead of inventing a target.',
  1,
);

const healthFlow = flowItem(
  'health-check-flow',
  'Health Check Flow',
  'verified',
  3,
  'A backend-only endpoint reports service health without frontend interaction.',
  'This flow starts at a route handler and ends at a service/runtime boundary.',
);

const details: Record<string, FlowDetailDTO> = {
  'login-flow': {
    flow: loginFlow,
    trigger: { kind: 'frontend_event', label: 'Login submit' },
    steps: [
      step('login-submit-step', 1, 'frontend_event', 'User submits the login form.', span('span-login-submit', 'frontend/src/routes/login/Login.svelte', 12, 22, 'svelte')),
      step('login-api-step', 2, 'api_call', 'API client posts credentials to /auth/login.', span('span-api-login', 'frontend/src/lib/api-client.ts', 4, 6, 'typescript')),
      step('login-route-step', 3, 'route_handler', 'Backend login route receives the request.', span('span-auth-route', 'backend/open_webui/routers/auth.py', 3, 7)),
      step('login-auth-step', 4, 'auth_guard', 'Auth service validates the password.', span('span-auth-service', 'backend/open_webui/services/auth.py', 1, 9)),
      step('login-user-step', 5, 'repository_call', 'User record is loaded from persistence.', span('span-user-repo', 'backend/open_webui/models/users.py', 1, 3)),
      step('login-token-step', 6, 'external_boundary', 'Session token is issued for the user.', span('span-auth-service', 'backend/open_webui/services/auth.py', 7, 9)),
    ],
  },
  'rag-document-flow': {
    flow: ragFlow,
    trigger: { kind: 'frontend_event', label: 'Document upload' },
    steps: [
      step('upload-step', 1, 'frontend_event', 'User chooses and uploads a document.', span('span-upload-ui', 'frontend/src/routes/documents/Upload.svelte', 18, 32, 'svelte')),
      step('upload-api-step', 2, 'api_call', 'Frontend wrapper posts the upload to the backend.', span('span-api-upload', 'frontend/src/lib/api-client.ts', 8, 12, 'typescript')),
      step('ingestion-step', 3, 'service_call', 'Ingestion stores the upload and extracts text.', span('span-ingestion', 'backend/open_webui/retrieval/ingestion.py', 4, 14)),
      step('chunk-step', 4, 'model_operation', 'Text is chunked into searchable pieces.', span('span-ingestion', 'backend/open_webui/retrieval/ingestion.py', 16, 19)),
      step('retrieval-step', 5, 'database_boundary', 'Vector search retrieves relevant chunks later.', span('span-retriever', 'backend/open_webui/retrieval/retriever.py', 4, 14)),
      step('prompt-step', 6, 'service_call', 'Prompt builder inserts retrieved chunks.', span('span-prompt-builder', 'backend/open_webui/generation/prompt_builder.py', 2, 8)),
      step('llm-step', 7, 'external_boundary', 'The enriched prompt crosses the model-provider boundary.', span('span-prompt-builder', 'backend/open_webui/generation/prompt_builder.py', 4, 8)),
    ],
  },
  'provider-routing-flow': {
    flow: providerFlow,
    trigger: { kind: 'route_handler', label: 'Chat completion' },
    steps: [
      step('model-selection-step', 1, 'frontend_event', 'User sends a message with a selected model.', span('span-model-select', 'frontend/src/routes/chat/Chat.svelte', 40, 52, 'svelte')),
      step('chat-api-step', 2, 'api_call', 'Chat API submits model and prompt.', span('span-chat-api', 'frontend/src/lib/chat-api.ts', 7, 18, 'typescript')),
      step('provider-route-step', 3, 'route_handler', 'Backend receives the chat request.', span('span-provider-route', 'backend/open_webui/routers/openai.py', 22, 38)),
      step('provider-client-step', 4, 'service_call', 'Provider client normalizes the request.', span('span-provider-client', 'backend/open_webui/providers/router.py', 10, 28)),
      step('provider-boundary-step', 5, 'external_boundary', 'Request crosses to Ollama or OpenAI-compatible API.', span('span-provider-client', 'backend/open_webui/providers/router.py', 26, 34)),
    ],
  },
  'unresolved-api-flow': {
    flow: unresolvedFlow,
    trigger: { kind: 'frontend_event', label: 'Dynamic upload wrapper' },
    steps: [
      step('partial-upload-step', 1, 'frontend_event', 'User starts a document upload.', span('span-upload-ui', 'frontend/src/routes/documents/Upload.svelte', 18, 32, 'svelte')),
      step('partial-api-step', 2, 'api_call', 'A dynamic wrapper builds the upload URL.', span('span-api-upload', 'frontend/src/lib/api-client.ts', 8, 12, 'typescript'), 'unresolved_api_route'),
      step('partial-boundary-step', 3, 'unresolved_call', 'Backend target could not be resolved from the dynamic URL.', span('span-api-upload', 'frontend/src/lib/api-client.ts', 11, 12, 'typescript'), 'dynamic_url_unresolved'),
      step('partial-proof-step', 4, 'external_boundary', 'The proof opens at the caller because no target span exists.', span('span-api-upload', 'frontend/src/lib/api-client.ts', 8, 12, 'typescript'), 'target_span_missing'),
    ],
  },
  'health-check-flow': {
    flow: healthFlow,
    trigger: { kind: 'route_handler', label: 'Health check' },
    steps: [
      step('health-route-step', 1, 'route_handler', 'Health route receives a backend-only check.', span('span-health-route', 'backend/open_webui/routers/health.py', 1, 8)),
      step('health-service-step', 2, 'service_call', 'Service gathers runtime health.', span('span-health-service', 'backend/open_webui/services/health.py', 1, 12)),
      step('health-boundary-step', 3, 'external_boundary', 'Runtime status is returned to the caller.', span('span-health-service', 'backend/open_webui/services/health.py', 8, 12)),
    ],
  },
};

export function getFixtureFlowList(state: string): FlowListResponse {
  const flows = state === 'no-flows'
    ? []
    : [loginFlow, ragFlow, providerFlow, unresolvedFlow, healthFlow];
  return {
    analysis_run_id: 'fixture-run',
    flows,
    total: flows.length,
    limit: 50,
    offset: 0,
  };
}

export function getFixtureFlowDetail(flowId: string, state: string): FlowDetailDTO | null {
  if (state === 'no-flows') return null;
  if (state === 'partial-flow') return details['unresolved-api-flow'];
  return details[flowId] ?? null;
}
