from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import ConfigDict
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Enum as SQLEnum, Field, SQLModel


class AgentSessionStatus(str, Enum):
    planning = "planning"
    awaiting_approval = "awaiting_approval"
    approved = "approved"
    executing = "executing"
    completed = "completed"
    failed = "failed"
    rejected = "rejected"
    rolled_back = "rolled_back"


class AgentStepAction(str, Enum):
    create_initiative = "create_initiative"
    create_project = "create_project"
    create_task = "create_task"
    create_subtask = "create_subtask"
    assign_user = "assign_user"
    set_deadline = "set_deadline"
    add_dependency = "add_dependency"
    update_entity = "update_entity"
    archive_entity = "archive_entity"


class AgentStepStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"
    executing = "executing"
    executed = "executed"
    failed = "failed"
    rolled_back = "rolled_back"
    skipped = "skipped"


class AgentApprovalDecision(str, Enum):
    approve = "approve"
    reject = "reject"
    edit_before_approve = "edit_before_approve"
    regenerate = "regenerate"


class AgentSession(SQLModel, table=True):
    __tablename__ = "agent_sessions"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    goal: str = Field(sa_column=Column(Text, nullable=False))
    normalized_goal: str = Field(sa_column=Column(Text, nullable=False))
    status: AgentSessionStatus = Field(
        default=AgentSessionStatus.planning,
        sa_column=Column(SQLEnum(AgentSessionStatus, name="agent_session_status"), nullable=False, index=True),
    )
    plan_version: int = Field(default=1, sa_column=Column(Integer, nullable=False, server_default="1"))
    confidence: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    model: Optional[str] = Field(default=None, sa_column=Column(String(length=128), nullable=True))
    assumptions: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    risks: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    required_approvals: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    context_summary: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    session_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class AgentPlanStep(SQLModel, table=True):
    __tablename__ = "agent_plan_steps"
    __table_args__ = (
        UniqueConstraint("session_id", "step_order", name="uq_agent_plan_step_order"),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="agent_sessions.id", nullable=False, index=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    step_order: int = Field(nullable=False)
    action: AgentStepAction = Field(sa_column=Column(SQLEnum(AgentStepAction, name="agent_step_action"), nullable=False, index=True))
    status: AgentStepStatus = Field(default=AgentStepStatus.proposed, sa_column=Column(SQLEnum(AgentStepStatus, name="agent_step_status"), nullable=False, index=True))
    entity_type: str = Field(sa_column=Column(String(length=64), nullable=False))
    entity_id: Optional[int] = Field(default=None, nullable=True, index=True)
    title: str = Field(sa_column=Column(String(length=512), nullable=False))
    summary: str = Field(sa_column=Column(Text, nullable=False))
    rationale: str = Field(sa_column=Column(Text, nullable=False))
    proposed_patch: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    current_snapshot: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    diff: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    requires_approval: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, server_default="true"))
    approved_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    approved_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    executed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    result: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class AgentApproval(SQLModel, table=True):
    __tablename__ = "agent_approvals"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="agent_sessions.id", nullable=False, index=True)
    step_id: Optional[int] = Field(default=None, foreign_key="agent_plan_steps.id", nullable=True, index=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    decision: AgentApprovalDecision = Field(sa_column=Column(SQLEnum(AgentApprovalDecision, name="agent_approval_decision"), nullable=False, index=True))
    reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    plan_version: int = Field(nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class AgentAuditEvent(SQLModel, table=True):
    __tablename__ = "agent_audit_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, foreign_key="agent_sessions.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    event_type: str = Field(sa_column=Column(String(length=128), nullable=False, index=True))
    prompt_hash: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True, index=True))
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    token_usage: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    model: Optional[str] = Field(default=None, sa_column=Column(String(length=128), nullable=True))
    latency_ms: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
