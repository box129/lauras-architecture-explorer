"""Base repository abstraction for the toy fixture.

Declared here so that OrderRepository's direct base-class list is a
concrete, complete, AST-visible fact: useful for constructing a genuine
CONTRADICTED ground-truth case (see claim C10 in
../ground_truth/claims.json) from a closed structural relation (explicit
inheritance), rather than from the absence of some behavior in a method
body (compare claim C9, which this fixture intentionally treats as
insufficient_evidence, not contradicted, for exactly that reason).
"""


class InMemoryRepository:
    """Marker base class for repositories backed by in-process storage."""
