from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import ConfigDict
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Enum as SQLEnum, Field, SQLModel


class CommandIntent(str, Enum):
    ask_workspace = "ask_workspace"
    plan_project = "plan_project"
    summarize_project = "summarize_project"
    show_risks = "show_risks"
    reorder_tasks = "reorder_tasks"
    assign_tasks = "assign_tasks"
    impact_analysis = "impact_analysis"
    convert_meeting_notes = "convert_meeting_notes"
    create_tasks = "create_tasks"
    resolve_blockers = "resolve_blockers"
    project_cleanup = "project_cleanup"
    open_entity = "open_entity"


class CommandSessionStatus(str, Enum):
    interpreted = "interpreted"
    running = "running"
    awaiting_approval = "awaiting_approval"
    completed = "completed"
    failed = "failed"
    rejected = "rejected"


class CommandAuditAction(str, Enum):
    interpret = "interpret"
    execute = "execute"
    delegate = "delegate"
    policy_block = "policy_block"
    error = "error"


class CommandSession(SQLModel, table=True):
    __tablename__ = "command_sessions"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    command_text_hash: str = Field(sa_column=Column(String(length=64), nullable=False, index=True))
    command_preview: str = Field(sa_column=Column(Text, nullable=False, server_default=""))
    intent: CommandIntent = Field(sa_column=Column(SQLEnum(CommandIntent, name="command_intent"), nullable=False, index=True))
    confidence: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    status: CommandSessionStatus = Field(default=CommandSessionStatus.interpreted, sa_column=Column(SQLEnum(CommandSessionStatus, name="command_session_status"), nullable=False, index=True))
    required_context: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    suggested_actions: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    safety_flags: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    result: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    used_tools: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    approval_state: str = Field(default="not_required", sa_column=Column(String(length=64), nullable=False, server_default="not_required", index=True))
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    model: Optional[str] = Field(default=None, sa_column=Column(String(length=128), nullable=True))
    error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class CommandAuditEvent(SQLModel, table=True):
    __tablename__ = "command_audit_events"
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: Optional[int] = Field(default=None, foreign_key="command_sessions.id", nullable=True, index=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", nullable=True, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", nullable=True, index=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    action: CommandAuditAction = Field(sa_column=Column(SQLEnum(CommandAuditAction, name="command_audit_action"), nullable=False, index=True))
    intent: Optional[CommandIntent] = Field(default=None, sa_column=Column(SQLEnum(CommandIntent, name="command_intent", create_type=False), nullable=True, index=True))
    command_text_hash: Optional[str] = Field(default=None, sa_column=Column(String(length=64), nullable=True, index=True))
    used_tools: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    approval_state: str = Field(default="not_required", sa_column=Column(String(length=64), nullable=False, server_default="not_required", index=True))
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False, server_default="0"))
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
