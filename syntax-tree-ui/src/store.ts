import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisProgress, RunMetadata } from './api/types';

export type MainSurface = 'architecture' | 'code' | 'docs' | 'dashboard';
export type SidePanel = 'inspector' | 'query' | 'none';
export type ViewType = 'architecture' | 'layered' | 'dependency' | 'call-flow' | 'data-flow' | 'hierarchy-v2';
export type HeatmapMode = 'none' | 'coupling' | 'complexity' | 'impact' | 'documentation';

export interface ImpactRippleState {
  startQN: string;
  nodes: { qn: string; depth: number }[];
}

interface OpenFile {
  path: string;
  label: string;
}

export interface SyntaxTreeState {
  // Analysis
  analysisStatus: 'idle' | 'running' | 'completed' | 'failed';
  analysisJobId: string | null;
  analysisRunId: string | null;
  analysisRepositoryPath: string | null;
  analysisProgress: AnalysisProgress | null;
  analysisError: string | null;
  analysisRunMetadata: RunMetadata | null;

  // Navigation
  mainSurface: MainSurface;
  sidePanel: SidePanel;

  // Selection
  selectedQN: string | null;
  highlightedQNs: string[];

  // Code viewer
  openFilePath: string | null;
  openFileLine: number | null;
  /** End line of the target span, when navigation cites a multi-line
   * range (e.g. an evidence-chain "Open source"). Equal to openFileLine
   * for a single-line target. See MonacoWrapper's persistent highlight. */
  openFileLineEnd: number | null;
  openFiles: OpenFile[];

  // Architecture
  viewType: ViewType;
  expandedSubsystems: string[];
  heatmapMode: HeatmapMode;
  heartbeatOn: boolean;
  impactRipple: ImpactRippleState | null;
  narratorActive: boolean;
  narratorStep: number;

  // Architecture scope (for dependency / call-flow views)
  scopeQN: string | null;

  // Query
  conversationId: string | null;

  // Context menu
  contextMenu: { x: number; y: number; qn: string } | null;

  // Settings
  settingsOpen: boolean;

  // Actions
  selectNode: (qn: string | null) => void;
  goToCode: (filePath: string, line: number, endLine?: number) => void;
  goToArchNode: (qn: string) => void;
  goToDoc: (sectionQN: string) => void;
  setMainSurface: (surface: MainSurface) => void;
  setSidePanel: (panel: SidePanel) => void;
  setViewType: (vt: ViewType) => void;
  toggleSubsystem: (qn: string) => void;
  setHeatmap: (mode: HeatmapMode) => void;
  setHeartbeat: (on: boolean) => void;
  startImpactRipple: (startQN: string, nodes: { qn: string; depth: number }[]) => void;
  clearImpactRipple: () => void;
  startNarrator: () => void;
  stopNarrator: () => void;
  advanceNarrator: () => void;
  retreatNarrator: () => void;
  setAnalysisStatus: (status: 'idle' | 'running' | 'completed' | 'failed') => void;
  setAnalysisJobId: (jobId: string | null) => void;
  setAnalysisRunId: (runId: string | null) => void;
  setAnalysisRepositoryPath: (repositoryPath: string | null) => void;
  setAnalysisProgress: (progress: AnalysisProgress | null) => void;
  setAnalysisError: (error: string | null) => void;
  setAnalysisRunMetadata: (meta: RunMetadata | null) => void;
  resetAnalysis: () => void;
  setScopeQN: (qn: string | null) => void;
  setConversationId: (id: string | null) => void;
  closeFile: (path: string) => void;
  setContextMenu: (menu: { x: number; y: number; qn: string } | null) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSyntaxTreeStore = create<SyntaxTreeState>()(persist((set, get) => ({
  // Initial state
  analysisStatus: 'idle',
  analysisJobId: null,
  analysisRunId: null,
  analysisRepositoryPath: null,
  analysisProgress: null,
  analysisError: null,
  analysisRunMetadata: null,
  mainSurface: 'dashboard',
  sidePanel: 'inspector',
  selectedQN: null,
  highlightedQNs: [],
  openFilePath: null,
  openFileLine: null,
  openFileLineEnd: null,
  openFiles: [],
  viewType: 'architecture',
  expandedSubsystems: [],
  heatmapMode: 'none',
  heartbeatOn: false,
  impactRipple: null,
  narratorActive: false,
  narratorStep: 0,
  scopeQN: null,
  conversationId: null,
  contextMenu: null,
  settingsOpen: false,

  // Actions
  selectNode: (qn) =>
    set({ selectedQN: qn, sidePanel: qn ? 'inspector' : get().sidePanel }),

  goToCode: (filePath, line, endLine) => {
    const { openFiles } = get();
    const label = filePath.split('/').pop() || filePath;
    const alreadyOpen = openFiles.some((f) => f.path === filePath);
    const updatedFiles = alreadyOpen
      ? openFiles
      : [...openFiles.slice(-(7)), { path: filePath, label }]; // max 8 tabs
    set({
      mainSurface: 'code',
      openFilePath: filePath,
      openFileLine: line,
      openFileLineEnd: endLine != null && endLine >= line ? endLine : line,
      openFiles: updatedFiles,
    });
  },

  goToArchNode: (qn) =>
    set({
      mainSurface: 'architecture',
      selectedQN: qn,
      highlightedQNs: [qn],
    }),

  goToDoc: (sectionQN) =>
    set({ mainSurface: 'docs', selectedQN: sectionQN }),

  setMainSurface: (surface) => set({ mainSurface: surface }),
  setSidePanel: (panel) => set({ sidePanel: panel }),

  setViewType: (vt) => set({ viewType: vt }),

  toggleSubsystem: (qn) => {
    const { expandedSubsystems } = get();
    set({
      expandedSubsystems: expandedSubsystems.includes(qn)
        ? expandedSubsystems.filter((s) => s !== qn)
        : [...expandedSubsystems, qn],
    });
  },

  setHeatmap: (mode) => set({ heatmapMode: mode }),
  setHeartbeat: (on) => set({ heartbeatOn: on }),

  startImpactRipple: (startQN, nodes) =>
    set({ impactRipple: { startQN, nodes }, mainSurface: 'architecture' }),

  clearImpactRipple: () => set({ impactRipple: null }),

  startNarrator: () =>
    set({ narratorActive: true, narratorStep: 0, mainSurface: 'architecture' }),

  stopNarrator: () => set({ narratorActive: false, narratorStep: 0 }),

  advanceNarrator: () =>
    set((s) => ({ narratorStep: s.narratorStep + 1 })),

  retreatNarrator: () =>
    set((s) => ({ narratorStep: Math.max(0, s.narratorStep - 1) })),

  setAnalysisStatus: (status) => set({ analysisStatus: status }),
  setAnalysisJobId: (jobId) => set({ analysisJobId: jobId }),
  setAnalysisRunId: (runId) => set({ analysisRunId: runId }),
  setAnalysisRepositoryPath: (repositoryPath) => set({ analysisRepositoryPath: repositoryPath }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setAnalysisError: (error) => set({ analysisError: error }),
  setAnalysisRunMetadata: (meta) => set((state) => ({
    analysisRunMetadata: meta,
    analysisRunId: meta?.analysis_run_id ?? state.analysisRunId,
    analysisRepositoryPath: meta?.repository_path ?? state.analysisRepositoryPath,
  })),
  resetAnalysis: () =>
    set({
      analysisStatus: 'idle',
      analysisJobId: null,
      analysisRunId: null,
      analysisRepositoryPath: null,
      analysisProgress: null,
      analysisError: null,
      analysisRunMetadata: null,
      conversationId: null,
      selectedQN: null,
      highlightedQNs: [],
      openFiles: [],
      openFilePath: null,
      openFileLine: null,
      mainSurface: 'dashboard',
      expandedSubsystems: [],
      scopeQN: null,
      contextMenu: null,
    }),

  setScopeQN: (qn) => set({ scopeQN: qn }),
  setConversationId: (id) => set({ conversationId: id }),

  closeFile: (path) => {
    const { openFiles, openFilePath } = get();
    const filtered = openFiles.filter((f) => f.path !== path);
    const newPath = openFilePath === path
      ? (filtered.length > 0 ? filtered[filtered.length - 1].path : null)
      : openFilePath;
    set({ openFiles: filtered, openFilePath: newPath });
  },

  setContextMenu: (menu) => set({ contextMenu: menu }),

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}), {
  name: 'syntax-tree.analysis-session.v1',
  partialize: (state) => ({
    analysisStatus: state.analysisStatus,
    analysisJobId: state.analysisJobId,
    analysisRunId: state.analysisRunId,
    analysisRepositoryPath: state.analysisRepositoryPath,
    analysisRunMetadata: state.analysisRunMetadata,
  }),
}));
