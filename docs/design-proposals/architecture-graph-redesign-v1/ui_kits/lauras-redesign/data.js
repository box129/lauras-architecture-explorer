/* Illustrative content for the design review.
   Structure and cluster figures are taken from the repository's own
   deterministic-capability exercise on topic-similarity-mvp
   (qa-audit/post-p2-architecture-gap-diagnosis/DETERMINISTIC_CAPABILITY.md).
   Statement, evidence and source text are DESIGN EXAMPLES, labelled as such
   in the UI — they are not recovered facts about that repository. */
window.LaurasData = {
  repo: { name: 'topic-similarity-mvp', path: '~/code/topic-similarity-mvp', modules: 51, regions: 1, sections: 6, clusters: 5, analysedAt: 'analysed 6 minutes ago' },
  recent: [
    { name: 'topic-similarity-mvp', path: '~/code/topic-similarity-mvp', meta: '51 modules · 6 minutes ago' },
    { name: 'flask', path: '~/code/flask', meta: '267 modules · yesterday' },
  ],
  stages: [
    { state: 'done', label: 'Reading source files' },
    { state: 'done', label: 'Extracting symbols' },
    { state: 'current', label: 'Recovering imports, calls and inheritance' },
    { state: 'waiting', label: 'Grouping by structure' },
    { state: 'waiting', label: 'Verifying architectural statements' },
  ],
  regions: [
    { id: 'root', path: 'Repository root files', modules: 2, members: ['server.js', 'server.test.js'] },
    { id: 'config', path: 'backend/src/config', modules: 7, members: ['db.config.js', 'mail.config.js', 'queue.config.js', 'auth.config.js', 'app.config.js'] },
    { id: 'controllers', path: 'backend/src/controllers', modules: 31, members: ['auth.controller.js', 'submission.controller.js', 'admin.controller.js', 'report.controller.js', 'user.controller.js'] },
    { id: 'middleware', path: 'backend/src/middleware', modules: 2, members: ['auth.middleware.js', 'error.middleware.js'] },
    { id: 'services', path: 'backend/src/services', modules: 50, clustered: true },
    { id: 'utils', path: 'backend/src/utils', modules: 5, members: ['logger.js', 'hash.js', 'dates.js', 'ids.js', 'validate.js'] },
  ],
  clusters: [
    { id: 'c1', label: 'Structural cluster 1', modules: 5, relations: 6, members: ['auth.service.js', 'email.service.js', 'notification.service.js', 'notificationEvent.service.js', 'submission.service.js'],
      ai: { name: 'Authentication & Sessions', description: 'Handles credential checks, token validation and the notifications sent when a session or submission changes state.' },
      basis: [['auth.service.js', 'imports', 'email.service.js'], ['auth.service.js', 'imports', 'notification.service.js'], ['notification.service.js', 'calls', 'notificationEvent.service.js'], ['submission.service.js', 'imports', 'notification.service.js']] },
    { id: 'c2', label: 'Structural cluster 2', modules: 4, relations: 4, members: ['adminReportExport.service.js', 'adminUser.service.js', 'auditLog.service.js', 'superviseeAssignment.service.js'],
      basis: [['adminUser.service.js', 'imports', 'auditLog.service.js'], ['adminReportExport.service.js', 'imports', 'auditLog.service.js']] },
    { id: 'c3', label: 'Structural cluster 3', modules: 2, relations: 1, members: ['topic.service.js', 'similarity.service.js'], basis: [['topic.service.js', 'imports', 'similarity.service.js']] },
    { id: 'c4', label: 'Structural cluster 4', modules: 2, relations: 1, members: ['queue.service.js', 'worker.service.js'], basis: [['worker.service.js', 'imports', 'queue.service.js']] },
    { id: 'c5', label: 'Structural cluster 5', modules: 2, relations: 1, members: ['upload.service.js', 'storage.service.js'], basis: [['upload.service.js', 'imports', 'storage.service.js']] },
  ],
  residual: { modules: 24, members: ['contextSimilarity.service.js', 'readiness.service.js', 'cohort.service.js', 'feedback.service.js', 'export.service.js'] },
  entity: {
    id: 'auth.service.js', label: 'auth.service.js', kind: 'module', ancestry: ['backend/src/services', 'Structural cluster 1'],
    dependents: [{ label: 'auth.controller.js', relation: 'imports', group: 'src/controllers' }, { label: 'auth.middleware.js', relation: 'imports', group: 'src/middleware' }],
    dependencies: [{ label: 'email.service.js', relation: 'imports', group: 'Structural cluster 1' }, { label: 'notification.service.js', relation: 'imports', group: 'Structural cluster 1' }, { label: 'auth.config.js', relation: 'imports', group: 'src/config' }],
    statements: [
      { id: 's1', statement: 'auth.service.js calls notification.service.js when a session is created', status: 'supported', relation: 'calls · direct_relation', evidenceCount: 3 },
      { id: 's2', statement: 'auth.service.js imports token verification from auth.config.js', status: 'supported', relation: 'imports · direct_relation', evidenceCount: 2 },
      { id: 's3', statement: 'auth.service.js is reachable from the public HTTP surface', status: 'insufficient_evidence', relation: 'reachability', evidenceCount: 0 },
      { id: 's4', statement: 'auth.service.js writes directly to the audit log', status: 'contradicted', relation: 'calls · direct_relation', evidenceCount: 1 },
    ],
  },
  /* Evidence is per-statement. INVARIANT: displayed statement = selected evidence = highlighted source.
     Each evidence item carries its own source window and highlight range; the source pane renders
     the ACTIVE evidence item, never a fixed excerpt. */
  evidenceByStatement: {
    s1: [
      { id: 's1e1', kind: 'call site', reason: 'js_call_extractor@0.4.1 observed the call', filePath: 'backend/src/services/auth.service.js', startLine: 112, highlightFrom: 119, highlightTo: 124,
        lines: ['const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");', '', 'async function createSession(user, context) {', '  const token = await issueToken(user);', '  await sessionRepo.save({ userId: user.id, token });', '', '  // notify the user that a new session was opened', '  await notification.send({', '    to: user.email,', '    template: "session.created",', '    context: { device: context.device },', '  });', '', '  return token;', '}'] },
      { id: 's1e2', kind: 'definition', reason: 'Resolved definition of the called export', filePath: 'backend/src/services/notification.service.js', startLine: 40, highlightFrom: 43, highlightTo: 49,
        lines: ['const mailer = require("./email.service");', 'const events = require("./notificationEvent.service");', '', 'async function send({ to, template, context }) {', '  const body = render(template, context);', '  await mailer.deliver({ to, body });', '  await events.record({ to, template });', '  return true;', '}', '', 'module.exports = { send };'] },
      { id: 's1e3', kind: 'import', reason: 'Import statement that binds the called module', filePath: 'backend/src/services/auth.service.js', startLine: 111, highlightFrom: 113, highlightTo: 113,
        lines: ['"use strict";', '', 'const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");'] },
    ],
    s2: [
      { id: 's2e1', kind: 'import', reason: 'js_import_extractor@0.4.1 resolved this require to backend/src/config/auth.config.js', filePath: 'backend/src/services/auth.service.js', startLine: 110, highlightFrom: 112, highlightTo: 112,
        lines: ['"use strict";', '', 'const { verifyToken } = require("../config/auth.config");', 'const notification = require("./notification.service");', '', 'async function createSession(user, context) {'] },
      { id: 's2e2', kind: 'definition', reason: 'Resolved definition of the imported binding verifyToken', filePath: 'backend/src/config/auth.config.js', startLine: 28, highlightFrom: 31, highlightTo: 36,
        lines: ['const jwt = require("jsonwebtoken");', '', 'const secret = process.env.AUTH_SECRET;', '', 'function verifyToken(token) {', '  return jwt.verify(token, secret);', '}', '', 'module.exports = { verifyToken, secret };'] },
    ],
    s3: [],
    s4: [
      { id: 's4e1', kind: 'counter-evidence', reason: 'No call to auditLog.service.js resolves from this module; the write happens in adminUser.service.js', filePath: 'backend/src/services/adminUser.service.js', startLine: 60, highlightFrom: 63, highlightTo: 66,
        lines: ['const auditLog = require("./auditLog.service");', '', 'async function deactivate(userId, actor) {', '  await userRepo.deactivate(userId);', '  await auditLog.write({ actor, action: "user.deactivate", userId });', '  return true;', '}'] },
    ],
  },
};
