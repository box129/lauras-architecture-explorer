import type { ArchitectureOverview, SubsystemResponse, ArchitectureViolation } from '../api/types';

export interface NarratorStep {
  highlightQN: string | null;
  view: 'architecture' | 'layered';
  narration: string;
}

export function buildNarratorSteps(
  overview: ArchitectureOverview,
  subsystems: SubsystemResponse[],
  violations: ArchitectureViolation[],
): NarratorStep[] {
  const steps: NarratorStep[] = [];

  steps.push({
    highlightQN: null,
    view: 'architecture',
    narration: overview.system_summary || 'Welcome to the architecture tour.',
  });

  for (const sub of subsystems) {
    steps.push({
      highlightQN: sub.qualified_name,
      view: 'architecture',
      narration: sub.description || `Subsystem: ${sub.name} (${sub.component_count} components)`,
    });
  }

  if (violations.length > 0) {
    steps.push({
      highlightQN: violations[0].qualified_name,
      view: 'architecture',
      narration: `There are ${violations.length} architectural violations. The most severe: ${violations[0].name}. ${violations[0].description}`,
    });
  }

  steps.push({
    highlightQN: null,
    view: 'layered',
    narration: `The codebase has ${overview.total_layers} architectural layers with ${overview.total_components} components organized into ${overview.total_subsystems} subsystems.`,
  });

  return steps;
}
