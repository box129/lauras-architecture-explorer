import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ArchitectureMapCanvas from '../architecture-map/ArchitectureMapCanvas';
import ArchitectureGraphOverview from '../architecture-graph/ArchitectureGraphOverview';
import ArchitectureGraphInspector from '../architecture-graph/ArchitectureGraphInspector';
import {
  ArchitectureMapEmptyState,
  ArchitectureMapErrorState,
  ArchitectureMapSkeleton,
} from '../architecture-map/ArchitectureMapStates';
import { useArchitectureLens, type ArchitectureLensPreviewState } from '../architecture-map/useArchitectureLens';
import { useNodeExplanation } from '../architecture-map/useNodeExplanation';
import type { CodeCompanionSelection } from '../architecture-map/apiTypes';
import { clearArchitectureLensCache } from '../architecture-map/lensCache';
import CodeCompanion from '../code-companion/CodeCompanion';
import { decodeProofSelection, setProofUrlState } from '../code-companion/proofUrlState';
import FlowLensCanvas from '../flows/FlowLensCanvas';
import FlowVoiceRail from '../flows/FlowVoiceRail';
import { useFlowLens } from '../flows/useFlowLens';
import DocsStudio from '../docs-studio/DocsStudio';
import SavedLensDrawer from '../lens-library/SavedLensDrawer';
import TourOverlay from '../lens-library/TourOverlay';
import { fixtureSavedLenses, fixtureTour } from '../lens-library/fixtures';
import { createId, useLensLibrary } from '../lens-library/storage';
import type { LensTour, SavedLens, SavedLensType } from '../lens-library/types';
import QuestionLensCanvas from '../question-lens/QuestionLensCanvas';
import UnderstandingPane from '../question-lens/UnderstandingPane';
import { questionLensProofSelection, questionStepProofSelection } from '../question-lens/questionLensProof';
import { useQuestionLens } from '../question-lens/useQuestionLens';
import ObservatoryTopBar from './ObservatoryTopBar';
import type { BreadcrumbItem } from './BreadcrumbTrail';
import QuestionDock from './QuestionDock';
import VoiceRail from './VoiceRail';
import { getFixtureExplanation } from './fixtures/openWebuiExplanations';
import { useSyntaxTreeStore } from '../../store';

const CodeViewer = lazy(() => import('../../components/code/CodeViewer'));

function readSearchParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function ObservatoryShell() {
  const searchParams = readSearchParams();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isPreview = pathname.startsWith('/__observatory-preview');
  const isDocsStudio = pathname === '/__observatory-preview/docs' || pathname === '/docs';
  const source = searchParams.get('source') === 'api' || !isPreview ? 'api' : 'fixture';
  const rawPreviewState = searchParams.get('state') ?? 'normal';
  const previewState = rawPreviewState as ArchitectureLensPreviewState;
  const focusShortcut = searchParams.get('focus');
  const initialFlowId = searchParams.get('flow');
  const initialStepId = searchParams.get('step');
  const previewQuestion = searchParams.get('question');
  const initialQuestionLensId = searchParams.get('qlens');
  const initialQuestionStepId = searchParams.get('qstep');
  const analysisRunId = useSyntaxTreeStore((state) => state.analysisRunId);
  const analysisRepositoryPath = useSyntaxTreeStore((state) => state.analysisRepositoryPath);
  const resetAnalysis = useSyntaxTreeStore((state) => state.resetAnalysis);
  // "Open source" (EvidenceItemRow.tsx) reuses the existing exact
  // path/line source-viewing mechanism (goToCode -> mainSurface: 'code' ->
  // CodeViewer/MonacoWrapper's targetLine) that already exists for the
  // legacy /legacy workspace, rather than introducing a second
  // source-location model. Observatory itself never previously rendered
  // CodeViewer for any mainSurface value, so without this the button
  // silently updated store state with no visible effect -- a real gap
  // between the SourceRegion-precision (exact file/line) evidence model
  // and Observatory's own node-implementation-slice-scoped CodeCompanion.
  // This overlay is scoped to mainSurface === 'code' only; Observatory's
  // own navigation (lensPath/selectedNodeId) is untouched by it.
  const mainSurface = useSyntaxTreeStore((state) => state.mainSurface);
  const setMainSurface = useSyntaxTreeStore((state) => state.setMainSurface);
  const scopeKey = source === 'fixture'
    ? 'open-webui-fixture'
    : `${analysisRunId ?? searchParams.get('run') ?? 'active-run'}:${analysisRepositoryPath ?? searchParams.get('repo') ?? 'repo'}`;
  const library = useLensLibrary(scopeKey);
  const useFixtureLibrary = source === 'fixture' && library.lenses.length === 0 && rawPreviewState !== 'drawer-empty';
  const savedLenses = useMemo(
    () => useFixtureLibrary ? fixtureSavedLenses(scopeKey) : library.lenses,
    [library.lenses, scopeKey, useFixtureLibrary],
  );
  const savedTours = useMemo(
    () => useFixtureLibrary ? [fixtureTour(scopeKey)] : library.tours,
    [library.tours, scopeKey, useFixtureLibrary],
  );
  const [drawerOpen, setDrawerOpen] = useState(() => searchParams.get('drawer') === 'lenses' || rawPreviewState === 'drawer-empty' || rawPreviewState === 'saved-lenses' || rawPreviewState === 'tour-builder');
  const [activeTourId, setActiveTourId] = useState<string | null>(() => searchParams.get('tour'));
  const [tourStep, setTourStep] = useState(() => Number(searchParams.get('tourStep') ?? 0) || 0);
  const activeTour = (activeTourId ? savedTours.find((tour) => tour.id === activeTourId) : savedTours[0]) ?? null;
  const tourPlaying = Boolean(searchParams.get('tour'));
  const lens = useArchitectureLens({ source, previewState, focusShortcut, runId: analysisRunId });
  const flowLens = useFlowLens({ source, previewState, initialFlowId, initialStepId });
  const questionLens = useQuestionLens({
    source,
    previewState: rawPreviewState,
    previewQuestion,
    initialLensId: initialQuestionLensId,
    initialStepId: initialQuestionStepId,
    runId: analysisRunId,
  });
  const [draftPrompt, setDraftPrompt] = useState('');
  const [requestedGraphExpansion, setRequestedGraphExpansion] = useState<string | null>(null);
  const [proofSelection, setProofSelection] = useState<CodeCompanionSelection | null>(() => decodeProofSelection(searchParams.get('proof')));
  const [proofMode, setProofMode] = useState<'closed' | 'collapsed' | 'open' | 'expanded'>(() => {
    const mode = searchParams.get('proofMode');
    if (mode === 'collapsed' || mode === 'expanded') return mode;
    return searchParams.get('proof') ? 'open' : 'closed';
  });
  const explanationNode = lens.selectedNode ?? lens.focalNode;
  const fixtureExplanation = useMemo(
    () => source === 'fixture' ? getFixtureExplanation(explanationNode, previewState) : { explanation: null, evidence: [] },
    [explanationNode, previewState, source],
  );
  const explanationState = useNodeExplanation(
    explanationNode?.id ?? null,
    source === 'api',
    fixtureExplanation.explanation,
    fixtureExplanation.evidence,
  );

  useEffect(() => {
    document.documentElement.classList.add('observatory-active');
    return () => document.documentElement.classList.remove('observatory-active');
  }, []);

  useEffect(() => {
    clearArchitectureLensCache();
  }, [analysisRunId]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason && !(reason instanceof Error) && typeof reason === 'object') {
        event.preventDefault();
        console.warn('Observed non-error async rejection in Observatory UI', reason);
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (proofMode === 'expanded') {
        setProofMode('open');
        return;
      }
      if (proofMode === 'open') {
        setProofMode('collapsed');
        return;
      }
      if (flowLens.selectedStepId) {
        flowLens.selectStep(null);
        return;
      }
      if (flowLens.isFlowMode) {
        flowLens.closeFlow();
        return;
      }
      if (questionLens.selectedStepId) {
        questionLens.selectStep(null);
        return;
      }
      if (questionLens.isQuestionMode) {
        questionLens.close();
        return;
      }
      lens.goBack();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '.') {
      event.preventDefault();
      setProofMode((current) => current === 'closed' ? 'open' : current === 'collapsed' ? 'open' : 'collapsed');
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      setDrawerOpen((current) => !current);
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      document.querySelector<HTMLTextAreaElement>('.obs-question-dock__input')?.focus();
    }
  }, [flowLens, lens, proofMode, questionLens]);

  useEffect(() => {
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const shellMeta = lens.rootMeta;
  const normalizedProofSelection = useMemo(() => {
    if (proofSelection?.subject_type && proofSelection.subject_id) return proofSelection;
    if (proofSelection?.open && questionLens.activeLens && questionLens.selectedStep) {
      return questionStepProofSelection(questionLens.activeLens, questionLens.selectedStep);
    }
    if (proofSelection?.open && questionLens.activeLens) {
      return {
        ...questionLensProofSelection(questionLens.activeLens),
        evidence_id: proofSelection.evidence_id,
        span_id: proofSelection.span_id,
        file_path: proofSelection.file_path,
        start_line: proofSelection.start_line,
      };
    }
    if (proofSelection?.open && flowLens.activeFlow && flowLens.selectedStep) {
      return {
        subject_type: 'flow_step',
        subject_id: flowLens.selectedStep.id,
        title: `${flowLens.activeFlow.flow.name}: ${flowLens.selectedStep.description || flowLens.selectedStep.step_type}`,
        file_path: flowLens.selectedStep.source_span.file_path,
        span_id: flowLens.selectedStep.source_span.id,
        start_line: flowLens.selectedStep.source_span.start_line,
        reason: flowLens.selectedStep.gap_reason || flowLens.selectedStep.description,
        open: true,
      };
    }
    if (proofSelection?.open && flowLens.activeFlow) {
      return {
        subject_type: 'flow',
        subject_id: flowLens.activeFlow.flow.id,
        title: flowLens.activeFlow.flow.name,
        evidence_id: proofSelection.evidence_id,
        span_id: proofSelection.span_id,
        file_path: proofSelection.file_path,
        start_line: proofSelection.start_line,
        open: true,
      };
    }
    if (proofSelection?.open && explanationNode) {
      return {
        subject_type: 'architecture_node',
        subject_id: explanationNode.id,
        title: explanationNode.label,
        evidence_id: proofSelection.evidence_id,
        span_id: proofSelection.span_id,
        file_path: proofSelection.file_path,
        start_line: proofSelection.start_line,
        open: true,
      };
    }
    return proofSelection;
  }, [explanationNode, flowLens.activeFlow, flowLens.selectedStep, proofSelection, questionLens.activeLens, questionLens.selectedStep]);
  const askAboutNode = useCallback((node: { label: string }) => {
    setDraftPrompt(`Explain ${node.label} in this codebase using source evidence.`);
  }, []);
  const copyNodeLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    void navigator.clipboard?.writeText(window.location.href);
  }, []);
  const openProof = useCallback((selection: CodeCompanionSelection) => {
    setProofSelection(selection);
    setProofMode('open');
    setProofUrlState(selection);
  }, []);
  const setProofModeAndUrl = useCallback((mode: 'closed' | 'collapsed' | 'open' | 'expanded') => {
    setProofMode(mode);
    if (mode === 'closed') setProofUrlState(null);
  }, []);

  // Reconcile proof (Evidence) state when the user presses the browser's own
  // Back/Forward -- setProofUrlState now pushes a history entry when
  // evidence opens/closes, so a popstate here means the browser navigated
  // across that boundary and local state must follow the URL it landed on.
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const decoded = decodeProofSelection(params.get('proof'));
      setProofSelection(decoded);
      setProofMode((current) => {
        if (!decoded) return 'closed';
        return current === 'closed' ? 'open' : current;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // One Back, not four: whichever surface the user is looking at, Back pops
  // exactly one level of Evidence -> Entity -> Group -> Overview, in that
  // order, regardless of which control triggered it (topbar, entity panel,
  // or breadcrumb keyboard activation).
  const unifiedBack = useCallback(() => {
    if (proofSelection && proofMode !== 'closed') {
      setProofModeAndUrl('closed');
      return;
    }
    lens.goBack();
  }, [lens, proofMode, proofSelection, setProofModeAndUrl]);
  const canGoBack = (Boolean(proofSelection) && proofMode !== 'closed') || Boolean(lens.selectedNode) || lens.lensPath.length > 0;

  const unifiedBreadcrumb = useMemo(() => {
    const items: BreadcrumbItem[] = [...lens.breadcrumbs];
    if (lens.selectedNode && lens.selectedNode.id !== lens.focalNode?.id) {
      items.push({ id: lens.selectedNode.id, label: truncateBreadcrumbLabel(lens.selectedNode.label), title: lens.selectedNode.label });
    }
    if (proofSelection && proofMode !== 'closed') {
      // A bare `title` here is usually just the parent entity's own label
      // (e.g. VoiceRail's "View source proof" sets title: node.label) --
      // reusing it verbatim would duplicate the Entity crumb directly
      // above. Prefer a file:line locator or the evidence's own reason
      // text, which actually identifies *this* evidence item distinctly.
      const fileLocator = proofSelection.file_path
        ? `${proofSelection.file_path.split('/').pop()}${proofSelection.start_line ? `:${proofSelection.start_line}` : ''}`
        : null;
      const statementLabel = fileLocator || proofSelection.reason || proofSelection.title || 'Evidence';
      items.push({ id: 'evidence', label: truncateBreadcrumbLabel(statementLabel), title: statementLabel });
    }
    return items;
  }, [lens.breadcrumbs, lens.focalNode, lens.selectedNode, proofMode, proofSelection]);

  const handleBreadcrumbSelect = useCallback((index: number) => {
    const lensCrumbCount = lens.breadcrumbs.length;
    if (index < lensCrumbCount) {
      lens.goToBreadcrumb(index);
      setProofModeAndUrl('closed');
      return;
    }
    // Entity crumb (only remaining clickable case -- the last crumb is
    // always the current, non-interactive state and BreadcrumbTrail never
    // wires onSelect for it).
    setProofModeAndUrl('closed');
  }, [lens, setProofModeAndUrl]);

  const analyzeAnotherRepository = useCallback(() => {
    resetAnalysis();
    window.history.replaceState({}, '', '/');
  }, [resetAnalysis]);

  const selectNode = (node: Parameters<typeof lens.selectNode>[0]) => {
    lens.selectNode(node);
    if (node?.level && node.level >= 2 && node.evidenceCount > 0) {
      openProof({
        subject_type: 'architecture_node',
        subject_id: node.id,
        title: node.label,
        open: true,
      });
    }
  };

  const relatedFlows = useMemo(() => {
    const ids = new Set((lens.selectedNode ?? lens.focalNode)?.relatedFlowIds ?? []);
    return flowLens.flows.filter((flow) => ids.has(flow.id));
  }, [flowLens.flows, lens.focalNode, lens.selectedNode]);

  const showFlowLens = flowLens.isFlowMode || rawPreviewState === 'no-flows';
  const showQuestionLens = !showFlowLens && questionLens.isQuestionMode;

  const currentSavedLens = () => buildCurrentSavedLens({
    scopeKey,
    showQuestionLens,
    showFlowLens,
    proofMode,
    node: lens.selectedNode ?? lens.focalNode,
    questionTitle: questionLens.activeLens?.title,
    questionSummary: questionLens.activeLens?.simple_explanation ?? questionLens.response?.answer_text,
    questionStatus: questionLens.activeLens?.status,
    questionEvidence: questionLens.activeLens?.evidence.length ?? 0,
    flowTitle: flowLens.activeFlow?.flow.name,
    flowSummary: flowLens.activeFlow?.flow.simple_explanation,
    flowStatus: flowLens.activeFlow?.flow.status,
    flowEvidence: flowLens.activeFlow?.flow.step_count ?? 0,
    proofSelection: normalizedProofSelection,
  });

  const saveCurrentLens = useCallback(() => {
    library.saveLens(currentSavedLens());
    setDrawerOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.saveLens, scopeKey, showQuestionLens, showFlowLens, proofMode, lens.selectedNode, lens.focalNode, questionLens.activeLens, questionLens.response, flowLens.activeFlow, normalizedProofSelection]);

  const restoreLens = useCallback((savedLens: SavedLens) => {
    restoreSavedLens(savedLens, undefined, undefined, source, analysisRunId, analysisRepositoryPath);
  }, [analysisRepositoryPath, analysisRunId, source]);

  const createTour = useCallback(() => {
    const tour: LensTour = {
      id: createId('tour'),
      title: 'Architecture Walkthrough',
      description: 'A guided path through saved architecture, question, and proof lenses.',
      lensIds: savedLenses.slice(0, 5).map((item) => item.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scopeKey,
    };
    library.saveTour(tour);
    setActiveTourId(tour.id);
  }, [library, savedLenses, scopeKey]);

  const addToTour = useCallback((lensId: string) => {
    const tour = activeTour ?? {
      id: createId('tour'),
      title: 'Architecture Walkthrough',
      description: 'A guided path through saved architecture, question, and proof lenses.',
      lensIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scopeKey,
    };
    const nextTour = { ...tour, lensIds: tour.lensIds.includes(lensId) ? tour.lensIds : [...tour.lensIds, lensId] };
    if (activeTour) library.updateTour(nextTour);
    else library.saveTour(nextTour);
    setActiveTourId(nextTour.id);
  }, [activeTour, library, scopeKey]);

  const moveTourLens = useCallback((lensId: string, direction: -1 | 1) => {
    if (!activeTour) return;
    const index = activeTour.lensIds.indexOf(lensId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeTour.lensIds.length) return;
    const nextIds = [...activeTour.lensIds];
    [nextIds[index], nextIds[target]] = [nextIds[target], nextIds[index]];
    library.updateTour({ ...activeTour, lensIds: nextIds });
  }, [activeTour, library]);

  const playTour = useCallback((step = 0) => {
    const tour = activeTour ?? savedTours[0];
    const savedLens = tour ? savedLenses.find((item) => item.id === tour.lensIds[step]) : null;
    if (!tour || !savedLens) return;
    setActiveTourId(tour.id);
    setTourStep(step);
    restoreSavedLens(savedLens, tour.id, step, source, analysisRunId, analysisRepositoryPath);
  }, [activeTour, analysisRepositoryPath, analysisRunId, savedLenses, savedTours, source]);

  const nextTour = useCallback(() => {
    if (!activeTour) return;
    playTour(Math.min(tourStep + 1, activeTour.lensIds.length - 1));
  }, [activeTour, playTour, tourStep]);

  const previousTour = useCallback(() => {
    playTour(Math.max(tourStep - 1, 0));
  }, [playTour, tourStep]);

  const canvasFixture = lens.isEntityFocus ? (lens.entityFocusLandscape ?? lens.landscape) : lens.landscape;
  const isRootArchitectureGraph = Boolean(canvasFixture && source === 'api' && lens.lensPath.length === 0 && !lens.isEntityFocus && !showQuestionLens && !showFlowLens);

  let canvas = showQuestionLens ? (
    <QuestionLensCanvas
      error={questionLens.error}
      lens={questionLens.activeLens}
      loading={questionLens.loading || questionLens.restoring}
      onBackToArchitecture={questionLens.close}
      onOpenProof={openProof}
      onSelectStep={questionLens.selectStep}
      question={questionLens.question || draftPrompt}
      selectedStepId={questionLens.selectedStepId}
    />
  ) : showFlowLens ? (
    <FlowLensCanvas
      error={flowLens.error}
      flowDetail={flowLens.activeFlow}
      hasFlows={flowLens.flows.length > 0}
      loading={flowLens.loading || flowLens.detailLoading}
      onBackToArchitecture={flowLens.closeFlow}
      onOpenProof={openProof}
      onSelectStep={flowLens.selectStep}
      selectedStepId={flowLens.selectedStepId}
    />
  ) : isRootArchitectureGraph ? (
    <ArchitectureGraphOverview
      runId={analysisRunId}
      selectedNode={lens.selectedNode}
      onEnterNode={lens.enterNode}
      onHoverNode={lens.prefetchNode}
      onSelectNode={selectNode}
      requestedExpandId={requestedGraphExpansion}
    />
  ) : (canvasFixture) ? (
    <ArchitectureMapCanvas
      fixture={canvasFixture}
      focalNode={lens.isEntityFocus ? lens.selectedNode : lens.focalNode}
      onEnterNode={lens.enterNode}
      onHoverNode={lens.prefetchNode}
      onSelectNode={selectNode}
      selectedNode={lens.selectedNode}
    />
  ) : null;

  if (!showFlowLens && !showQuestionLens && lens.loading) {
    canvas = <ArchitectureMapSkeleton />;
  } else if (!showFlowLens && !showQuestionLens && previewState === 'error') {
    canvas = (
      <ArchitectureMapErrorState
        title="Architecture map unavailable"
        message="The preview is showing the designed API failure state. Real API mode will use this surface for network and backend errors."
      />
    );
  } else if (!showFlowLens && !showQuestionLens && lens.error?.kind === 'no-active-run') {
    canvas = (
      <ArchitectureMapEmptyState
        title="No active analysis run"
        message={lens.error.message}
      />
    );
  } else if (!showFlowLens && !showQuestionLens && lens.error?.kind === 'stale-lens') {
    canvas = (
      <ArchitectureMapErrorState
        title="Architecture lens is stale"
        message="This saved lens path no longer resolves against the active architecture map. Return to the root map and choose a current area."
        actionLabel="Return to root"
        onRetry={lens.clearLens}
      />
    );
  } else if (!showFlowLens && !showQuestionLens && lens.error) {
    canvas = (
      <ArchitectureMapErrorState
        title="Architecture map request failed"
        message={lens.error.message}
        onRetry={lens.retry}
      />
    );
  }

  if (isDocsStudio) {
    return (
      <DocsStudio
        drafts={library.drafts}
        lenses={savedLenses}
        onBack={() => navigateToObservatory(source, analysisRunId, analysisRepositoryPath)}
        onOpenLens={(savedLens) => restoreSavedLens(savedLens, undefined, undefined, source, analysisRunId, analysisRepositoryPath)}
        onSaveDraft={library.saveDraft}
        scopeKey={scopeKey}
        source={source}
        tours={savedTours}
      />
    );
  }

  return (
    <div className="observatory-shell">
      <ObservatoryTopBar
        breadcrumb={unifiedBreadcrumb}
        canGoBack={canGoBack}
        freshness={shellMeta.freshness}
        lastScanned={shellMeta.lastScanned}
        onBack={unifiedBack}
        onBreadcrumbSelect={handleBreadcrumbSelect}
        onOpenDocs={() => navigateToDocs(source, analysisRunId, analysisRepositoryPath)}
        onAnalyzeAnotherRepository={analyzeAnotherRepository}
        repoTitle={shellMeta.repoTitle}
        runId={shellMeta.runId}
      />
      <div className={showQuestionLens ? 'observatory-shell__body observatory-shell__body--question' : 'observatory-shell__body'}>
        <div className="observatory-shell__main">
          {canvas}
          <CodeCompanion
            mode={proofMode}
            onModeChange={setProofModeAndUrl}
            onSelect={openProof}
            onSaveLens={saveCurrentLens}
            previewState={previewState}
            selection={normalizedProofSelection}
            source={source}
          />
          {!showFlowLens && (
            <QuestionDock
              compact={isRootArchitectureGraph}
              contextLabel={lens.selectedNode?.label ?? lens.focalNode?.label ?? shellMeta.repoTitle}
              draftPrompt={draftPrompt}
              loading={questionLens.loading}
              onDraftChange={setDraftPrompt}
              onSubmit={(value) => {
                setDraftPrompt(value);
                void questionLens.submit(value);
              }}
              suggestions={lens.selectedNode?.relatedLenses ?? lens.focalNode?.relatedLenses ?? shellMeta.promptSuggestions}
            />
          )}
        </div>
        {showQuestionLens ? (
          <UnderstandingPane
            error={questionLens.error}
            lens={questionLens.activeLens}
            lenses={questionLens.rankedLenses}
            loading={questionLens.loading || questionLens.restoring}
            onBackToArchitecture={questionLens.close}
            onClose={questionLens.close}
            onOpenProof={openProof}
            onSelectStep={questionLens.selectStep}
            onSelectLens={questionLens.setActiveLens}
            question={questionLens.question || draftPrompt}
            response={questionLens.response}
            selectedStep={questionLens.selectedStep}
            onSaveLens={saveCurrentLens}
          />
        ) : showFlowLens ? (
          <FlowVoiceRail
            flowDetail={flowLens.activeFlow}
            onBackToArchitecture={flowLens.closeFlow}
            onClose={flowLens.closeFlow}
            onOpenProof={openProof}
            onSaveLens={saveCurrentLens}
            selectedStep={flowLens.selectedStep}
          />
        ) : isRootArchitectureGraph ? (
          <ArchitectureGraphInspector
            node={lens.selectedNode}
            onEnter={lens.enterNode}
            onExpand={(node) => setRequestedGraphExpansion(node.id)}
          />
        ) : (
          <VoiceRail
            focalNode={lens.focalNode}
            node={lens.selectedNode}
            evidence={explanationState.evidence}
            explanation={explanationState.explanation}
            explanationError={explanationState.error}
            explanationLoading={explanationState.loading}
            activeEvidenceId={normalizedProofSelection?.evidence_id}
            onAskAboutNode={askAboutNode}
            onBackToParent={unifiedBack}
            onClose={() => selectNode(null)}
            onCopyLink={copyNodeLink}
            onOpenFlow={(flowId) => flowLens.openFlow(flowId)}
            onOpenProof={openProof}
            onSaveLens={saveCurrentLens}
            onZoomInto={(node) => lens.enterNode(node)}
            relatedFlows={relatedFlows}
          />
        )}
      </div>
      <SavedLensDrawer
        activeTour={activeTour}
        lenses={savedLenses}
        onAddToTour={addToTour}
        onClose={() => setDrawerOpen(false)}
        onCreateTour={createTour}
        onDeleteLens={library.deleteLens}
        onDuplicateLens={library.duplicateLens}
        onMoveTourLens={moveTourLens}
        onOpen={() => setDrawerOpen(true)}
        onOpenDocs={() => navigateToDocs(source, analysisRunId, analysisRepositoryPath)}
        onPlayTour={() => playTour(0)}
        onRenameLens={library.renameLens}
        onRestoreLens={restoreLens}
        onSaveCurrent={saveCurrentLens}
        open={drawerOpen}
      />
      <TourOverlay
        lenses={savedLenses}
        onExit={() => setActiveTourId(null)}
        onNext={nextTour}
        onPrevious={previousTour}
        stepIndex={tourStep}
        tour={tourPlaying ? activeTour : null}
      />
      {mainSurface === 'code' && (
        <div className="obs-code-overlay" role="dialog" aria-label="Source code">
          <div className="obs-code-overlay__panel">
            {/* Participant 1 formative finding: this used to be a top-right
                "Close" button -- a different position, wording, and style
                from the top-left Back arrow the participant relied on and
                got frustrated without elsewhere in the map/entity flow.
                Matching that same learned pattern here instead of
                introducing a second navigation paradigm. Also fixes a
                latent bug: this previously set mainSurface to 'dashboard'
                (a legacy-workspace-only surface Observatory never renders),
                not 'architecture' -- harmless today only because Observatory
                ignores that value, but wrong regardless. */}
            <button
              type="button"
              className="obs-code-overlay__back"
              aria-label="Back to architecture map"
              onClick={() => setMainSurface('architecture')}
            >
              <ArrowLeft size={15} strokeWidth={1.8} /> Back
            </button>
            <Suspense fallback={<div className="obs-code-overlay__loading">Loading source...</div>}>
              <CodeViewer />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}

function truncateBreadcrumbLabel(label: string, maxLength = 40): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function routeWithAnalysisContext(path: string, runId: string | null, repositoryPath: string | null): string {
  const params = new URLSearchParams();
  if (runId) params.set('run', runId);
  if (repositoryPath) params.set('repo', repositoryPath);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function navigateToObservatory(source: 'api' | 'fixture', runId: string | null, repositoryPath: string | null) {
  window.location.assign(source === 'fixture' ? '/__observatory-preview' : routeWithAnalysisContext('/', runId, repositoryPath));
}

function navigateToDocs(source: 'api' | 'fixture', runId: string | null, repositoryPath: string | null) {
  window.location.assign(source === 'fixture' ? '/__observatory-preview/docs' : routeWithAnalysisContext('/docs', runId, repositoryPath));
}

function restoreSavedLens(
  savedLens: SavedLens,
  tourId?: string,
  tourStep?: number,
  source: 'api' | 'fixture' = 'fixture',
  runId: string | null = null,
  repositoryPath: string | null = null,
) {
  const params = new URLSearchParams(savedLens.urlState.startsWith('?') ? savedLens.urlState.slice(1) : savedLens.urlState);
  if (tourId) {
    params.set('tour', tourId);
    params.set('tourStep', String(tourStep ?? 0));
  }
  if (source === 'api' && runId) params.set('run', runId);
  if (source === 'api' && repositoryPath) params.set('repo', repositoryPath);
  const basePath = source === 'fixture' ? '/__observatory-preview' : '/';
  const query = params.toString();
  window.location.assign(query ? `${basePath}?${query}` : basePath);
}

function buildCurrentSavedLens({
  scopeKey,
  showQuestionLens,
  showFlowLens,
  proofMode,
  node,
  questionTitle,
  questionSummary,
  questionStatus,
  questionEvidence,
  flowTitle,
  flowSummary,
  flowStatus,
  flowEvidence,
  proofSelection,
}: {
  scopeKey: string;
  showQuestionLens: boolean;
  showFlowLens: boolean;
  proofMode: string;
  node: { label: string; summary: string; status: string; evidenceCount: number; primaryFiles?: string[] } | null;
  questionTitle?: string;
  questionSummary?: string;
  questionStatus?: string;
  questionEvidence: number;
  flowTitle?: string;
  flowSummary?: string;
  flowStatus?: string;
  flowEvidence: number;
  proofSelection: CodeCompanionSelection | null;
}): SavedLens {
  const proofOpen = proofMode !== 'closed' && proofSelection?.subject_type;
  const type: SavedLensType = proofOpen ? 'proof' : showQuestionLens ? 'question' : showFlowLens ? 'flow' : 'architecture';
  const title = proofOpen
    ? proofSelection?.title || 'Source proof'
    : showQuestionLens
      ? questionTitle || 'Question Lens'
      : showFlowLens
        ? flowTitle || 'Flow Lens'
        : node?.label || 'Architecture Lens';
  const summary = showQuestionLens
    ? questionSummary || 'Source-backed question lens.'
    : showFlowLens
      ? flowSummary || 'Source-backed movement lens.'
      : node?.summary || 'Saved architecture view.';
  const status = (showQuestionLens ? questionStatus : showFlowLens ? flowStatus : node?.status) || 'candidate';
  const evidenceCount = proofOpen ? 1 : showQuestionLens ? questionEvidence : showFlowLens ? flowEvidence : node?.evidenceCount ?? 0;
  const sourceRefs = proofSelection?.file_path ? [proofSelection.file_path] : node?.primaryFiles ?? [];
  return {
    id: createId('lens'),
    title,
    type,
    summary,
    status: status === 'partial' ? 'insufficient' : status as SavedLens['status'],
    evidenceCount,
    createdAt: new Date().toISOString(),
    urlState: window.location.search || '',
    sourceRefs,
    scopeKey,
  };
}
