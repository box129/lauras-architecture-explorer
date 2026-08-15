export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function cohesionToColor(cohesion: number): string {
  // Green at 1.0, yellow at 0.5, red at 0.0
  const hue = lerp(0, 120, cohesion);
  return `hsl(${hue}, 70%, 45%)`;
}

export function scoreToColor(score: number): string {
  if (score >= 0.8) return '#4CAF50';
  if (score >= 0.6) return '#FFA726';
  return '#E94560';
}

export function gradeFromScore(score: number): { letter: string; color: string } {
  if (score >= 93) return { letter: 'A+', color: '#4CAF50' };
  if (score >= 87) return { letter: 'A', color: '#4CAF50' };
  if (score >= 80) return { letter: 'A-', color: '#66BB6A' };
  if (score >= 73) return { letter: 'B+', color: '#8BC34A' };
  if (score >= 67) return { letter: 'B', color: '#CDDC39' };
  if (score >= 60) return { letter: 'B-', color: '#FFC107' };
  if (score >= 53) return { letter: 'C+', color: '#FF9800' };
  if (score >= 47) return { letter: 'C', color: '#FF5722' };
  if (score >= 40) return { letter: 'C-', color: '#F44336' };
  return { letter: 'D', color: '#E94560' };
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#4CAF50';
  if (confidence >= 0.5) return '#FFA726';
  return '#E94560';
}

const HEAT_RANGES: Record<string, { hueFrom: number; hueTo: number }> = {
  coupling: { hueFrom: 220, hueTo: 0 },
  complexity: { hueFrom: 220, hueTo: 30 },
  impact: { hueFrom: 220, hueTo: 280 },
  documentation: { hueFrom: 150, hueTo: 0 },
};

export function computeHeatColor(mode: string, data: Record<string, unknown>): string {
  let ratio = 0;
  switch (mode) {
    case 'coupling':
      ratio = (data.coupling as number) || 0;
      break;
    case 'complexity':
      ratio = ((data.avgOutDegree as number) || 0) / ((data.maxOutDegree as number) || 1);
      break;
    case 'impact':
      ratio = ((data.maxDepth as number) || 0) / ((data.maxSystemDepth as number) || 1);
      break;
    case 'documentation': {
      const total = (data.totalFunctions as number) || 0;
      const documented = (data.documentedFunctions as number) || 0;
      ratio = total > 0 ? 1 - documented / total : 0;
      break;
    }
    default:
      return 'transparent';
  }

  const range = HEAT_RANGES[mode];
  if (!range) return 'transparent';
  const hue = lerp(range.hueFrom, range.hueTo, ratio);
  const alpha = lerp(0.12, 0.45, ratio);
  return `hsla(${hue}, 55%, 35%, ${alpha})`;
}
