import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { openWebuiLandscape } from '../observatory/fixtures/openWebuiLandscape';
import { openWebuiChildLenses } from '../observatory/fixtures/openWebuiChildLenses';
import type { ObservatoryLandscapeFixture, ObservatoryNode } from '../observatory/types';
import type { ArchitectureMapNodeDTO } from './apiTypes';
import { adaptArchitectureMap, adaptArchitectureNeighborhood, adaptArchitectureNode, adaptArchitectureScope } from './mapAdapter';
import { getArchitectureChildren, getArchitectureNeighborhood, getArchitectureNode, prefetchArchitectureChildren, prefetchArchitectureImplementation } from './lensCache';
import { pushObservatoryUrlState, readObservatoryUrlState, setObservatoryUrlState } from './lensUrlState';
import { useArchitectureMap } from './useArchitectureMap';

const apiFallbackLandscape: ObservatoryLandscapeFixture = {
  repoTitle: 'Syntax Tree',
  runId: 'Active run',
  lastScanned: 'loading',
  freshness: 'api mode',
  breadcrumb: ['Architecture map'],
  summary: 'Loading the source-backed architecture map from the active backend analysis.',
  nodes: [],
  edges: [],
  promptSuggestions: [
    'What does this architecture area do?',
    'Which code proves this?',
    'Where are the weak spots?',
  ],
};

export type ArchitectureLensSource = 'fixture' | 'api';
export type ArchitectureLensPreviewState =
  | 'normal'
  | 'loading'
  | 'empty'
  | 'error'
  | 'stale-lens'
  | 'unsupported-node'
  | 'stale-node'
  | 'no-explanation'
  | 'llm-failed';

export interface ArchitectureLensCrumb {
  id: string | null;
  label: string;
}

export interface ArchitectureLensError {
  kind: 'no-active-run' | 'stale-lens' | 'request-failed';
  message: string;
  statusCode: number | null;
}

interface UseArchitectureLensOptions {
  source: ArchitectureLensSource;
  previewState: ArchitectureLensPreviewState;
  focusShortcut: string | null;
  runId: string | null;
}

export interface ArchitectureLensController {
  landscape: ObservatoryLandscapeFixture | null;
  selectedNode: ObservatoryNode | null;
  focalNode: ObservatoryNode | null;
  // Set only when selectedNode is a genuine Entity Focus selection (a node
  // picked from within the current scope, not the scope's own focal/parent
  // node just entered via drilldown). Bounded, deterministic one-hop
  // dependencies/dependents of selectedNode -- see adaptArchitectureNeighborhood.
  entityFocusLandscape: ObservatoryLandscapeFixture | null;
  entityFocusLoading: boolean;
  isEntityFocus: boolean;
  lensPath: string[];
  breadcrumbs: ArchitectureLensCrumb[];
  loading: boolean;
  error: ArchitectureLensError | null;
  rootMeta: ObservatoryLandscapeFixture;
  selectNode: (node: ObservatoryNode | null) => void;
  enterNode: (node: ObservatoryNode, selectOnly?: boolean) => void;
  goToBreadcrumb: (index: number) => void;
  goBack: () => void;
  clearLens: () => void;
  prefetchNode: (node: ObservatoryNode) => void;
  retry: () => void;
}

function initialLensPath(source: ArchitectureLensSource, focusShortcut: string | null): string[] {
  if (source === 'fixture' && focusShortcut) return focusShortcut.split(',').map((item) => item.trim()).filter(Boolean);
  return readObservatoryUrlState().lensPath;
}

function findFixtureNode(id: string): ObservatoryNode | null {
  const rootNode = openWebuiLandscape.nodes.find((node) => node.id === id);
  if (rootNode) return rootNode;
  for (const lens of Object.values(openWebuiChildLenses)) {
    const found = lens.nodes.find((node) => node.id === id);
    if (found) return found;
  }
  return null;
}

function fixtureLandscapeFor(lensPath: string[]): ObservatoryLandscapeFixture | null {
  if (lensPath.length === 0) return openWebuiLandscape;
  return openWebuiChildLenses[lensPath[lensPath.length - 1]] ?? null;
}

function fixtureBreadcrumbs(lensPath: string[]): ArchitectureLensCrumb[] {
  return [
    ...openWebuiLandscape.breadcrumb.map((label, index) => ({ id: index === 0 ? null : `fixture-root-${index}`, label })),
    ...lensPath.map((id) => ({ id, label: findFixtureNode(id)?.label ?? 'Architecture area' })),
  ];
}

function apiBreadcrumbs(root: ObservatoryLandscapeFixture | null, pathNodes: ArchitectureMapNodeDTO[]): ArchitectureLensCrumb[] {
  return [
    { id: null, label: root?.repoTitle ?? 'Architecture map' },
    ...pathNodes.map((node) => ({ id: node.id, label: node.label || 'Architecture area' })),
  ];
}

export function useArchitectureLens({
  source,
  previewState,
  focusShortcut,
  runId,
}: UseArchitectureLensOptions): ArchitectureLensController {
  const apiEnabled = source === 'api' && previewState === 'normal';
  const rootMap = useArchitectureMap(apiEnabled, runId);
  const [lensPath, setLensPath] = useState(() => initialLensPath(source, focusShortcut));
  const [selectedNodeId, setSelectedNodeId] = useState(() => readObservatoryUrlState().selectedNodeId);
  const [apiLandscape, setApiLandscape] = useState<ObservatoryLandscapeFixture | null>(null);
  const [apiPathNodes, setApiPathNodes] = useState<ArchitectureMapNodeDTO[]>([]);
  const [childLoading, setChildLoading] = useState(false);
  const [childError, setChildError] = useState<ArchitectureLensError | null>(null);
  const previousRunId = useRef(runId);

  useEffect(() => {
    if (source !== 'api' || previousRunId.current === runId) return;
    previousRunId.current = runId;
    setLensPath([]);
    setSelectedNodeId(null);
    setApiLandscape(null);
    setApiPathNodes([]);
    setChildError(null);
    setObservatoryUrlState({ lensPath: [], selectedNodeId: null });
  }, [runId, source]);

  const rootLandscape = useMemo(
    () => (rootMap.data ? adaptArchitectureMap(rootMap.data) : null),
    [rootMap.data],
  );

  useEffect(() => {
    if (source !== 'api' || previewState !== 'normal' || !rootMap.data) {
      return;
    }
    if (lensPath.length === 0) {
      // Mirrors clearLens(): without this, apiPathNodes (and therefore the breadcrumb) keeps
      // showing the last-drilled component after returning to the root lens, even though
      // landscape/focalNode already correctly fall back to rootLandscape above.
      setApiPathNodes([]);
      setApiLandscape(null);
      setChildError(null);
      return;
    }
    let cancelled = false;
    setChildLoading(true);
    setChildError(null);
    (async () => {
      try {
        const rootData = rootMap.data;
        if (!rootData) return;
        const pathNodes: ArchitectureMapNodeDTO[] = [];
        let currentParent: ArchitectureMapNodeDTO | null = null;
        let currentChildren: ArchitectureMapNodeDTO[] = rootData.nodes.filter((node) => node.id !== rootData.root.id);
        let currentEdges = rootData.edges;
        for (const nodeId of lensPath) {
          const parent = currentChildren.find((node) => node.id === nodeId) ?? await getArchitectureNode(nodeId);
          pathNodes.push(parent);
          const childResponse = await getArchitectureChildren(nodeId);
          currentParent = parent;
          currentChildren = childResponse.children;
          currentEdges = childResponse.edges;
        }
        if (!cancelled && currentParent && rootLandscape) {
          setApiPathNodes(pathNodes);
          setApiLandscape(adaptArchitectureScope(
            currentParent,
            currentChildren,
            currentEdges,
            {
              repoTitle: rootLandscape.repoTitle,
              runId: rootLandscape.runId,
              lastScanned: rootLandscape.lastScanned,
              freshness: rootLandscape.freshness,
              breadcrumb: rootLandscape.breadcrumb,
              promptSuggestions: rootLandscape.promptSuggestions,
            },
          ));
          setChildError(null);
        }
      } catch (error) {
        if (cancelled) return;
        const status = error instanceof ApiError ? error.status : null;
        setApiLandscape(null);
        setApiPathNodes([]);
        setChildError({
          kind: status === 404 ? 'stale-lens' : status === 503 ? 'no-active-run' : 'request-failed',
          message: error instanceof Error ? error.message : 'Architecture lens request failed',
          statusCode: status,
        });
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lensPath, previewState, rootLandscape, rootMap.data, source]);

  const fixtureLandscape = useMemo(() => {
    if (previewState === 'empty') return { ...openWebuiLandscape, nodes: [], edges: [] };
    if (source !== 'fixture') return null;
    return fixtureLandscapeFor(lensPath);
  }, [lensPath, previewState, source]);

  const landscape = source === 'api'
    ? lensPath.length > 0 ? apiLandscape : rootLandscape
    : fixtureLandscape;

  // A selection can legitimately name a node that is not in the current
  // lens landscape at all — e.g. Entity Focus entered from the
  // deterministic architecture graph, whose module ids exist in the map's
  // node API but not in the legacy landscape node list. Resolve such an
  // id through the real `/architecture-map/nodes/{id}` endpoint instead of
  // silently dropping the selection (live-audit defect: Entity Focus was
  // unreachable from normal navigation).
  const [detachedNode, setDetachedNode] = useState<ObservatoryNode | null>(null);
  useEffect(() => {
    if (source !== 'api' || !selectedNodeId) {
      setDetachedNode(null);
      return;
    }
    const inLandscape = landscape?.nodes.some((node) => node.id === selectedNodeId)
      || landscape?.parentNode?.id === selectedNodeId;
    if (inLandscape) {
      setDetachedNode(null);
      return;
    }
    let cancelled = false;
    getArchitectureNode(selectedNodeId)
      .then((dto) => {
        if (!cancelled) setDetachedNode({ ...adaptArchitectureNode(dto), position: { x: 0, y: 0 } });
      })
      .catch(() => {
        if (!cancelled) setDetachedNode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [landscape, selectedNodeId, source]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const childNode = landscape?.nodes.find((node) => node.id === selectedNodeId) ?? null;
    if (childNode) return childNode;
    if (landscape?.parentNode && landscape.parentNode.id === selectedNodeId) return landscape.parentNode;
    return detachedNode?.id === selectedNodeId ? detachedNode : null;
  }, [detachedNode, landscape, selectedNodeId]);

  const breadcrumbs = source === 'api'
    ? apiBreadcrumbs(rootLandscape, apiPathNodes)
    : fixtureBreadcrumbs(lensPath);

  const focalNode = landscape?.parentNode ?? null;
  const rootMeta = landscape ?? rootLandscape ?? (source === 'api' ? apiFallbackLandscape : openWebuiLandscape);

  // Entity Focus applies only when the user picked one node out of the
  // current scope (a plain click on a non-drilldown node, or an
  // Alt+click/table select-only) -- not when selectedNode merely mirrors
  // the scope's own focal/parent node as enterNode's drilldown side effect.
  const focusEntity = source === 'api' && selectedNode && selectedNode.id !== focalNode?.id ? selectedNode : null;
  const [entityFocusLandscape, setEntityFocusLandscape] = useState<ObservatoryLandscapeFixture | null>(null);
  const [entityFocusLoading, setEntityFocusLoading] = useState(false);

  useEffect(() => {
    if (!focusEntity || !rootLandscape) {
      setEntityFocusLandscape(null);
      setEntityFocusLoading(false);
      return;
    }
    let cancelled = false;
    setEntityFocusLoading(true);
    (async () => {
      try {
        const response = await getArchitectureNeighborhood(focusEntity.id);
        if (!cancelled) {
          setEntityFocusLandscape(adaptArchitectureNeighborhood(focusEntity, response, {
            repoTitle: rootLandscape.repoTitle,
            runId: rootLandscape.runId,
            lastScanned: rootLandscape.lastScanned,
            freshness: rootLandscape.freshness,
            breadcrumb: rootLandscape.breadcrumb,
            promptSuggestions: rootLandscape.promptSuggestions,
          }));
        }
      } catch {
        if (!cancelled) setEntityFocusLandscape(null);
      } finally {
        if (!cancelled) setEntityFocusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusEntity, rootLandscape]);

  const writeState = useCallback((nextLensPath: string[], nextSelectedNodeId: string | null) => {
    setLensPath(nextLensPath);
    setSelectedNodeId(nextSelectedNodeId);
    // pushState (not replaceState): each of these calls is a discrete,
    // user-initiated Overview/Area/Entity transition, so browser Back/
    // Forward should walk through them exactly like the in-app Back
    // control and breadcrumb do (see the popstate handler below).
    pushObservatoryUrlState({ lensPath: source === 'api' ? nextLensPath : [], selectedNodeId: nextSelectedNodeId });
  }, [source]);

  const clearLens = useCallback(() => {
    writeState([], null);
    setApiLandscape(null);
    setApiPathNodes([]);
    setChildError(null);
  }, [writeState]);

  const selectNode = useCallback((node: ObservatoryNode | null) => {
    writeState(lensPath, node?.id ?? null);
  }, [lensPath, writeState]);

  const enterNode = useCallback((node: ObservatoryNode, selectOnly = false) => {
    if (selectOnly || !node.canDrilldown) {
      writeState(lensPath, node.id);
      return;
    }
    writeState([...lensPath, node.id], node.id);
  }, [lensPath, writeState]);

  const goToBreadcrumb = useCallback((index: number) => {
    const baseCrumbCount = source === 'fixture' ? openWebuiLandscape.breadcrumb.length : 1;
    if (index < baseCrumbCount) {
      clearLens();
      return;
    }
    writeState(lensPath.slice(0, index - baseCrumbCount + 1), null);
  }, [clearLens, lensPath, source, writeState]);

  const goBack = useCallback(() => {
    // Enter records the entered structural node as the selected focal node.
    // Back from that state must leave the scope, not spend a redundant step
    // merely clearing selection before the actual scope transition.
    if (lensPath.length > 0 && selectedNodeId === focalNode?.id) {
      writeState(lensPath.slice(0, -1), null);
      return;
    }
    if (selectedNodeId) {
      writeState(lensPath, null);
      return;
    }
    if (lensPath.length > 0) {
      writeState(lensPath.slice(0, -1), null);
    }
  }, [focalNode?.id, lensPath, selectedNodeId, writeState]);

  // Browser Back/Forward integration: pushObservatoryUrlState above gives every
  // in-app navigation its own history entry, so a popstate event means the user
  // used the browser's own Back/Forward -- reconcile lens state to match the URL
  // it landed on directly (bypassing writeState, which would push a *new* entry
  // and turn one Back press into a no-op loop).
  useEffect(() => {
    if (source !== 'api' || typeof window === 'undefined') return;
    const handlePopState = () => {
      const next = readObservatoryUrlState();
      setLensPath((current) => (
        current.length === next.lensPath.length && current.every((id, index) => id === next.lensPath[index])
          ? current
          : next.lensPath
      ));
      setSelectedNodeId((current) => (current === next.selectedNodeId ? current : next.selectedNodeId));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [source]);

  const prefetchNode = useCallback((node: ObservatoryNode) => {
    if (source === 'api') {
      prefetchArchitectureChildren(node);
      prefetchArchitectureImplementation(node);
    }
  }, [source]);

  const retry = useCallback(() => {
    if (lensPath.length === 0) {
      rootMap.refetch();
    } else {
      const nextPath = [...lensPath];
      setLensPath([]);
      window.setTimeout(() => setLensPath(nextPath), 0);
    }
  }, [lensPath, rootMap]);

  let error: ArchitectureLensError | null = null;
  if (previewState === 'stale-lens') {
    error = { kind: 'stale-lens', message: 'This preview is showing the stale lens recovery state.', statusCode: 404 };
  } else if (source === 'api' && rootMap.statusCode === 503) {
    error = { kind: 'no-active-run', message: rootMap.error ?? 'No active analysis run is loaded.', statusCode: 503 };
  } else if (source === 'api' && rootMap.error && lensPath.length === 0) {
    error = { kind: 'request-failed', message: rootMap.error, statusCode: rootMap.statusCode };
  } else if (source === 'api' && childError) {
    error = childError;
  } else if (source === 'fixture' && lensPath.length > 0 && !fixtureLandscape) {
    error = { kind: 'stale-lens', message: 'The requested fixture lens no longer exists.', statusCode: 404 };
  }

  const loading = previewState === 'loading'
    || (source === 'api' && (rootMap.loading || childLoading || entityFocusLoading));

  return {
    landscape,
    selectedNode,
    focalNode,
    entityFocusLandscape,
    entityFocusLoading,
    isEntityFocus: Boolean(focusEntity),
    lensPath,
    breadcrumbs,
    loading,
    error,
    rootMeta,
    selectNode,
    enterNode,
    goToBreadcrumb,
    goBack,
    clearLens,
    prefetchNode,
    retry,
  };
}
