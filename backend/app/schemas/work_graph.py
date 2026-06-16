from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.work_graph import WorkGraphEdgeType, WorkGraphNodeType


class WorkGraphNodeRead(BaseModel):
    id: int
    entity_type: WorkGraphNodeType
    entity_id: int
    label: str
    status: str | None = None
    priority: str | None = None
    owner_user_id: int | None = None
    deadline_at: datetime | None = None
    project_id: int | None = None
    initiative_id: int | None = None
    score: float | None = None
    link: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkGraphEdgeRead(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    edge_type: WorkGraphEdgeType
    weight: float
    confidence: float
    is_blocking: bool
    lag_minutes: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkGraphNodesResponse(BaseModel):
    nodes: list[WorkGraphNodeRead]
    total: int


class WorkGraphEdgesResponse(BaseModel):
    edges: list[WorkGraphEdgeRead]
    total: int


class WorkGraphRebuildRequest(BaseModel):
    initiative_id: int | None = None
    project_id: int | None = None
    dry_run: bool = False


class WorkGraphSyncRequest(BaseModel):
    entity_type: WorkGraphNodeType
    entity_id: int


class WorkGraphRebuildResponse(BaseModel):
    queued: bool = False
    dry_run: bool = False
    nodes_synced: int = 0
    edges_synced: int = 0
    snapshot_id: int | None = None
    message: str


class WorkGraphImpactRequest(BaseModel):
    entity_type: WorkGraphNodeType = WorkGraphNodeType.task
    entity_id: int
    direction: Literal["downstream", "upstream", "both"] = "downstream"
    max_depth: int = Field(default=5, ge=1, le=10)
    include_recommendations: bool = True


class WorkGraphImpactResponse(BaseModel):
    run_id: int | None = None
    start_node: WorkGraphNodeRead
    directly_impacted: list[WorkGraphNodeRead]
    indirectly_impacted: list[WorkGraphNodeRead]
    critical_path_impacted: list[WorkGraphNodeRead]
    blocked_by: list[WorkGraphNodeRead]
    blocking: list[WorkGraphNodeRead]
    at_risk_deadlines: list[WorkGraphNodeRead]
    affected_deliverables: list[WorkGraphNodeRead]
    affected_users: list[WorkGraphNodeRead]
    blast_radius: dict[str, int]
    cycles: list[list[int]] = Field(default_factory=list)
    confidence: float
    recommended_actions: list[str]
    latency_ms: float


class WorkGraphCriticalPathResponse(BaseModel):
    scope: dict[str, int | None]
    chains: list[list[WorkGraphNodeRead]]
    fragile_nodes: list[WorkGraphNodeRead]
    recommended_actions: list[str]


class WorkGraphRiskItem(BaseModel):
    node: WorkGraphNodeRead
    score: float
    level: Literal["low", "medium", "high", "critical"]
    factors: dict[str, Any]


class WorkGraphRiskMapResponse(BaseModel):
    items: list[WorkGraphRiskItem]
    by_project: dict[str, float]
    by_assignee: dict[str, float]
    by_deadline: dict[str, float]
    by_blocker: dict[str, float]


class WorkGraphHealthResponse(BaseModel):
    enabled: bool
    status: Literal["ok", "degraded"]
    nodes: int
    edges: int
    open_blockers: int
    dependencies: int
    policy: dict[str, Any]


class WorkGraphAuditResponse(BaseModel):
    events: list[dict[str, Any]]
