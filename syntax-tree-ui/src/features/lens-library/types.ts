import type { ArchitectureMapStatus } from '../architecture-map/apiTypes';

export type SavedLensType = 'architecture' | 'flow' | 'question' | 'proof';

export interface SavedLens {
  id: string;
  title: string;
  type: SavedLensType;
  summary: string;
  status: ArchitectureMapStatus;
  evidenceCount: number;
  createdAt: string;
  urlState: string;
  sourceRefs: string[];
  scopeKey: string;
}

export interface LensTour {
  id: string;
  title: string;
  description: string;
  lensIds: string[];
  createdAt: string;
  updatedAt: string;
  scopeKey: string;
}

export interface DocsStudioSection {
  id: string;
  title: string;
  lensIds: string[];
  purpose: string;
  evidenceStatus: ArchitectureMapStatus;
  draftMarkdown: string;
}

export interface DocsStudioDraft {
  id: string;
  title: string;
  tourId: string | null;
  sectionIds: string[];
  sections: DocsStudioSection[];
  markdown: string;
  createdAt: string;
  updatedAt: string;
  scopeKey: string;
}
