import { layoutArchitectureNodes } from '../../architecture-map/mapLayout';
import { openWebuiLandscape } from './openWebuiLandscape';
import type { ObservatoryEdge, ObservatoryLandscapeFixture, ObservatoryNode } from '../types';

type NodeDraft = Omit<ObservatoryNode, 'position'>;

function makeNode(overrides: Partial<NodeDraft> & Pick<NodeDraft, 'id' | 'label' | 'description'>): NodeDraft {
  return {
    kind: 'concept',
    status: 'verified',
    confidence: 0.78,
    evidenceCount: 8,
    childrenCount: 0,
    canDrilldown: false,
    primaryFiles: [],
    accent: 'slateBlue',
    icon: 'Lightbulb',
    summary: overrides.description,
    whatHappens: ['This child area is fixture data for Phase 2 drilldown review.'],
    relatedLenses: [],
    ...overrides,
  };
}

function makeLens(parentId: string, nodes: NodeDraft[], edges: ObservatoryEdge[] = [], parentOverride?: ObservatoryNode): ObservatoryLandscapeFixture {
  const parent = parentOverride ?? openWebuiLandscape.nodes.find((node) => node.id === parentId);
  const laidOut = layoutArchitectureNodes(nodes);
  return {
    ...openWebuiLandscape,
    breadcrumb: parent ? [...openWebuiLandscape.breadcrumb, parent.label] : openWebuiLandscape.breadcrumb,
    summary: parent?.summary ?? openWebuiLandscape.summary,
    parentNode: parent,
    nodes: laidOut,
    edges,
    promptSuggestions: parent?.relatedLenses ?? openWebuiLandscape.promptSuggestions,
  };
}

export const openWebuiChildLenses: Record<string, ObservatoryLandscapeFixture> = {
  'rag-pipeline': makeLens('rag-pipeline', [
    makeNode({
      id: 'document-upload',
      label: 'Document Upload',
      description: 'Where PDFs and knowledge files enter the backend.',
      kind: 'flow',
      primaryFiles: ['backend/open_webui/routers/retrieval.py'],
      icon: 'FileCode2',
      whatHappens: ['Files are accepted by retrieval routes before extraction and indexing begin.'],
      relatedLenses: ['What happens after upload?', 'Supported file types'],
    }),
    makeNode({
      id: 'text-extraction',
      label: 'Text Extraction',
      description: 'Turns uploaded files into plain text for processing.',
      status: 'insufficient',
      confidence: 0.66,
      primaryFiles: ['backend/open_webui/retrieval/loaders/main.py'],
      whatHappens: ['Loader code extracts text, but exact format-specific boundaries may need stronger evidence.'],
    }),
    makeNode({
      id: 'chunking',
      label: 'Chunking',
      description: 'Breaks long documents into searchable pieces.',
      primaryFiles: ['backend/open_webui/retrieval/utils.py'],
      whatHappens: ['Long text is split into chunks that can be embedded and retrieved later.'],
    }),
    makeNode({
      id: 'embeddings',
      label: 'Embeddings',
      description: 'Converts text chunks and queries into searchable vectors.',
      primaryFiles: ['backend/open_webui/utils/embeddings.py'],
      icon: 'Network',
      whatHappens: ['Embedding helpers generate vector representations for chunks and user questions.'],
    }),
    makeNode({
      id: 'vector-database',
      label: 'Vector Database',
      description: 'Stores and searches embedded document chunks.',
      primaryFiles: ['backend/open_webui/retrieval/vector/main.py'],
      icon: 'Database',
      whatHappens: ['Vector storage keeps searchable document chunks for later retrieval.'],
    }),
    makeNode({
      id: 'retrieval',
      label: 'Retrieval',
      description: 'Finds chunks that match the user question.',
      primaryFiles: ['backend/open_webui/retrieval/retriever.py'],
      icon: 'SearchCode',
      canDrilldown: true,
      childrenCount: 4,
      summary: 'Retrieval selects relevant document chunks and passes them toward prompt construction.',
      whatHappens: ['The query is embedded, similar chunks are retrieved, and relevance can be reranked.'],
      relatedLenses: ['Vector DB Config', 'How does a document affect the answer?'],
    }),
    makeNode({
      id: 'prompt-context',
      label: 'Prompt Context Builder',
      description: 'Adds retrieved chunks to the model prompt.',
      primaryFiles: ['backend/open_webui/utils/middleware.py'],
      icon: 'Workflow',
      whatHappens: ['Retrieved knowledge is inserted into the request context before model generation.'],
    }),
    makeNode({
      id: 'llm-response',
      label: 'LLM Response',
      description: 'The model answers using the enriched context.',
      kind: 'external_boundary',
      primaryFiles: ['backend/open_webui/routers/openai.py'],
      icon: 'Unplug',
      whatHappens: ['The enriched prompt is sent to the selected model provider for response generation.'],
    }),
  ], [
    { id: 'upload-extract', source: 'document-upload', target: 'text-extraction', kind: 'flow' },
    { id: 'extract-chunk', source: 'text-extraction', target: 'chunking', kind: 'flow' },
    { id: 'chunk-embed', source: 'chunking', target: 'embeddings', kind: 'flow' },
    { id: 'embed-store', source: 'embeddings', target: 'vector-database', kind: 'flow' },
    { id: 'store-retrieve', source: 'vector-database', target: 'retrieval', kind: 'flow' },
    { id: 'retrieve-context', source: 'retrieval', target: 'prompt-context', kind: 'flow' },
    { id: 'context-response', source: 'prompt-context', target: 'llm-response', kind: 'flow' },
  ]),
  'web-api': makeLens('web-api', [
    makeNode({ id: 'api-routers', label: 'API Routers', description: 'Route groups for chat, users, retrieval, files, and providers.', icon: 'GitBranch' }),
    makeNode({ id: 'middleware', label: 'Middleware', description: 'Request context, auth checks, CORS, and cross-cutting request behavior.', kind: 'cross_cutting', icon: 'Workflow' }),
    makeNode({ id: 'chat-endpoints', label: 'Chat Endpoints', description: 'Request handlers that receive and stream chat completions.', kind: 'flow', icon: 'GitBranch' }),
    makeNode({ id: 'file-endpoints', label: 'File Endpoints', description: 'Upload and file-management routes.', icon: 'FileCode2' }),
    makeNode({ id: 'provider-endpoints', label: 'Provider Endpoints', description: 'Routes that bridge model provider APIs.', kind: 'external_boundary', icon: 'Unplug' }),
  ]),
  retrieval: makeLens('retrieval', [
    makeNode({
      id: 'query-embedding',
      label: 'Query Embedding',
      description: 'Converts the user question into the same vector space as document chunks.',
      primaryFiles: ['backend/open_webui/utils/embeddings.py'],
      icon: 'Network',
    }),
    makeNode({
      id: 'similarity-search',
      label: 'Similarity Search',
      description: 'Searches the vector store for chunks near the query vector.',
      primaryFiles: ['backend/open_webui/retrieval/vector/main.py'],
      icon: 'SearchCode',
    }),
    makeNode({
      id: 'reranking',
      label: 'Reranking',
      description: 'Improves retrieved chunk order before context assembly.',
      status: 'insufficient',
      confidence: 0.62,
      primaryFiles: ['backend/open_webui/retrieval/retriever.py'],
      icon: 'Workflow',
    }),
    makeNode({
      id: 'chunk-return',
      label: 'Chunk Return',
      description: 'Returns selected chunks for prompt context construction.',
      primaryFiles: ['backend/open_webui/retrieval/retriever.py'],
      icon: 'FileCode2',
    }),
  ], [
    { id: 'query-similarity', source: 'query-embedding', target: 'similarity-search', kind: 'flow' },
    { id: 'similarity-rerank', source: 'similarity-search', target: 'reranking', kind: 'flow' },
    { id: 'rerank-return', source: 'reranking', target: 'chunk-return', kind: 'flow' },
  ], {
    ...makeNode({
      id: 'retrieval',
      label: 'Retrieval',
      description: 'Finds chunks that match the user question.',
      kind: 'concept',
      primaryFiles: ['backend/open_webui/retrieval/retriever.py'],
      icon: 'SearchCode',
      childrenCount: 4,
      canDrilldown: true,
      relatedLenses: ['Vector DB Config', 'How does a document affect the answer?'],
    }),
    position: { x: 0, y: 0 },
  }),
  'auth-users': makeLens('auth-users', [
    makeNode({ id: 'login-flow', label: 'Login Flow', description: 'Validates credentials and creates trusted session state.', kind: 'flow', icon: 'ShieldCheck' }),
    makeNode({ id: 'user-records', label: 'User Records', description: 'Stores account profile, role, and settings data.', icon: 'Database' }),
    makeNode({ id: 'roles-permissions', label: 'Roles & Permissions', description: 'Controls what users can access.', kind: 'cross_cutting', icon: 'ShieldCheck' }),
    makeNode({ id: 'external-auth', label: 'External Auth', description: 'OAuth or configured identity-provider boundaries.', kind: 'external_boundary', icon: 'Unplug', status: 'candidate' }),
  ]),
  'ai-providers': makeLens('ai-providers', [
    makeNode({ id: 'selected-model', label: 'Selected Model', description: 'Frontend/backend state that chooses the model.', icon: 'Lightbulb' }),
    makeNode({ id: 'provider-router', label: 'Provider Router', description: 'Decides which configured model backend receives a request.', kind: 'flow', icon: 'GitBranch' }),
    makeNode({ id: 'ollama', label: 'Ollama Boundary', description: 'Local Ollama-compatible provider integration.', kind: 'external_boundary', icon: 'Unplug' }),
    makeNode({ id: 'openai-compatible', label: 'OpenAI-Compatible APIs', description: 'Cloud or self-hosted OpenAI-compatible endpoint integration.', kind: 'external_boundary', icon: 'Unplug' }),
    makeNode({ id: 'streaming-response', label: 'Streaming Response', description: 'Normalizes provider output back to the chat interface.', kind: 'flow', icon: 'Workflow' }),
  ]),
};
