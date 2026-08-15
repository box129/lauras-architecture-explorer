export interface QuestionLensUrlState {
  question: string;
  lensId: string | null;
  stepId: string | null;
}

export function readQuestionLensUrlState(): QuestionLensUrlState {
  if (typeof window === 'undefined') return { question: '', lensId: null, stepId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    question: params.get('q') ?? '',
    lensId: params.get('qlens'),
    stepId: params.get('qstep'),
  };
}

export function setQuestionLensUrlState({
  question,
  lensId,
  stepId,
}: Partial<QuestionLensUrlState>) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (question !== undefined) {
    if (question) params.set('q', question);
    else params.delete('q');
  }
  if (lensId !== undefined) {
    if (lensId) params.set('qlens', lensId);
    else params.delete('qlens');
  }
  if (stepId !== undefined) {
    if (stepId) params.set('qstep', stepId);
    else params.delete('qstep');
  }
  const nextSearch = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
}

export function clearQuestionLensUrlState() {
  setQuestionLensUrlState({ question: '', lensId: null, stepId: null });
}
