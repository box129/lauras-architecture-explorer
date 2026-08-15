"""Provenance-evaluation harness.

A small, self-contained, dependency-light (stdlib only) framework for
scoring claim-level provenance -- i.e. for taking a set of
(claim, support_status, evidence[]) records produced by *any* system
(hand-written, an LLM, whatever) and computing objective metrics against
known ground truth for a fixture codebase.

See ``schema.py`` for the data model and loaders, and ``metrics.py`` for
the scoring functions. ``research/provenance-evaluation/run_example.py``
and ``research/provenance-evaluation/tests/test_metrics_e2e.py`` are
runnable end-to-end examples.

This package does NOT depend on, or need, the real ArchitecturalClaim /
EvidenceItem domain model being defined elsewhere in this initiative. Field
names here (claim_id, text, epistemic_type, support_status, evidence,
source_span / relationship evidence types) are deliberately kept close to
that vocabulary so a future wiring-up is a rename, not a redesign, but this
package works standalone against its own minimal schema.
"""
