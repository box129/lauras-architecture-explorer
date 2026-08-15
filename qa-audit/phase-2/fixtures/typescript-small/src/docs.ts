import type { AnalysisResult } from './types';

export function generateDocumentation(result: AnalysisResult): string {
  return `Parsed ${result.filesParsed} files from ${result.repository}`;
}

