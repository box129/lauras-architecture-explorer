"""Claim-level provenance contract layer.

New, narrowly-scoped subpackage: adapts already-computed grounding/lens
data (see core.models.grounding, core.models.lens) into the claim-level
provenance shapes defined in core.models.provenance. This package does not
discover or infer new architectural claims — it reshapes claims a lens
already carries. See claim_projection.py for the one function this package
currently exposes.
"""

from __future__ import annotations
