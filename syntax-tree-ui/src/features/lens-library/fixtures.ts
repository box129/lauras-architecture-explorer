import type { DocsStudioDraft, DocsStudioSection, LensTour, SavedLens } from './types';

const now = '2026-05-13T12:00:00.000Z';

export function fixtureSavedLenses(scopeKey = 'open-webui-fixture'): SavedLens[] {
  return [
    {
      id: 'fixture-lens-rag',
      title: 'RAG Pipeline Overview',
      type: 'architecture',
      summary: 'Shows ingestion, retrieval, vector storage, and prompt-building responsibilities.',
      status: 'insufficient',
      evidenceCount: 31,
      createdAt: now,
      urlState: '?node=rag-pipeline',
      sourceRefs: ['retrieval/retriever.py', 'generation/prompt_builder.py'],
      scopeKey,
    },
    {
      id: 'fixture-lens-upload-question',
      title: 'How uploaded documents affect answers',
      type: 'question',
      summary: 'Explains that uploaded documents are chunked, retrieved, and inserted into prompts.',
      status: 'verified',
      evidenceCount: 3,
      createdAt: now,
      urlState: '?question=rag-upload',
      sourceRefs: ['ingestion.py', 'retriever.py', 'prompt_builder.py'],
      scopeKey,
    },
    {
      id: 'fixture-lens-login-proof',
      title: 'Login source proof',
      type: 'proof',
      summary: 'Opens the login question lens with source-backed Code Companion proof.',
      status: 'verified',
      evidenceCount: 3,
      createdAt: now,
      urlState: '?question=login&proof=1',
      sourceRefs: ['api-client.ts', 'auth.py'],
      scopeKey,
    },
  ];
}

export function fixtureTour(scopeKey = 'open-webui-fixture'): LensTour {
  return {
    id: 'fixture-tour-onboarding',
    title: 'Open WebUI Onboarding Tour',
    description: 'A short guided path through architecture, RAG behavior, and proof-backed login code.',
    lensIds: fixtureSavedLenses(scopeKey).map((lens) => lens.id),
    createdAt: now,
    updatedAt: now,
    scopeKey,
  };
}

export function sectionMarkdown(section: DocsStudioSection, lenses: SavedLens[]) {
  const linked = lenses.filter((lens) => section.lensIds.includes(lens.id));
  const citations = linked.flatMap((lens) => lens.sourceRefs).slice(0, 4);
  const proofLine = citations.length
    ? `\n\nSources: ${citations.map((item) => `\`${item}\``).join(', ')}.`
    : '';
  const gapLine = section.evidenceStatus === 'verified'
    ? ''
    : '\n\nKnown gap: this section includes partial or inferred evidence and should be reviewed before sharing externally.';
  return `## ${section.title}\n\n${section.purpose}${proofLine}${gapLine}`;
}

export function makeDefaultSections(lenses: SavedLens[]): DocsStudioSection[] {
  const architecture = lenses.find((lens) => lens.type === 'architecture');
  const question = lenses.find((lens) => lens.type === 'question');
  const proof = lenses.find((lens) => lens.type === 'proof');
  const sections: DocsStudioSection[] = [
    {
      id: 'section-overview',
      title: 'Project Overview',
      lensIds: lenses.slice(0, 2).map((lens) => lens.id),
      purpose: 'Introduce the codebase through the saved architecture and question lenses, using source-backed language where available.',
      evidenceStatus: 'verified',
      draftMarkdown: '',
    },
    {
      id: 'section-architecture',
      title: 'High-Level Architecture',
      lensIds: architecture ? [architecture.id] : [],
      purpose: 'Explain the main system areas and where the strongest architecture evidence appears.',
      evidenceStatus: architecture?.status ?? 'candidate',
      draftMarkdown: '',
    },
    {
      id: 'section-flows',
      title: 'Key Flows',
      lensIds: question ? [question.id] : [],
      purpose: 'Describe how important user actions move through the system in plain English before showing technical details.',
      evidenceStatus: question?.status ?? 'candidate',
      draftMarkdown: '',
    },
    {
      id: 'section-proof',
      title: 'Important Source Proof',
      lensIds: proof ? [proof.id] : [],
      purpose: 'List the exact files and proof-backed spans that support the walkthrough.',
      evidenceStatus: proof?.status ?? 'candidate',
      draftMarkdown: '',
    },
    {
      id: 'section-gaps',
      title: 'Gaps And Uncertainties',
      lensIds: lenses.filter((lens) => lens.status !== 'verified').map((lens) => lens.id),
      purpose: 'Call out partial, inferred, unsupported, or stale areas honestly so readers know what still needs review.',
      evidenceStatus: 'insufficient',
      draftMarkdown: '',
    },
    {
      id: 'section-extension',
      title: 'How To Extend Safely',
      lensIds: lenses.map((lens) => lens.id),
      purpose: 'Summarize the safest next steps for modifying the system based on the saved lenses and source proof.',
      evidenceStatus: 'candidate',
      draftMarkdown: '',
    },
  ];
  return sections.map((section) => ({ ...section, draftMarkdown: sectionMarkdown(section, lenses) }));
}

export function makeFixtureDraft(scopeKey = 'open-webui-fixture'): DocsStudioDraft {
  const lenses = fixtureSavedLenses(scopeKey);
  const sections = makeDefaultSections(lenses);
  return {
    id: 'fixture-docs-draft',
    title: 'Open WebUI Architecture Onboarding',
    tourId: 'fixture-tour-onboarding',
    sectionIds: sections.map((section) => section.id),
    sections,
    markdown: sections.map((section) => section.draftMarkdown).join('\n\n'),
    createdAt: now,
    updatedAt: now,
    scopeKey,
  };
}
