import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/client';
import type { FlowDetailDTO, FlowListItemDTO, FlowStepDTO } from '../architecture-map/apiTypes';
import { getFlowDetail, getFlowList } from '../architecture-map/lensCache';
import { getFixtureFlowDetail, getFixtureFlowList } from '../observatory/fixtures/openWebuiFlows';
import { setFlowUrlState } from './flowUrlState';

interface UseFlowLensOptions {
  source: 'api' | 'fixture';
  previewState: string;
  initialFlowId: string | null;
  initialStepId: string | null;
}

export interface FlowLensState {
  flows: FlowListItemDTO[];
  activeFlowId: string | null;
  activeFlow: FlowDetailDTO | null;
  selectedStepId: string | null;
  selectedStep: FlowStepDTO | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  isFlowMode: boolean;
  openFlow: (flowId: string, stepId?: string | null) => void;
  selectStep: (stepId: string | null) => void;
  closeFlow: () => void;
}

export function useFlowLens({
  source,
  previewState,
  initialFlowId,
  initialStepId,
}: UseFlowLensOptions): FlowLensState {
  const fixtureList = source === 'fixture' ? getFixtureFlowList(previewState) : null;
  const fixtureDetail = source === 'fixture' && initialFlowId
    ? getFixtureFlowDetail(initialFlowId, previewState)
    : null;
  const [flows, setFlows] = useState<FlowListItemDTO[]>(() => fixtureList?.flows ?? []);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(initialFlowId);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(initialStepId);
  const [activeFlow, setActiveFlow] = useState<FlowDetailDTO | null>(() => fixtureDetail);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlows = useCallback(async (isCancelled: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = source === 'fixture'
        ? getFixtureFlowList(previewState)
        : await getFlowList();
      if (!isCancelled()) setFlows(response.flows);
    } catch (err) {
      if (isCancelled()) return;
      setFlows([]);
      setError(err instanceof ApiError ? err.message : 'Flow list request failed');
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [previewState, source]);

  useEffect(() => {
    let cancelled = false;
    void loadFlows(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadFlows]);

  const loadDetail = useCallback(async (flowId: string, isCancelled: () => boolean) => {
    setDetailLoading(true);
    setError(null);
    try {
      const detail = source === 'fixture'
        ? getFixtureFlowDetail(flowId, previewState)
        : await getFlowDetail(flowId);
      if (isCancelled()) return;
      setActiveFlow(detail);
      if (!detail) setError('This flow was not returned for the active run.');
    } catch (err) {
      if (isCancelled()) return;
      setActiveFlow(null);
      setError(err instanceof ApiError ? err.message : 'Flow detail request failed');
    } finally {
      if (!isCancelled()) setDetailLoading(false);
    }
  }, [previewState, source]);

  useEffect(() => {
    if (!activeFlowId) {
      return;
    }
    let cancelled = false;
    void loadDetail(activeFlowId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [activeFlowId, loadDetail]);

  const selectedStep = useMemo(() => (
    activeFlow?.steps.find((step) => step.id === selectedStepId) ?? null
  ), [activeFlow?.steps, selectedStepId]);

  const openFlow = useCallback((flowId: string, stepId: string | null = null) => {
    setActiveFlowId(flowId);
    setSelectedStepId(stepId);
    setFlowUrlState(flowId, stepId);
  }, []);

  const selectStep = useCallback((stepId: string | null) => {
    setSelectedStepId(stepId);
    setFlowUrlState(activeFlowId, stepId);
  }, [activeFlowId]);

  const closeFlow = useCallback(() => {
    setActiveFlowId(null);
    setSelectedStepId(null);
    setActiveFlow(null);
    setFlowUrlState(null);
  }, []);

  return {
    flows,
    activeFlowId,
    activeFlow,
    selectedStepId,
    selectedStep,
    loading,
    detailLoading,
    error,
    isFlowMode: Boolean(activeFlowId),
    openFlow,
    selectStep,
    closeFlow,
  };
}
