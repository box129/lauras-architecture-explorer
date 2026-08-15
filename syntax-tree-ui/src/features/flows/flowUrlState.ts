export function setFlowUrlState(flowId: string | null, stepId?: string | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (flowId) {
    params.set('flow', flowId);
  } else {
    params.delete('flow');
    params.delete('step');
  }
  if (stepId) {
    params.set('step', stepId);
  } else {
    params.delete('step');
  }
  const nextSearch = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
}
