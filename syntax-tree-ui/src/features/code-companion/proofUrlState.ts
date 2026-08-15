import type { CodeCompanionSelection } from '../architecture-map/apiTypes';

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

export function encodeProofSelection(selection: CodeCompanionSelection | null): string {
  if (!selection) return '';
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(selection)));
}

export function decodeProofSelection(value: string | null): CodeCompanionSelection | null {
  if (!value) return null;
  if (value === '1') return { subject_type: '', subject_id: '', open: true };
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(value));
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.subject_type !== 'string' || typeof parsed.subject_id !== 'string') return null;
    return parsed as CodeCompanionSelection;
  } catch {
    return { subject_type: '', subject_id: '', evidence_id: value, open: true };
  }
}

// Pushes a history entry: opening or closing evidence is a real
// Entity <-> Evidence state transition, so browser Back/Forward must be
// able to walk across it the same way the in-app Back control does (see
// ObservatoryShell's unifiedBack and its popstate handler).
export function setProofUrlState(selection: CodeCompanionSelection | null) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const encoded = encodeProofSelection(selection);
  if (encoded) {
    params.set('proof', encoded);
  } else {
    params.delete('proof');
  }
  const nextSearch = params.toString();
  window.history.pushState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
}
