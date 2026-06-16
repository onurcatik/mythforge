from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.assignment import AssignmentMode, AssignmentRecommendationStatus


class AssignmentScoreBreakdown(BaseModel):
    skill_match: float = 0.0
    role_match: float = 0.0
    workload_balance: float = 0.0
    deadline_feasibility: float = 0.0
    historical_delivery: float = 0.0
    priority_fit: float = 0.0
    timezone_fit: float = 0.0
    blocker_load: float = 0.0
    graph_risk_fit: float = 0.0
    fairness_fit: float = 0.0
    raw: dict[str, Any] = Field(default_factory=dict)


class AssignmentRecommendationRead(BaseModel):
    id: int | None = None
    task_id: int
    recommended_user_id: int
    recommended_user_name: str | None = None
    score: float
    confidence: float
    mode: AssignmentMode
    status: AssignmentRecommendationStatus
    reasoning: str
    score_breakdown: dict[str, Any]
    policy_decision: str
    created_at: datetime | None = None
    applied_at: datetime | None = None
    rejected_at: datetime | None = None


class AssignmentRecommendRequest(BaseModel):
    task_id: int
    auto_apply: bool = False
    force_refresh: bool = False
    confidence_threshold: float = Field(default=0.72, ge=0.0, le=1.0)


class AssignmentRecommendResponse(BaseModel):
    recommendation: AssignmentRecommendationRead | None
    candidates: list[AssignmentRecommendationRead]
    policy: dict[str, Any]
    graph_impact: dict[str, Any] = Field(default_factory=dict)


class AssignmentApplyRequest(BaseModel):
    recommendation_id: int
    require_approval_override: bool = False


class AssignmentApplyResponse(BaseModel):
    applied: bool
    task_id: int
    assignee_id: int | None
    recommendation_id: int
    status: AssignmentRecommendationStatus
    message: str
    requires_approval: bool = False


class AssignmentRejectRequest(BaseModel):
    recommendation_id: int
    reason: str | None = None


class AssignmentCapacityItem(BaseModel):
    user_id: int
    user_name: str | None = None
    active_task_count: int
    overdue_task_count: int
    blocker_owner_count: int
    deadline_pressure_count: int
    estimated_effort_minutes: int
    timezone: str
    role: str
    calculated_at: datetime | None = None


class AssignmentCapacityResponse(BaseModel):
    items: list[AssignmentCapacityItem]
    generated_at: datetime


class AssignmentHealthResponse(BaseModel):
    enabled: bool
    status: Literal["ok", "degraded"]
    policy: dict[str, Any]
    recommendations: int
    capacity_snapshots: int


class AssignmentAuditResponse(BaseModel):
    events: list[dict[str, Any]]
