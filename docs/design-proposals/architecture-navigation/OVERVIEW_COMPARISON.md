# Overview Comparison — Option A vs Option B vs Hybrid

## Option A — clustered overview (`concept-01a-overview-clustered-map.png`)

Keeps existing structural entities (today: one node per file/module) visible, grouped into
visually differentiated clusters.

**Data support.** Strong. `structural_fallback.py` already implements a deterministic
`directory → file` grouping (`_directory_of`, `root_children`, `package_children`) — currently
wired only as a last-resort fallback, but the algorithm itself requires no new inference to
become the primary grouping. Cluster titles would be literal directory path fragments.

**Truthfulness.** High. A cluster boundary drawn around "all files in `routes/`" is a
verifiable, reproducible fact. Nothing is invented.

**Participant #1 fit.** Directly addresses "many visually similar boxes" and "no meaningful
categorization" by introducing *some* visual grouping — but only as strong as the repository's
own directory structure. A flat repository (most files in one directory, like Flask's
`src/flask/`) will still look mostly flat under Option A. This is an honest limitation, not a
bug to hide.

**Usability.** Moderate improvement. Reduces the "wall of boxes" for repositories with real
directory structure; does not fully solve it for shallow ones.

**Scalability.** Good — grouping is O(files), no LLM latency, no per-repo tuning.

**Implementation complexity.** Small–Medium: generalize an already-tested algorithm from
fallback-only to primary use, plus frontend cluster-container rendering.

**Cross-repository generality.** Strong — the underlying algorithm is language/shape-agnostic
within `SUPPORTED_LANGUAGES`, uses no keyword heuristics at all.

**Risk of misleading claims.** Low.

## Option B — domain-card overview (`concept-01b-overview-domain-cards.png`)

Abstracts the repository into fewer, larger, semantically-named cards ("Core Flask Framework",
"Request Lifecycle", etc.).

**Data support.** Weak, as currently implemented. The only code paths that can produce names
like these are (a) live LLM `component_hypotheses` — non-deterministic, and the map route is
deliberately hard-wired away from live models by default (`architecture_map.py:189-214`) — or
(b) `_architecture_label`/`_child_label`, a small hardcoded keyword list tuned for an
HTTP-client-library-shaped repository. Neither is safe to present as recovered fact.

**Truthfulness.** Low, if implemented with either of the above. The labels would look
authoritative while being either non-reproducible (LLM) or silently wrong on a differently-
shaped repo (heuristic).

**Participant #1 fit.** Best *visual* fit — closest to what a domain expert would draw by hand,
and the strongest reduction in card count/density.

**Usability.** Highest, if the labels were trustworthy. That "if" is the whole risk.

**Scalability.** Poor as an LLM-backed feature (latency, cost, per-run variance); fine as a
purely visual layout if fed by Option A's deterministic data instead.

**Implementation complexity.** Large, if it requires new inference to be trustworthy
(prompting, evaluation, drift-detection across re-runs); Medium, if it is Option A's data
inside Option B's card chrome (see Hybrid).

**Cross-repository generality.** Poor for the heuristic-keyword path (explicitly tuned to one
repo shape); moderate at best for the LLM path (quality varies with repo, model, and prompt).

**Risk of misleading claims.** High if shipped literally as shown in the mockup. The mockup's
own Flask example groups files that live in the *same* directory (`src/flask/app.py`,
`globals.py`, `config.py` all under "Core Runtime") — a split that cannot come from directory
structure at all, confirming it is semantic/LLM-authored, exactly the kind of invented
architectural fact `README.md:47-49` and the task brief warn against presenting as ground
truth.

## Recommendation: HYBRID

Use Option B's visual simplicity — fewer, larger cards, less initial density — but populate
and label those cards **only** using Option A's deterministic grouping data (directory
containment). Concretely:

- A "domain card" is a directory-rooted cluster (Option A's grouping), rendered with Option B's
  larger-card visual treatment (bigger card, member count, up to N representative files) rather
  than Option A's small-node-grid-inside-a-box treatment.
- The card title is the literal directory path (or, for the repository root's own files, an
  honest label like "Repository root files" — never a synthesized category name).
- No card carries invented narrative ("Handles incoming HTTP requests...") unless that text
  traces to a real `OverviewComponent.summary`/`LensChildComponent.summary` on an
  LLM-classified component the user explicitly opted into generating (out of scope for this
  pass — flagged as future, opt-in work in IMPLEMENTATION_PLAN.md).
- If a future phase wants genuine semantic domain names, that must be built, evaluated, and
  reviewed as a research feature (new inference, classification C) with its own accuracy
  evaluation — not silently folded into this UX redesign. Until then, any card whose grouping
  came from directory containment must visually read as *structural*, not *curated* (e.g. a
  monospace/path-styled title rather than Title Case prose).

### Why not pure Option A or pure Option B

- Pure Option A under-delivers on the mockups' visual promise for flat repositories and may
  still look dense for a repo with a moderately deep but wide directory tree.
- Pure Option B, if implemented literally, would reintroduce exactly the failure mode this
  review exists to prevent: presenting model output as architecture fact, with no way for a
  user to tell the difference (the same class of problem the project has already had to fix
  once for map-navigation LLM calls, and once for a node-icon heuristic overriding real
  classification).
- The Hybrid keeps the entire truthfulness guarantee of Option A while directly answering the
  Participant #1 complaint about card count and visual noise, which was fundamentally a density
  problem, not a naming problem — Participant #1 never said the categories were wrong; they
  said there weren't any *visible* categories at all.
