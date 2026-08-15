export interface ObservatoryUrlState {
  lensPath: string[];
  selectedNodeId: string | null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeLensPath(ids: string[]): string {
  if (ids.length === 0) return '';
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(ids)));
}

export function decodeLensPath(value: string | null): string[] {
  if (!value) return [];
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value));
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function readObservatoryUrlState(): ObservatoryUrlState {
  if (typeof window === 'undefined') return { lensPath: [], selectedNodeId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    lensPath: decodeLensPath(params.get('lens')),
    selectedNodeId: params.get('node'),
  };
}

function nextObservatoryUrl({ lensPath, selectedNodeId }: ObservatoryUrlState): string {
  const params = new URLSearchParams(window.location.search);
  const encodedLens = encodeLensPath(lensPath);
  if (encodedLens) {
    params.set('lens', encodedLens);
  } else {
    params.delete('lens');
  }
  if (selectedNodeId) {
    params.set('node', selectedNodeId);
  } else {
    params.delete('node');
  }
  const nextSearch = params.toString();
  return `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
}

// Replaces the current history entry -- used for non-navigational
// corrections (e.g. resetting lens/selection when the active analysis run
// changes) that should not themselves become a browser-Back stop.
export function setObservatoryUrlState(state: ObservatoryUrlState) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', nextObservatoryUrl(state));
}

// Pushes a new history entry -- used for user-initiated navigation
// (drilling into an area, selecting/deselecting an entity, breadcrumb/Back)
// so browser Back/Forward walks the same Overview/Area/Entity stack as the
// in-app Back control, instead of leaving the application on the first
// Back press.
export function pushObservatoryUrlState(state: ObservatoryUrlState) {
  if (typeof window === 'undefined') return;
  window.history.pushState(null, '', nextObservatoryUrl(state));
}
