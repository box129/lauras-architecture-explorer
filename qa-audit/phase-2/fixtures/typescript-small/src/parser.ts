import type { AnalysisResult } from './types';

export function parseTypeScript(repository: string): AnalysisResult {
  return { repository, filesParsed: 3 };
}

