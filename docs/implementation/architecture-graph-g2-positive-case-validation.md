# G2C pinned relation-rich positive-case validation

## Acquisition and configuration

Fresh external, detached checkouts were created outside this repository at
`C:\Users\LENOVO T14\Development\lauras-g2-validation-repos`. No source was
vendored or modified. The exact research-pinned sources were:

| Repository | Upstream | Commit | Analysis root |
|---|---|---|---|
| Flask | `https://github.com/pallets/flask.git` | `6a2f545bfd8ed31e19066a299296917e034aca58` | `flask/src/flask` |
| Tenacity | `https://github.com/jd/tenacity.git` | `26f719dc73d3c5612b9c1b8d18a7883837790ad8` | `tenacity` |
| Stevedore | `https://github.com/openstack/stevedore.git` | `d3a55f33fb310f43833c7c3eb5ba417e46a9a928` | `stevedore` |

`topic-similarity-mvp` is referenced by historical design material, but no
legitimate upstream URL or pinned commit was found, so it was not acquired.

Each analysis used the current normal deterministic pipeline with
`Settings(environment="test")`; no LLM was configured or called. Current
production relation extraction emits calls and inheritance only; it does not
persist import relations. Re-running the cluster projection on every resulting
run produced byte-for-byte equal domain output.

## Current analyzer recovery

| Repository | Source files | Parsed entities | Module components | Resolved calls | Resolved inherits | Partial calls | Unresolved calls | Unresolved inherits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Flask | 26 | 430 | 24 | 189 | 18 | 3 | 932 | 20 |
| Tenacity | 92 | 663 | 20 | 595 | 38 | 14 | 1,462 | 37 |
| Stevedore | 114 | 228 | 38 | 33 | 6 | 0 | 534 | 29 |

There were no persisted `imports` relations. These totals include all relation
locations, not just relations internal to one clustering leaf.

## Eligible leaves, ranked by internal distinct module pairs

| Repository | Leaf | Modules | Participating | Records | Pairs | Calls / inherits | Bridges | Result |
|---|---|---:|---:|---:|---:|---|---:|---|
| Flask | Repository root files | 18 | 8 | 16 | 9 | 16 / 0 | 3 | one cluster of 5; 13 residual |
| Flask | `sansio` | 3 | 3 | 6 | 2 | 6 / 0 | 2 | no cluster; 3 residual |
| Flask | `json` | 3 | 2 | 2 | 1 | 2 / 0 | 1 | no cluster; 3 residual |
| Tenacity | `tenacity` | 10 | 4 | 9 | 3 | 8 / 1 | 3 | no cluster; 10 residual |
| Tenacity | `tests` | 7 | 3 | 15 | 2 | 15 / 0 | 2 | no cluster; 7 residual |
| Stevedore | `stevedore` | 10 | 4 | 5 | 3 | 5 / 0 | 3 | no cluster; 10 residual |
| Stevedore | `stevedore/example` | 6 | 0 | 0 | 0 | 0 / 0 | 0 | no cluster; 6 residual |
| Stevedore | `stevedore/example2` | 3 | 0 | 0 | 0 | 0 / 0 | 0 | no cluster; 3 residual |
| Stevedore | `stevedore/tests` | 16 | 0 | 0 | 0 | 0 / 0 | 0 | no cluster; 16 residual |

The positive-case gate (at least three participating modules and at least three
internal pairs) was met by Flask root files, Tenacity, and Stevedore. Flask is
the only one with a non-bridge core.

## Unchanged G2 algorithm outcome

Flask's root-file leaf yielded one deterministic cluster:

| Display order | Run-scoped deterministic ID | Members | Internal records / pairs | Density | Boundary records / pairs | Boundary ratio |
|---|---|---|---:|---:|---:|---:|
| Structural cluster 1 | `architecture-cluster:c625b61b6cf0f3a2b6b7e972` | `app.py`, `blueprints.py`, `cli.py`, `ctx.py`, `helpers.py` | 13 / 6 | 0.60 | 3 / 3 | 0.33 |

The region has 27.8% module coverage (5/18) and 62.5% participation coverage
(5/8). Its 13 residual modules split into ten with no internal resolved
relation and three that are only bridge-connected/below the minimum core.
There are no cluster-to-cluster edges because there is one cluster.

Tenacity and Stevedore each have four participating modules and three pair
edges, but every pair is a bridge. Bridge removal yields only singletons, so
their zero-cluster result is intentional rather than a failure to process
relation-rich input. Flask `sansio` similarly has a three-module chain, not a
core. Repeated projection equality was true for all three repositories.

## Source-backed topology sanity review

The Flask cluster members are joined by real resolved calls, including
`app.py → helpers.py`, `app.py → ctx.py`, `blueprints.py → cli.py`,
`blueprints.py → helpers.py`, `cli.py → helpers.py`, and `ctx.py → helpers.py`.
Examples were inspected directly from recovered relations: `Flask.send_static_file`
calls `helpers.send_from_directory`; `Flask.app_context` calls `ctx.AppContext`;
and `Blueprint.__init__` calls `cli.AppGroup`. Thus the member topology has
multiple non-bridge paths; it is not a star/hub artifact. The three internal
boundary pairs remain excluded from the core membership by bridge removal.

This is visibly more informative than one 18-module directory bucket while
remaining a neutral relation-derived subdivision. No semantic label is assigned.

## Analyzer coverage diagnosis and historical comparison

The high unresolved-call totals show a substantial source of additional
potential relation input, but they do not establish that all unresolved calls
are safely recoverable. The observed constraints are primarily parser/extractor
resolution limits and the absence of import-relation production. Some resolved
relations also cross structural leaves, so leaf partitioning reduces the amount
available to a given cluster. The zero-relation example/test leaves may be
genuinely sparse or outside current resolver coverage.

Additional deterministic relation recovery would **likely** materially improve
clustering input, especially resolved imports and safely resolvable calls; this
is a coverage conclusion only, not authorization to implement extraction in
G2C.

Historical pilot records legitimately establish that these exact commits were
already used for deterministic provenance evaluations: Flask had strong
coverage; Tenacity gained inheritance-aware self-method recovery; Stevedore had
known generic-inheritance and `super()` limitations. The fresh measurements
above are independent current production results, not imported historical
relations. Their pattern is consistent with—but does not re-score or replace—
those prior reports.

## Decision and limitations

**READY_FOR_G3.** The unchanged algorithm recovers a non-artificial,
multiply-connected deterministic cluster in a realistic pinned repository and
abstains on weak bridge-only regions. This is evidence for a cautious G3
integration, not a population-level generalization. One positive repository
region is insufficient to compare alternative algorithms or establish broad
repository coverage. Topic-similarity-mvp remains unvalidated until legitimate
pinned source metadata is supplied.

Reusable validation tooling: `scripts/validate_g2_clusters.py`.
