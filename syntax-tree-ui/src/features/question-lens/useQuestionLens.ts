import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryResponseDTO, QuestionLensDTO } from '../architecture-map/apiTypes';
import { getQuestionLens, submitQuery } from '../architecture-map/lensCache';
import {
  getFixtureQueryResponse,
  getFixtureQuestionLens,
  getFixtureQuestionText,
  normalizeQuestionFixtureKey,
} from '../observatory/fixtures/openWebuiQuestionLenses';
import { clearQuestionLensUrlState, readQuestionLensUrlState, setQuestionLensUrlState } from './questionLensUrlState';

interface UseQuestionLensArgs {
  source: 'api' | 'fixture';
  previewState: string;
  previewQuestion: string | null;
  initialLensId: string | null;
  initialStepId: string | null;
  runId: string | null;
}

interface QuestionLensState {
  response: QueryResponseDTO | null;
  rankedLenses: QuestionLensDTO[];
  activeLens: QuestionLensDTO | null;
  selectedStepId: string | null;
  selectedStep: QuestionLensDTO['steps'][number] | null;
  question: string;
  loading: boolean;
  restoring: boolean;
  error: string | null;
  isQuestionMode: boolean;
  submit: (question: string) => Promise<void>;
  selectStep: (stepId: string | null) => void;
  close: () => void;
  setActiveLens: (lens: QuestionLensDTO | null) => void;
}

export function useQuestionLens({
  source,
  previewState,
  previewQuestion,
  initialLensId,
  initialStepId,
  runId,
}: UseQuestionLensArgs): QuestionLensState {
  const fixtureKey = normalizeQuestionFixtureKey(previewQuestion);
  const urlState = readQuestionLensUrlState();
  const initialQuestion = source === 'fixture'
    ? getFixtureQuestionText(fixtureKey)
    : urlState.question;
  const initialFixtureResponse = source === 'fixture' && fixtureKey
    ? getFixtureQueryResponse(fixtureKey)
    : null;
  const initialFixtureLens = source === 'fixture'
    ? getFixtureQuestionLens(fixtureKey, initialLensId)
    : null;
  const [response, setResponse] = useState<QueryResponseDTO | null>(initialFixtureResponse);
  const [activeLens, setActiveLensState] = useState<QuestionLensDTO | null>(initialFixtureLens);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(initialStepId);
  const [question, setQuestion] = useState(initialQuestion);
  const [loading, setLoading] = useState(source === 'fixture' && previewState === 'query-loading');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source !== 'api' || !initialLensId || activeLens) return;
    let cancelled = false;
    setRestoring(true);
    setError(null);
    getQuestionLens(initialLensId)
      .then((lens) => {
        if (cancelled) return;
        if (runId && lens.analysis_run_id !== runId) {
          throw new Error('This saved question lens belongs to a different analysis run.');
        }
        setActiveLensState(lens);
        setQuestion(urlState.question);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Question lens could not be restored');
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLens, initialLensId, runId, source, urlState.question]);

  useEffect(() => {
    if (source !== 'api') return;
    setResponse(null);
    setActiveLensState(null);
    setSelectedStepId(null);
    setError(null);
  }, [runId, source]);

  const rankedLenses = useMemo(
    () => rankLenses(response?.visual_lenses ?? []),
    [response?.visual_lenses],
  );

  const selectedStep = useMemo(
    () => activeLens?.steps.find((step) => step.id === selectedStepId) ?? null,
    [activeLens?.steps, selectedStepId],
  );

  const setActiveLens = useCallback((lens: QuestionLensDTO | null) => {
    setActiveLensState(lens);
    setSelectedStepId(null);
    setQuestionLensUrlState({ lensId: lens?.id ?? null, stepId: null });
  }, []);

  const selectStep = useCallback((stepId: string | null) => {
    setSelectedStepId(stepId);
    setQuestionLensUrlState({ stepId });
  }, []);

  const submit = useCallback(async (nextQuestion: string) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setQuestion(trimmed);
    try {
      const nextResponse = source === 'fixture'
        ? getFixtureQueryResponse(fixtureKey ?? 'login')
        : await submitQuery(trimmed, response?.conversation_id);
      if (source === 'api' && runId && nextResponse.analysis_run_id !== runId) {
        throw new Error('The answer belongs to a different analysis run. Retry after the current analysis is loaded.');
      }
      const sortedResponse = {
        ...nextResponse,
        visual_lenses: rankLenses(nextResponse.visual_lenses),
      };
      const nextLens = sortedResponse.visual_lenses[0] ?? null;
      setResponse(sortedResponse);
      setActiveLensState(nextLens);
      setSelectedStepId(null);
      setQuestionLensUrlState({
        question: trimmed,
        lensId: nextLens?.id ?? null,
        stepId: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Question request failed');
    } finally {
      setLoading(false);
    }
  }, [fixtureKey, response?.conversation_id, runId, source]);

  const close = useCallback(() => {
    setActiveLensState(null);
    setSelectedStepId(null);
    setResponse(null);
    setError(null);
    setQuestion('');
    clearQuestionLensUrlState();
  }, []);

  return {
    response,
    rankedLenses,
    activeLens,
    selectedStepId,
    selectedStep,
    question,
    loading,
    restoring,
    error,
    isQuestionMode: Boolean(response || activeLens || loading || error || restoring),
    submit,
    selectStep,
    close,
    setActiveLens,
  };
}

function rankLenses(lenses: QuestionLensDTO[]): QuestionLensDTO[] {
  return [...lenses].sort((a, b) => relevanceScore(b) - relevanceScore(a));
}

function relevanceScore(lens: QuestionLensDTO): number {
  const score = lens.metadata.relevance_score;
  return typeof score === 'number' && Number.isFinite(score) ? score : 0;
}
