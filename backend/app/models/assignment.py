from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import ConfigDict
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Enum as SQLEnum, Field, SQLModel


class AssignmentMode(str, Enum):
    recommend = "recommend"
    auto = "auto"
    approval_required = "approval_required"


class AssignmentRecommendationStatus(str, Enum):
    draft = "draft"
    ready = "ready"
    approved = "approved"
    applied = "applied"
    rejected = "rejected"
    expired = "expired"
    superseded = "superseded"
    failed = "failed"


class AssignmentActionType(str, Enum):
    recommend = "recommend"
    apply = "apply"
    reject = "reject"
    override = "override"
    refresh = "refresh"
    policy_block = "policy_block"


class AssignmentRecommendation(SQLModel, table=True):
    __tablename__ = "assignment_recommendations"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: int = Field(foreign_key="projects.id", nullable=False, index=True)
    task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    recommended_user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    score: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    confidence: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    mode: AssignmentMode = Field(sa_column=Column(SQLEnum(AssignmentMode, name="assignment_mode"), nullable=False, index=True))
    status: AssignmentRecommendationStatus = Field(default=AssignmentRecommendationStatus.ready, sa_column=Column(SQLEnum(AssignmentRecommendationStatus, name="assignment_recommendation_status"), nullable=False, index=True))
    reasoning: str = Field(default="", sa_column=Column(Text, nullable=False, server_default=""))
    score_breakdown: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    policy_decision: str = Field(default="allow", sa_column=Column(String(length=64), nullable=False, server_default="allow", index=True))
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    approved_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    applied_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    rejected_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    expires_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class AssignmentScoreSnapshot(SQLModel, table=True):
    __tablename__ = "assignment_score_snapshots"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: int = Field(foreign_key="projects.id", nullable=False, index=True)
    task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    score: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    confidence: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    breakdown: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class UserCapacitySnapshot(SQLModel, table=True):
    __tablename__ = "user_capacity_snapshots"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    active_task_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    overdue_task_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    blocker_owner_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    deadline_pressure_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    estimated_effort_minutes: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    availability: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    timezone: str = Field(default="UTC", sa_column=Column(String(length=64), nullable=False, server_default="UTC"))
    role: str = Field(default="member", sa_column=Column(String(length=64), nullable=False, server_default="member"))
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class AssignmentAuditEvent(SQLModel, table=True):
    __tablename__ = "assignment_audit_events"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    task_id: Optional[int] = Field(default=None, foreign_key="tasks.id", nullable=True, index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    old_assignee_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    new_assignee_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    recommendation_id: Optional[int] = Field(default=None, foreign_key="assignment_recommendations.id", nullable=True, index=True)
    action_type: AssignmentActionType = Field(sa_column=Column(SQLEnum(AssignmentActionType, name="assignment_action_type"), nullable=False, index=True))
    score: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    confidence: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    policy_decision: str = Field(default="allow", sa_column=Column(String(length=64), nullable=False, server_default="allow", index=True))
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
