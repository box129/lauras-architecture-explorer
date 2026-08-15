export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '\u2026';
}

export function fileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'high': return '#E94560';
    case 'medium': return '#FFA726';
    case 'low': return '#42A5F5';
    default: return '#888899';
  }
}
