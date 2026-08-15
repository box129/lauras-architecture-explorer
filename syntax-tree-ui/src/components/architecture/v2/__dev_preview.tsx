/**
 * Dev-only preview page for the v2 hierarchy view.
 * Reachable at /__v2-preview when running `npm run dev`.
 * Uses a static fixture so we can verify ELK layout without running analysis.
 */
import HierarchyV2View from './HierarchyV2View';
import type { V2HierarchyResult } from '../../../api/types';

const FIXTURE: V2HierarchyResult = {
  version: '2.0',
  repo_label: 'fixture-monorepo',
  model: 'deepseek/deepseek-v4 (mock)',
  total_tokens_in: 23410,
  total_tokens_out: 4112,
  total_tool_calls: 17,
  confidence: 0.84,
  layout_hints: {
    align_horizontal: [['L1:apps.web', 'L1:apps.api']],
    groups: [],
    separate: [],
  },
  trace: [],
  hierarchy: {
    id: 'root',
    label: 'fixture-monorepo',
    kind: 'system',
    confidence: 0.84,
    children: [
      {
        id: 'L0:apps',
        label: 'Applications',
        kind: 'macro_layer',
        rationale: 'Two deployable apps share core libs.',
        evidence: ['apps/web/package.json', 'apps/api/main.py'],
        confidence: 0.91,
        children: [
          {
            id: 'L1:apps.web',
            label: 'Web Frontend',
            kind: 'subsystem',
            rationale: 'React + Vite SPA.',
            evidence: ['apps/web/src/main.tsx'],
            members: ['apps/web/src'],
            confidence: 0.88,
          },
          {
            id: 'L1:apps.api',
            label: 'HTTP API',
            kind: 'subsystem',
            rationale: 'FastAPI service backing the SPA.',
            evidence: ['apps/api/main.py'],
            members: ['apps/api/app'],
            confidence: 0.86,
          },
          {
            id: 'L1:apps.worker',
            label: 'Background Worker',
            kind: 'subsystem',
            rationale: 'Celery worker consuming a queue.',
            evidence: ['apps/worker/tasks.py'],
            members: ['apps/worker'],
            confidence: 0.74,
          },
        ],
      },
      {
        id: 'L0:platform',
        label: 'Platform Libs',
        kind: 'macro_layer',
        rationale: 'Shared domain types + cross-cutting helpers.',
        evidence: ['packages/types/index.ts', 'packages/auth/src'],
        confidence: 0.82,
        children: [
          {
            id: 'L1:platform.types',
            label: 'Shared Types',
            kind: 'subsystem',
            rationale: 'TS schema mirrored from FastAPI models.',
            evidence: ['packages/types/index.ts'],
            members: ['packages/types'],
            confidence: 0.83,
          },
          {
            id: 'L1:platform.auth',
            label: 'Auth Library',
            kind: 'subsystem',
            rationale: 'Shared JWT validators.',
            evidence: ['packages/auth/src/jwt.ts'],
            members: ['packages/auth'],
            confidence: 0.79,
          },
        ],
      },
      {
        id: 'L0:infra',
        label: 'Infrastructure',
        kind: 'macro_layer',
        rationale: 'Database, broker, and IaC live here.',
        evidence: ['infra/terraform/main.tf', 'docker-compose.yml'],
        confidence: 0.71,
        children: [
          {
            id: 'L1:infra.iac',
            label: 'IaC',
            kind: 'subsystem',
            rationale: 'Terraform stacks for prod + staging.',
            evidence: ['infra/terraform/main.tf'],
            members: ['infra/terraform'],
            confidence: 0.7,
          },
          {
            id: 'L1:infra.compose',
            label: 'Local Compose',
            kind: 'subsystem',
            rationale: 'Postgres + Redis + worker for dev.',
            evidence: ['docker-compose.yml'],
            members: ['docker-compose.yml', 'compose.override.yml'],
            confidence: 0.68,
          },
        ],
      },
    ],
  },
  edges: [
    { src: 'L1:apps.web', dst: 'L1:apps.api', type: 'calls_http' },
    { src: 'L1:apps.api', dst: 'L1:platform.types', type: 'imports' },
    { src: 'L1:apps.web', dst: 'L1:platform.types', type: 'imports' },
    { src: 'L1:apps.api', dst: 'L1:platform.auth', type: 'imports' },
    { src: 'L1:apps.api', dst: 'L1:infra.compose', type: 'depends_on' },
    { src: 'L1:apps.worker', dst: 'L1:infra.compose', type: 'depends_on' },
  ],
};

export default function V2DevPreview() {
  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-primary">
      <div className="px-3 py-2 text-xs border-b border-slate-800 bg-surface">
        <strong>Dev preview</strong> — v2 hierarchy with static fixture (no API call).
      </div>
      <div className="flex-1 min-h-0">
        <HierarchyV2View data={FIXTURE} loading={false} error={null} />
      </div>
    </div>
  );
}
