import type {
  CodeCompanionSelection,
  FileContentResponse,
  ImplementationSliceDTO,
} from '../../architecture-map/apiTypes';

const files: Record<string, string> = {
  'frontend/src/lib/api-client.ts': [
    'export class ApiClient {',
    '  constructor(private baseUrl = "/api") {}',
    '',
    '  login(email: string, password: string) {',
    '    return this.post("/auth/login", { email, password })',
    '  }',
    '',
    '  uploadDocument(file: File) {',
    '    const body = new FormData()',
    '    body.append("file", file)',
    '    return this.post("/documents/upload", body)',
    '  }',
    '',
    '  private post(path: string, body: unknown) {',
    '    return fetch(`${this.baseUrl}${path}`, { method: "POST", body: JSON.stringify(body) })',
    '  }',
    '}',
  ].join('\n'),
  'backend/open_webui/routers/auth.py': [
    'from open_webui.services.auth import AuthService',
    '',
    'async def login(request: LoginRequest, auth: AuthService):',
    '    """POST /api/auth/login"""',
    '    user = auth.verify_password(request.email, request.password)',
    '    token = auth.create_session_token(user)',
    '    return {"token": token, "user": user.to_public()}',
  ].join('\n'),
  'backend/open_webui/services/auth.py': [
    'class AuthService:',
    '    def verify_password(self, email: str, password: str):',
    '        user = self.users.find_by_email(email)',
    '        if not user or not self.passwords.verify(password, user.password_hash):',
    '            raise InvalidCredentials()',
    '        return user',
    '',
    '    def create_session_token(self, user):',
    '        return self.tokens.issue(subject=user.id, role=user.role)',
  ].join('\n'),
  'backend/open_webui/models/users.py': [
    'class UserRepository:',
    '    def find_by_email(self, email: str):',
    '        return self.session.query(User).filter(User.email == email).one_or_none()',
    '',
    'class User(BaseModel):',
    '    id: str',
    '    email: str',
    '    role: str',
  ].join('\n'),
  'backend/open_webui/retrieval/ingestion.py': [
    'from pathlib import Path',
    'from typing import Iterable',
    '',
    'class DocumentIngestionService:',
    '    def ingest_upload(self, upload, collection_id: str):',
    '        path = self._store_upload(upload, collection_id)',
    '        text = self.extract_text(path)',
    '        chunks = self.chunk_text(text)',
    '        records = self.persist_chunks(collection_id, chunks)',
    '        return self.enqueue_embeddings(records)',
    '',
    '    def extract_text(self, path: Path) -> str:',
    '        """Read uploaded source material into normalized text."""',
    '        return self.extractor.read(path).strip()',
    '',
    '    def chunk_text(self, text: str) -> list[str]:',
    '        """Break long documents into searchable pieces."""',
    '        return self.chunker.split(text, max_tokens=800, overlap=120)',
    '',
    '    def persist_chunks(self, collection_id: str, chunks: Iterable[str]):',
    '        return self.document_store.insert_chunks(collection_id, chunks)',
  ].join('\n'),
  'backend/open_webui/retrieval/retriever.py': [
    'from typing import List',
    '',
    'class Retriever:',
    '    def retrieve(self, query: str, top_k: int = 10) -> List[Document]:',
    '        """Embed query and retrieve relevant documents."""',
    '        query_vec = self.embedder.embed_query(query)',
    '        results = self.vector_db.search(',
    '            vector=query_vec,',
    '            top_k=top_k,',
    '            filters=self._build_filters(),',
    '        )',
    '        # Rerank for better relevance',
    '        reranked = self.reranker.rerank(query, results)',
    '        return reranked[:top_k]',
    '',
    '    def _build_filters(self):',
    '        return {"collection": self.collection_id}',
  ].join('\n'),
  'backend/open_webui/generation/prompt_builder.py': [
    'class PromptBuilder:',
    '    def build_with_context(self, question: str, chunks: list[Document]):',
    '        context = "\\n\\n".join(chunk.text for chunk in chunks)',
    '        messages = [',
    '            {"role": "system", "content": "Answer using provided sources."},',
    '            {"role": "user", "content": f"Context:\\n{context}\\n\\nQuestion: {question}"},',
    '        ]',
    '        return messages',
  ].join('\n'),
};

const flowTabs = [
  {
    file_path: 'frontend/src/lib/api-client.ts',
    language: 'typescript',
    role: 'primary',
    summary: 'Frontend API wrapper proof.',
    reason: 'Shows browser code calling backend endpoints through a shared API wrapper.',
    source_span_ids: ['span-api-login', 'span-api-upload'],
    highlights: [
      { span_id: 'span-api-login', start_line: 4, end_line: 6, status: 'verified' as const, confidence: 0.9 },
      { span_id: 'span-api-upload', start_line: 8, end_line: 12, status: 'insufficient' as const, confidence: 0.58 },
    ],
    is_stale: false,
  },
  {
    file_path: 'backend/open_webui/routers/auth.py',
    language: 'python',
    role: 'supporting',
    summary: 'Backend route proof.',
    reason: 'Shows the login route validating credentials and creating a session token.',
    source_span_ids: ['span-auth-route'],
    highlights: [{ span_id: 'span-auth-route', start_line: 3, end_line: 7, status: 'verified' as const, confidence: 0.91 }],
    is_stale: false,
  },
  {
    file_path: 'backend/open_webui/services/auth.py',
    language: 'python',
    role: 'supporting',
    summary: 'Auth service proof.',
    reason: 'Shows password verification and session-token creation.',
    source_span_ids: ['span-auth-service'],
    highlights: [{ span_id: 'span-auth-service', start_line: 1, end_line: 9, status: 'verified' as const, confidence: 0.88 }],
    is_stale: false,
  },
];

const baseTabs = [
  {
    file_path: 'backend/open_webui/retrieval/retriever.py',
    language: 'python',
    role: 'primary',
    summary: 'Retrieval and reranking source proof.',
    reason: 'Shows query embedding, vector search, and reranking.',
    source_span_ids: ['span-retriever'],
    highlights: [{ span_id: 'span-retriever', start_line: 4, end_line: 14, status: 'verified' as const, confidence: 0.9 }],
    is_stale: false,
  },
  {
    file_path: 'backend/open_webui/retrieval/ingestion.py',
    language: 'python',
    role: 'supporting',
    summary: 'Document upload and chunking proof.',
    reason: 'Shows how uploaded files become chunks and embedding jobs.',
    source_span_ids: ['span-ingestion'],
    highlights: [{ span_id: 'span-ingestion', start_line: 4, end_line: 19, status: 'verified' as const, confidence: 0.92 }],
    is_stale: false,
  },
  {
    file_path: 'backend/open_webui/generation/prompt_builder.py',
    language: 'python',
    role: 'supporting',
    summary: 'Prompt context assembly proof.',
    reason: 'Shows retrieved chunks being added to prompt messages.',
    source_span_ids: ['span-prompt-builder'],
    highlights: [{ span_id: 'span-prompt-builder', start_line: 2, end_line: 8, status: 'verified' as const, confidence: 0.86 }],
    is_stale: false,
  },
];

export function getFixtureImplementationSlice(
  selection: CodeCompanionSelection,
  state: string,
): ImplementationSliceDTO {
  if (selection.subject_type === 'question_lens') {
    const isLogin = selection.subject_id.includes('login') || selection.title?.toLowerCase().includes('login');
    const stepSpan = selection.span_id;
    const sourceTabs = isLogin ? flowTabs : baseTabs;
    const matchedTabs = stepSpan
      ? sourceTabs.filter((tab) => tab.highlights.some((highlight) => highlight.span_id === stepSpan))
      : [];
    const tabs = matchedTabs.length > 0 ? matchedTabs : sourceTabs;
    return {
      analysis_run_id: 'fixture-run',
      node_id: selection.subject_id,
      status: state === 'partial' ? 'insufficient' : 'verified',
      subject: { type: 'question_lens', id: selection.subject_id },
      title: selection.title || 'Question Lens source proof',
      summary: 'This answer is backed by the source spans shown in the question lens.',
      primary_span_id: stepSpan || tabs[0]?.highlights[0]?.span_id || '',
      evidence_strength: 0.88,
      tabs,
      gaps: state === 'partial' ? ['One answer step is inferred from partial source evidence.'] : [],
      unsupported_reason: '',
      warnings: [],
    };
  }
  if (selection.subject_type === 'flow' || selection.subject_type === 'flow_step') {
    const stepSpan = selection.span_id;
    const matchedTabs = stepSpan
      ? flowTabs.filter((tab) => tab.highlights.some((highlight) => highlight.span_id === stepSpan))
      : [];
    const tabs = matchedTabs.length > 0 ? matchedTabs : flowTabs;
    return {
      analysis_run_id: 'fixture-run',
      node_id: selection.subject_id,
      status: state === 'partial-flow' ? 'insufficient' : 'verified',
      subject: { type: selection.subject_type, id: selection.subject_id },
      title: selection.title || (selection.subject_type === 'flow_step' ? 'Flow step proof' : 'Login Flow'),
      summary: selection.subject_type === 'flow_step'
        ? 'This flow step is backed by the source span selected on the movement lens.'
        : 'The flow is backed by frontend wrapper, backend route, auth service, and persistence source spans.',
      primary_span_id: stepSpan || 'span-api-login',
      evidence_strength: 0.88,
      tabs,
      gaps: state === 'partial-flow' ? ['One downstream call is unresolved and opens at the caller span.'] : [],
      unsupported_reason: '',
      warnings: state === 'partial-flow' ? ['Partial flow proof includes unresolved call evidence.'] : [],
    };
  }
  const noProof = state === 'no-proof' || state === 'unsupported-node';
  const stale = state === 'stale-node';
  const single = state === 'single-file-proof';
  const large = state === 'large-highlight';
  if (noProof) {
    return {
      analysis_run_id: 'fixture-run',
      node_id: selection.subject_id || 'rag-pipeline',
      status: state === 'unsupported-node' ? 'unsupported' : 'insufficient',
      subject: { type: selection.subject_type || 'architecture_node', id: selection.subject_id || 'rag-pipeline' },
      title: selection.title || 'RAG Pipeline',
      summary: 'No source-backed implementation slice was returned for this item.',
      primary_span_id: '',
      evidence_strength: 0,
      tabs: [],
      gaps: ['The backend has architecture metadata, but not enough source span evidence to open code.'],
      unsupported_reason: 'No source-backed implementation slice was returned for this item.',
      warnings: [],
    };
  }
  const tabs = (single ? baseTabs.slice(0, 1) : baseTabs).map((tab) => ({
    ...tab,
    is_stale: stale,
    highlights: tab.highlights.map((highlight) => ({
      ...highlight,
      status: stale ? 'stale' as const : highlight.status,
      end_line: large ? Math.min(highlight.end_line + 6, files[tab.file_path].split('\n').length) : highlight.end_line,
    })),
  }));
  return {
    analysis_run_id: 'fixture-run',
    node_id: selection.subject_id || 'rag-pipeline',
    status: stale ? 'stale' : 'verified',
    subject: { type: selection.subject_type || 'architecture_node', id: selection.subject_id || 'rag-pipeline' },
    title: selection.title || 'RAG Pipeline',
    summary: 'RAG Pipeline is backed by ingestion, retrieval, and prompt-building source spans.',
    primary_span_id: selection.span_id || 'span-retriever',
    evidence_strength: 0.91,
    tabs,
    gaps: [],
    unsupported_reason: '',
    warnings: stale ? ['This proof may be stale because the source or prompt changed.'] : [],
  };
}

export function getFixtureFileContent(filePath: string): FileContentResponse {
  const content = files[filePath] ?? '# Fixture source file not found\n';
  return {
    file_path: filePath,
    content,
    entities: [],
    line_count: content.split('\n').length,
    language: filePath.endsWith('.py') ? 'python' : 'typescript',
  };
}
