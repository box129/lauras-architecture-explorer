const configuredWebSocketBase = (import.meta.env.VITE_WS_BASE_URL as string | undefined)?.trim();

export function buildWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (configuredWebSocketBase) {
    const configured = new URL(configuredWebSocketBase);
    if (configured.protocol === 'http:') configured.protocol = 'ws:';
    if (configured.protocol === 'https:') configured.protocol = 'wss:';
    if (configured.protocol !== 'ws:' && configured.protocol !== 'wss:') {
      throw new Error('VITE_WS_BASE_URL must use ws, wss, http, or https.');
    }
    const configuredUrl = configured.toString();
    const base = configuredUrl.endsWith('/')
      ? configuredUrl
      : `${configuredUrl}/`;
    return new URL(normalizedPath.slice(1), base).toString();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalizedPath}`;
}
