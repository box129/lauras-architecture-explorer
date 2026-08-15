import { RepositoryAnalyzer } from './analyzer';
import { generateDocumentation } from './docs';

export function startAnalysis(repository: string): string {
  const analyzer = new RepositoryAnalyzer();
  return generateDocumentation(analyzer.analyze(repository));
}

