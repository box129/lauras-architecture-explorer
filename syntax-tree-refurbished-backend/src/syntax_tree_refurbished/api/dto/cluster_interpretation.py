from pydantic import BaseModel

from syntax_tree_refurbished.core.models.cluster_interpretation import ClusterInterpretation


class ClusterInterpretationResponse(BaseModel):
    analysis_run_id: str
    cluster_id: str
    status: str
    interpretation: ClusterInterpretation | None = None

