from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import ConfigDict
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Enum as SQLEnum, Field, SQLModel


class WorkGraphNodeType(str, Enum):
    initiative = "initiative"
    project = "project"
    task = "task"
    subtask = "subtask"
    document = "document"
    comment = "comment"
    user = "user"
    deadline = "deadline"
    dependency = "dependency"
    blocker = "blocker"
    skill = "skill"
    deliverable = "deliverable"
    milestone = "milestone"
    agent_step = "agent_step"


class WorkGraphEdgeType(str, Enum):
    depends_on = "depends_on"
    blocks = "blocks"
    owned_by = "owned_by"
    assigned_to = "assigned_to"
    mentions = "mentions"
    documents = "documents"
    derived_from = "derived_from"
    contains = "contains"
    part_of = "part_of"
    requires_skill = "requires_skill"
    has_deadline = "has_deadline"
    impacts = "impacts"
    duplicates = "duplicates"
    conflicts_with = "conflicts_with"
    generated_by_agent = "generated_by_agent"


class WorkGraphBlockerSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class WorkGraphBlockerStatus(str, Enum):
    open = "open"
    resolved = "resolved"
    ignored = "ignored"


class WorkGraphNode(SQLModel, table=True):
    __tablename__ = "work_graph_nodes"
    __table_args__ = (
        UniqueConstraint("guild_id", "entity_type", "entity_id", name="uq_work_graph_node_entity"),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    entity_type: WorkGraphNodeType = Field(sa_column=Column(SQLEnum(WorkGraphNodeType, name="work_graph_node_type"), nullable=False, index=True))
    entity_id: int = Field(nullable=False, index=True)
    label: str = Field(sa_column=Column(String(length=512), nullable=False))
    status: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True, index=True))
    priority: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True, index=True))
    owner_user_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    deadline_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))
    graph_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class WorkGraphEdge(SQLModel, table=True):
    __tablename__ = "work_graph_edges"
    __table_args__ = (
        UniqueConstraint("guild_id", "source_node_id", "target_node_id", "edge_type", name="uq_work_graph_edge_identity"),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    source_node_id: int = Field(foreign_key="work_graph_nodes.id", nullable=False, index=True)
    target_node_id: int = Field(foreign_key="work_graph_nodes.id", nullable=False, index=True)
    edge_type: WorkGraphEdgeType = Field(sa_column=Column(SQLEnum(WorkGraphEdgeType, name="work_graph_edge_type"), nullable=False, index=True))
    weight: float = Field(default=1.0, sa_column=Column(Float, nullable=False, server_default="1"))
    confidence: float = Field(default=1.0, sa_column=Column(Float, nullable=False, server_default="1"))
    is_blocking: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="false", index=True))
    lag_minutes: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    graph_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class WorkGraphSnapshot(SQLModel, table=True):
    __tablename__ = "work_graph_snapshots"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    graph_version: str = Field(sa_column=Column(String(length=128), nullable=False, index=True))
    node_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    edge_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    status: str = Field(default="completed", sa_column=Column(String(length=64), nullable=False, server_default="completed", index=True))
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class WorkGraphImpactRun(SQLModel, table=True):
    __tablename__ = "work_graph_impact_runs"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    start_node_id: int = Field(foreign_key="work_graph_nodes.id", nullable=False, index=True)
    query_type: str = Field(sa_column=Column(String(length=64), nullable=False, index=True))
    traversal_depth: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    impacted_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    result: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class WorkGraphRiskScore(SQLModel, table=True):
    __tablename__ = "work_graph_risk_scores"
    __table_args__ = (
        UniqueConstraint("guild_id", "node_id", name="uq_work_graph_risk_node"),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    node_id: int = Field(foreign_key="work_graph_nodes.id", nullable=False, index=True)
    score: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    level: str = Field(default="low", sa_column=Column(String(length=32), nullable=False, server_default="low", index=True))
    factors: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class WorkGraphAuditEvent(SQLModel, table=True):
    __tablename__ = "work_graph_audit_events"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True, index=True)
    entity_id: Optional[int] = Field(default=None, nullable=True, index=True)
    action_type: str = Field(sa_column=Column(String(length=128), nullable=False, index=True))
    before_state_hash: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True))
    after_state_hash: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True))
    traversal_depth: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    impacted_count: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    policy_decision: str = Field(default="allow", sa_column=Column(String(length=64), nullable=False, server_default="allow"))
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class TaskDependency(SQLModel, table=True):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        UniqueConstraint("guild_id", "source_task_id", "target_task_id", name="uq_task_dependency_pair"),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    source_task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    target_task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    lag_minutes: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class TaskBlocker(SQLModel, table=True):
    __tablename__ = "task_blockers"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    title: str = Field(sa_column=Column(String(length=512), nullable=False))
    reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    severity: WorkGraphBlockerSeverity = Field(default=WorkGraphBlockerSeverity.medium, sa_column=Column(SQLEnum(WorkGraphBlockerSeverity, name="work_graph_blocker_severity"), nullable=False, index=True))
    status: WorkGraphBlockerStatus = Field(default=WorkGraphBlockerStatus.open, sa_column=Column(SQLEnum(WorkGraphBlockerStatus, name="work_graph_blocker_status"), nullable=False, index=True))
    owner_user_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    resolved_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    linked_entity_type: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True))
    linked_entity_id: Optional[int] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class Skill(SQLModel, table=True):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("guild_id", "name", name="uq_skill_guild_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    name: str = Field(sa_column=Column(String(length=120), nullable=False, index=True))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class UserSkill(SQLModel, table=True):
    __tablename__ = "user_skills"
    __table_args__ = (UniqueConstraint("guild_id", "user_id", "skill_id", name="uq_user_skill"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    skill_id: int = Field(foreign_key="skills.id", nullable=False, index=True)
    level: int = Field(default=1, sa_column=Column(Integer, nullable=False, server_default="1"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class TaskRequiredSkill(SQLModel, table=True):
    __tablename__ = "task_required_skills"
    __table_args__ = (UniqueConstraint("guild_id", "task_id", "skill_id", name="uq_task_required_skill"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    task_id: int = Field(foreign_key="tasks.id", nullable=False, index=True)
    skill_id: int = Field(foreign_key="skills.id", nullable=False, index=True)
    required_level: int = Field(default=1, sa_column=Column(Integer, nullable=False, server_default="1"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
