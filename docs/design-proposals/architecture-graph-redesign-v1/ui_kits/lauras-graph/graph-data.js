/*
  Laura's architecture-graph redesign prototype.

  IMPORTANT EPISTEMIC BOUNDARY
  -----------------------------
  - Membership, module counts and edge counts in this design example represent
    deterministic structure/relation data.
  - `ai` names/descriptions are explicitly presentation-only AI interpretation
    examples layered over a FIXED deterministic group. They never change
    membership or relation counts.
  - Geometry is authored for visual review. Production needs containment-aware
    auto-layout and deterministic edge aggregation.
*/
window.GraphData = (function () {
  const CW = 1560, CH = 1160;

  /*
    kind:
      region   = top-level deterministic containment region
      area     = deterministic section positioned as an architectural area;
                 optional `ai` provides the human-readable interpretation
      cluster  = deterministic relation-derived group
      residual = honest modules not qualifying for a cluster
      loose    = small structural set outside a main region
  */
  const nodes = [
    /* ── top level ─────────────────────────────────────────────── */
    {
      id: 'frontend', kind: 'region', label: 'Frontend', path: 'frontend', count: 32,
      depth: 0, rect: { x: 440, y: 34, w: 680, h: 196 },
      summary: '32 modules · 2 sections', accent: 'violet'
    },
    {
      id: 'backend', kind: 'region', label: 'Backend', path: 'backend', count: 96,
      depth: 0, rect: { x: 54, y: 268, w: 1450, h: 748 },
      summary: '96 modules · 6 structural areas · 5 clusters', accent: 'blue'
    },
    {
      id: 'root', kind: 'loose', label: 'Root / build files', path: '/', count: 2,
      depth: 0, rect: { x: 500, y: 1040, w: 560, h: 86 },
      members: ['server.js', 'server.test.js'], accent: 'neutral'
    },

    /* ── frontend ──────────────────────────────────────────────── */
    {
      id: 'fe-components', kind: 'area', label: 'components', path: 'frontend/src/components',
      count: 21, depth: 1, parent: 'frontend', rect: { x: 468, y: 102, w: 300, h: 102 },
      members: ['ReviewPanel.jsx', 'TopicList.jsx', 'Uploader.jsx'], accent: 'violet',
      ai: {
        name: 'UI Components',
        description: 'Reusable interface elements and review surfaces. Design-example interpretation only.'
      }
    },
    {
      id: 'fe-app', kind: 'area', label: 'app', path: 'frontend/src/app',
      count: 11, depth: 1, parent: 'frontend', rect: { x: 792, y: 102, w: 300, h: 102 },
      members: ['routes.jsx', 'api.js', 'store.js'], accent: 'violet',
      ai: {
        name: 'Pages & Routing',
        description: 'Application routing, state and API-facing frontend glue. Design-example interpretation only.'
      }
    },

    /* ── backend architecture canvas ───────────────────────────── */
    {
      id: 'controllers', kind: 'area', label: 'controllers', path: 'backend/src/controllers',
      count: 31, depth: 1, parent: 'backend', rect: { x: 500, y: 326, w: 400, h: 122 },
      members: ['auth.controller.js', 'submission.controller.js', 'admin.controller.js', 'report.controller.js'],
      accent: 'blue',
      ai: {
        name: 'Request / API Layer',
        description: 'Request-facing modules that hand work into the application service layer. Design-example interpretation only.'
      }
    },
    {
      id: 'middleware', kind: 'area', label: 'middleware', path: 'backend/src/middleware',
      count: 2, depth: 1, parent: 'backend', rect: { x: 1136, y: 350, w: 292, h: 112 },
      members: ['auth.middleware.js', 'error.middleware.js'], accent: 'cyan',
      ai: {
        name: 'Cross-cutting',
        description: 'Middleware used across request handling. Design-example interpretation only.'
      }
    },
    {
      id: 'services', kind: 'area', label: 'services', path: 'backend/src/services',
      count: 50, depth: 1, parent: 'backend', rect: { x: 330, y: 500, w: 890, h: 326 },
      summary: '5 deterministic clusters · 35 ungrouped', clustered: true, accent: 'teal',
      ai: {
        name: 'Application Services',
        description: 'Dense application-service scope. The name is an AI interpretation; the 50-module membership remains fixed by the structural section.'
      }
    },
    {
      id: 'tests', kind: 'area', label: 'tests', path: 'backend/tests',
      count: 14, depth: 1, parent: 'backend', rect: { x: 82, y: 548, w: 220, h: 176 },
      members: ['auth.test.js', 'submission.test.js', 'similarity.test.js', 'worker.test.js'],
      summary: 'unit · integration', accent: 'neutral'
    },
    {
      id: 'config', kind: 'area', label: 'config', path: 'backend/src/config',
      count: 7, depth: 1, parent: 'backend', rect: { x: 500, y: 860, w: 270, h: 104 },
      members: ['auth.config.js', 'db.config.js', 'mail.config.js', 'queue.config.js'], accent: 'cyan',
      ai: {
        name: 'Configuration',
        description: 'Configuration modules used by application services. The structural basis is backend/src/config.'
      }
    },
    {
      id: 'utils', kind: 'area', label: 'utils', path: 'backend/src/utils',
      count: 4, depth: 1, parent: 'backend', rect: { x: 792, y: 860, w: 270, h: 104 },
      members: ['logger.js', 'hash.js', 'dates.js', 'ids.js'], accent: 'cyan',
      ai: {
        name: 'Shared Utilities',
        description: 'Utility modules called by the service layer. The structural basis is backend/src/utils.'
      }
    },

    /* ── deterministic service clusters ───────────────────────── */
    {
      id: 'c1', kind: 'cluster', label: 'Cluster 1', full: 'Structural cluster 1',
      count: 5, relations: 6, depth: 2, parent: 'services', rect: { x: 350, y: 588, w: 158, h: 150 },
      members: ['auth.service.js', 'email.service.js', 'notification.service.js', 'notificationEvent.service.js', 'submission.service.js'],
      accent: 'teal',
      ai: {
        name: 'Authentication & Sessions',
        description: 'Credential checks, session/token work and related notifications. AI interpretation example; membership stays deterministic.'
      },
      basis: [
        ['auth.service.js', 'imports', 'email.service.js'],
        ['auth.service.js', 'imports', 'notification.service.js'],
        ['notification.service.js', 'calls', 'notificationEvent.service.js'],
        ['submission.service.js', 'imports', 'notification.service.js']
      ]
    },
    {
      id: 'c2', kind: 'cluster', label: 'Cluster 2', full: 'Structural cluster 2',
      count: 4, relations: 4, depth: 2, parent: 'services', rect: { x: 522, y: 588, w: 158, h: 150 },
      members: ['adminReportExport.service.js', 'adminUser.service.js', 'auditLog.service.js', 'superviseeAssignment.service.js'],
      accent: 'teal',
      ai: {
        name: 'Administration & Reporting',
        description: 'Administration and report-oriented service modules. AI interpretation example only.'
      },
      basis: [
        ['adminUser.service.js', 'imports', 'auditLog.service.js'],
        ['adminReportExport.service.js', 'imports', 'auditLog.service.js']
      ]
    },
    {
      id: 'c3', kind: 'cluster', label: 'Cluster 3', full: 'Structural cluster 3',
      count: 2, relations: 1, depth: 2, parent: 'services', rect: { x: 694, y: 588, w: 158, h: 150 },
      members: ['topic.service.js', 'similarity.service.js'], accent: 'teal',
      ai: {
        name: 'Topic Similarity',
        description: 'Topic/similarity service pair. AI interpretation example only.'
      },
      basis: [['topic.service.js', 'imports', 'similarity.service.js']]
    },
    {
      id: 'c4', kind: 'cluster', label: 'Cluster 4', full: 'Structural cluster 4',
      count: 2, relations: 1, depth: 2, parent: 'services', rect: { x: 866, y: 588, w: 158, h: 150 },
      members: ['queue.service.js', 'worker.service.js'], accent: 'teal',
      ai: {
        name: 'Background Processing',
        description: 'Queue/worker pair. AI interpretation example only.'
      },
      basis: [['worker.service.js', 'imports', 'queue.service.js']]
    },
    {
      id: 'c5', kind: 'cluster', label: 'Cluster 5', full: 'Structural cluster 5',
      count: 2, relations: 1, depth: 2, parent: 'services', rect: { x: 1038, y: 588, w: 158, h: 150 },
      members: ['upload.service.js', 'storage.service.js'], accent: 'teal',
      ai: {
        name: 'Upload & Storage',
        description: 'Upload/storage pair. AI interpretation example only.'
      },
      basis: [['upload.service.js', 'imports', 'storage.service.js']]
    },
    {
      id: 'residual', kind: 'residual', label: '35 ungrouped modules', count: 35,
      depth: 2, parent: 'services', rect: { x: 350, y: 760, w: 846, h: 44 },
      members: ['contextSimilarity.service.js', 'readiness.service.js', 'cohort.service.js', 'feedback.service.js'],
      summary: 'No qualifying sibling relation cluster'
    }
  ];

  /*
    Aggregated relations. In production each count must be computed from
    concrete member-to-member deterministic relations, never inferred by AI.
  */
  const edges = [
    { id: 'e1', from: 'controllers', to: 'services', kind: 'imports', count: 38, anchor: { from: 'bottom', to: 'top' }, channel: { y: 478 } },
    { id: 'e2', from: 'middleware', to: 'services', kind: 'imports', count: 4, anchor: { from: 'left', to: 'right' }, channel: { x: 1252 } },
    { id: 'e3', from: 'controllers', to: 'middleware', kind: 'imports', count: 6, anchor: { from: 'right', to: 'left' }, channel: { y: 384 } },
    { id: 'e4', from: 'services', to: 'config', kind: 'imports', count: 12, anchor: { from: 'bottom', to: 'top' }, channel: { y: 844 } },
    { id: 'e5', from: 'services', to: 'utils', kind: 'calls', count: 9, anchor: { from: 'bottom', to: 'top' }, channel: { y: 844 } },
    { id: 'e6', from: 'tests', to: 'services', kind: 'imports', count: 22, anchor: { from: 'right', to: 'left' }, channel: { x: 316 } },
    { id: 'e7', from: 'fe-components', to: 'fe-app', kind: 'imports', count: 14, anchor: { from: 'right', to: 'left' }, channel: { y: 152 } },
    { id: 'e9', from: 'c2', to: 'c1', kind: 'imports', count: 3, anchor: { from: 'left', to: 'right' }, channel: { y: 566 } },
    { id: 'e10', from: 'c1', to: 'c3', kind: 'calls', count: 2, anchor: { from: 'top', to: 'top' }, channel: { y: 568 } },
    { id: 'e11', from: 'c4', to: 'c5', kind: 'imports', count: 1, anchor: { from: 'right', to: 'left' }, channel: { y: 748 } },
    { id: 'e12', from: 'c1', to: 'config', kind: 'imports', count: 4, anchor: { from: 'bottom', to: 'top' }, channel: { y: 840 } }
  ];

  /* Entity focus — deterministic one-hop context. */
  const entity = {
    id: 'auth.service.js', label: 'auth.service.js', kind: 'module',
    ancestry: ['Backend', 'services', 'Structural cluster 1'],
    incoming: [
      { label: 'auth.controller.js', relation: 'imports', group: 'controllers' },
      { label: 'auth.middleware.js', relation: 'imports', group: 'middleware' },
      { label: 'auth.test.js', relation: 'imports', group: 'tests' }
    ],
    outgoing: [
      { label: 'email.service.js', relation: 'imports', group: 'Structural cluster 1' },
      { label: 'notification.service.js', relation: 'calls', group: 'Structural cluster 1' },
      { label: 'auth.config.js', relation: 'imports', group: 'config' }
    ],
    statements: [
      { id: 's1', statement: 'calls notification.service.js when a session is created', status: 'supported', evidence: 3 },
      { id: 's2', statement: 'imports token verification from auth.config.js', status: 'supported', evidence: 2 },
      { id: 's3', statement: 'is reachable from the public HTTP surface', status: 'insufficient_evidence', evidence: 0 },
      { id: 's4', statement: 'writes directly to the audit log', status: 'contradicted', evidence: 1 }
    ]
  };

  /* Large-repository scale example: only top-level objects are rendered. */
  const large = {
    total: 2014,
    nodes: [
      { id: 'L-frontend', label: 'Frontend', path: 'frontend', count: 612, nested: 34, clusters: 11, rect: { x: 60, y: 60, w: 420, h: 210 } },
      { id: 'L-backend', label: 'Backend', path: 'backend', count: 848, nested: 52, clusters: 19, rect: { x: 540, y: 60, w: 470, h: 210 } },
      { id: 'L-shared', label: 'Shared packages', path: 'packages/shared', count: 214, nested: 12, clusters: 6, rect: { x: 1070, y: 60, w: 380, h: 210 } },
      { id: 'L-worker', label: 'Worker services', path: 'services/worker', count: 168, nested: 9, clusters: 4, rect: { x: 540, y: 330, w: 470, h: 190 } },
      { id: 'L-infra', label: 'Infrastructure', path: 'infra', count: 106, nested: 7, clusters: 2, rect: { x: 1070, y: 330, w: 380, h: 190 } },
      { id: 'L-tests', label: 'Tests', path: 'tests', count: 66, nested: 4, clusters: 1, rect: { x: 60, y: 330, w: 420, h: 190 } }
    ],
    edges: [
      { id: 'Le1', from: 'L-frontend', to: 'L-shared', kind: 'imports', count: 214 },
      { id: 'Le2', from: 'L-backend', to: 'L-shared', kind: 'imports', count: 331 },
      { id: 'Le3', from: 'L-backend', to: 'L-worker', kind: 'calls', count: 96 },
      { id: 'Le4', from: 'L-tests', to: 'L-backend', kind: 'imports', count: 402 },
      { id: 'Le5', from: 'L-worker', to: 'L-infra', kind: 'imports', count: 48 },
      { id: 'Le6', from: 'L-frontend', to: 'L-backend', kind: 'imports', count: 27 }
    ],
    canvas: { w: 1510, h: 580 }
  };

  const byId = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const childrenOf = (id) => nodes.filter((n) => n.parent === id);
  const ancestorsOf = (id) => {
    const out = [];
    let n = byId[id];
    while (n && n.parent) {
      out.unshift(n.parent);
      n = byId[n.parent];
    }
    return out;
  };

  /* Outline is deliberately secondary; it mirrors the map's scope. */
  const outline = (() => {
    const build = (parent) => childrenOf(parent).map((n) => ({
      id: n.id, label: n.label, path: n.path, kind: n.kind, count: n.count,
      relations: n.relations, ai: n.ai, children: build(n.id)
    }));
    return nodes.filter((n) => !n.parent).map((n) => ({
      id: n.id, label: n.label, path: n.path, kind: n.kind, count: n.count,
      ai: n.ai, children: build(n.id)
    }));
  })();

  return {
    CW, CH, nodes, edges, byId, childrenOf, ancestorsOf, entity, large, outline,
    modules: nodes.filter((n) => n.members).reduce((a, n) => a.concat(
      n.members.map((m) => ({ name: m, parent: n.id }))
    ), [])
  };
})();
