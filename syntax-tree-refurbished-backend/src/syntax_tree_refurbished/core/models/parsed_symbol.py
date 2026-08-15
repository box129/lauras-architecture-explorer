"""Parsed symbol domain model.

## Stable identity vs. run-scoped identity

``ParsedSymbol.id`` (together with the ``run_id`` field) is *run-scoped*
identity: it is deterministic and unique **within** one analysis run, but it
is deliberately allowed -- by design, not by accident -- to come out
different across two separate analyses of byte-identical source code. That
is because the run-scoped id hash includes ``run_id``, and a fresh random
``run_id`` (``run:{uuid4().hex}``) is minted for every analysis run (see
``app/analysis/analysis_controller.py::AnalysisController.start_or_reuse``).
This randomness is exactly what "run isolation" means operationally in this
backend: two runs never accidentally share an id space, and
``app/grounding/citation_validator.py`` explicitly rejects a symbol/region
whose ``run_id`` does not match the requesting run. Nothing about that
behavior changes here.

``stable_entity_key`` is a second, complementary identity that answers a
different question: "is this the same logical symbol as one seen in a prior
(or future) analysis of the same code?" It is computed by
``compute_stable_entity_key`` from only the facts about a symbol that do not
change when the exact same source is re-analyzed -- repository-relative
``path``, ``qualified_name``, ``kind``, and ``signature`` -- and it
deliberately excludes ``run_id``, line numbers, and anything else that is
either run-specific or could shift due to unrelated edits elsewhere in the
file. Re-analyzing identical source, whether in the same run or in two
completely independent runs, yields the same ``stable_entity_key`` for "the
same" symbol. ``id``/``run_id`` still differ across runs as before.

### Compatibility / migration notes

* ``ParsedSymbol.id`` keeps its existing run-scoped meaning and existing
  value for every existing caller. This change is purely additive: no
  existing field was renamed, removed, or reinterpreted.
* ``stable_entity_key`` defaults to ``""`` specifically so that rows
  persisted *before* this change continue to round-trip. This backend
  persists ``ParsedSymbol`` via ``app/analysis/sqlite_run_store.py``, which
  serializes with ``dataclasses.asdict`` and rehydrates with
  ``ParsedSymbol(**row)``; without a default, old rows (which have no
  ``stable_entity_key`` key in their JSON payload) would raise
  ``TypeError`` on restore. An empty string means "this row predates
  stable identity" -- treat it as "no stable key available", not as a
  real, comparable key. Old rows are not retroactively backfilled; the
  next re-analysis of the same repository will produce fresh symbols with
  a populated ``stable_entity_key``.
* Any caller that was trying to recognize "the same" symbol across two
  analysis runs by comparing ``ParsedSymbol.id`` was relying on behavior
  the backend never provided (ids differ by run_id and will never match
  across runs). Such callers should switch to comparing
  ``stable_entity_key`` for cross-run correlation, caching, or diffing,
  while continuing to use ``id`` for anything scoped to a single run (for
  example resolving ``parent_symbol_id``, or citing a specific run's
  ``SourceRegion`` snapshot).
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from typing import Literal


SymbolKind = Literal["module", "class", "function", "method", "interface", "type_alias", "variable"]


@dataclass(frozen=True)
class ParsedSymbol:
    id: str
    run_id: str
    path: str
    language: str
    name: str
    qualified_name: str
    kind: SymbolKind
    start_line: int
    end_line: int
    source_region_id: str
    signature: str
    exported: bool
    async_: bool
    parent_symbol_id: str | None = None
    stable_entity_key: str = ""


def compute_stable_entity_key(
    *,
    path: str,
    qualified_name: str,
    kind: str,
    signature: str,
) -> str:
    """Compute a cross-run-stable logical identity key for a symbol.

    Deliberately excludes ``run_id``, line numbers, and any other input
    that is either run-specific or could shift because of an unrelated
    edit elsewhere in the file. Only facts that describe *what the symbol
    is* -- not *when or in which run it was observed* -- go into the hash,
    so re-analyzing the same unchanged source (in the same run, in a later
    run, or on a different machine) always yields the same key for what is
    logically the same symbol.

    ``path`` must be a repository-relative path (as produced by
    ``abs_path.relative_to(root).as_posix()`` in
    ``infra/filesystem/local_repo_reader.py``) rather than an absolute
    filesystem path, so the key does not vary machine-to-machine.
    """
    raw = "|".join([path, qualified_name, kind, signature])
    return f"entity:{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:24]}"
