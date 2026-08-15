"""Optional, non-deterministic interpretation of a fixed architecture cluster."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ClusterInterpretation:
    cluster_id: str
    label: str
    description: str
    provider: str
    model: str

