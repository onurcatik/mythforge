from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field

from app.models.agent import AgentApprovalDecision, AgentSessionStatus, AgentStepAction, AgentStepStatus
from app.schemas.base import SanitizedBaseModel


class AgentPlanRequest(SanitizedBaseModel):
    goal: str = Field(min_length=3, max_length=4000)
    initiative_id: int | None = None
    project_id: int | None = None
    max_steps: int = Field(default=18, ge=3, le=60)
    confidence_threshold: float = Field(default=0.55, ge=0, le=1)
    dry_run: bool = True


class AgentRisk(SanitizedBaseModel):
    severity: Literal["low", "medium", "high"] = "medium"
    title: str
    mitigation: str


class AgentAssigneeSuggestion(SanitizedBaseModel):
    user_id: int | None = None
    display_name: str | None = None
    reason: str
    confidence: float = Field(default=0.5, ge=0, le=1)


class AgentDeadlineSuggestion(SanitizedBaseModel):
    due_date: datetime | None = None
    reason: str
    confidence: float = Field(default=0.5, ge=0, le=1)


class AgentPlanStepRead(SanitizedBaseModel):
    model_config = ConfigDict(from_attributes=True, json_schema_serialization_defaults_required=True)

    id: int | None = None
    step_order: int
    action: AgentStepAction
    status: AgentStepStatus
    entity_type: str
    entity_id: int | None = None
    title: str
    summary: str
    rationale: str
    proposed_patch: dict[str, Any]
    current_snapshot: dict[str, Any]
    diff: dict[str, Any]
    requires_approval: bool
    project_id: int | None = None
    initiative_id: int | None = None
    result: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class AgentPlanResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    status: AgentSessionStatus
    plan_version: int
    goal: str
    normalized_goal: str
    assumptions: list[str]
    initiative_patch: dict[str, Any] = Field(default_factory=dict)
    project_patches: list[dict[str, Any]] = Field(default_factory=list)
    task_patches: list[dict[str, Any]] = Field(default_factory=list)
    subtask_patches: list[dict[str, Any]] = Field(default_factory=list)
    dependencies: list[dict[str, Any]] = Field(default_factory=list)
    assignee_suggestions: list[AgentAssigneeSuggestion] = Field(default_factory=list)
    deadline_suggestions: list[AgentDeadlineSuggestion] = Field(default_factory=list)
    risks: list[AgentRisk]
    required_approvals: list[str]
    diff_summary: str
    confidence: float = Field(ge=0, le=1)
    context_summary: list[dict[str, Any]] = Field(default_factory=list)
    steps: list[AgentPlanStepRead]


class AgentDiffRequest(SanitizedBaseModel):
    session_id: int


class AgentDiffResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    plan_version: int
    diff_summary: str
    steps: list[AgentPlanStepRead]


class AgentApprovalRequest(SanitizedBaseModel):
    session_id: int
    step_ids: list[int] | None = None
    decision: AgentApprovalDecision = AgentApprovalDecision.approve
    reason: str | None = Field(default=None, max_length=2000)
    expected_plan_version: int


class AgentApprovalResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    status: AgentSessionStatus
    approved_step_ids: list[int]
    rejected_step_ids: list[int]
    plan_version: int


class AgentExecuteRequest(SanitizedBaseModel):
    session_id: int
    step_ids: list[int] | None = None
    expected_plan_version: int


class AgentExecutionResult(SanitizedBaseModel):
    step_id: int
    action: AgentStepAction
    status: AgentStepStatus
    entity_type: str
    entity_id: int | None = None
    link: str | None = None
    error: str | None = None
    result: dict[str, Any] = Field(default_factory=dict)


class AgentExecuteResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    status: AgentSessionStatus
    executed: list[AgentExecutionResult]
    skipped: list[AgentExecutionResult]
    rollback_available: bool


class AgentRejectRequest(SanitizedBaseModel):
    session_id: int
    reason: str | None = Field(default=None, max_length=2000)
    expected_plan_version: int


class AgentRollbackRequest(SanitizedBaseModel):
    session_id: int
    step_ids: list[int] | None = None
    reason: str | None = Field(default=None, max_length=2000)


class AgentRollbackResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    status: AgentSessionStatus
    rolled_back_step_ids: list[int]
    failed_step_ids: list[int]


class AgentSessionRead(AgentPlanResponse):
    created_at: datetime
    updated_at: datetime


class AgentAuditEventRead(SanitizedBaseModel):
    model_config = ConfigDict(from_attributes=True, json_schema_serialization_defaults_required=True)

    id: int
    session_id: int | None
    event_type: str
    payload: dict[str, Any]
    model: str | None = None
    latency_ms: float | None = None
    created_at: datetime


class AgentAuditResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    events: list[AgentAuditEventRead]


class AgentHealthResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    enabled: bool
    status: Literal["ok", "degraded", "disabled"]
    planning_requires_approval: bool = True
    write_without_approval: bool = False
    policy: dict[str, Any]


class AgentEvaluationRequest(SanitizedBaseModel):
    session_id: int | None = None
    samples: list[dict[str, Any]] = Field(default_factory=list, max_length=50)


class AgentEvaluationResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    goal_coverage: float
    task_decomposition_accuracy: float
    assignee_suitability: float
    deadline_realism: float
    dependency_correctness: float
    approval_success_rate: float
    rollback_rate: float
    user_edit_distance: float
    evaluated_samples: int
    notes: list[str]
