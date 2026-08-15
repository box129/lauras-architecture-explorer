import { parseTypeScript } from './parser';
import type { AnalysisResult } from './types';

export class RepositoryAnalyzer {
  analyze(repository: string): AnalysisResult {
    return parseTypeScript(repository);
  }
}

