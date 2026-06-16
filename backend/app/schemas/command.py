from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field

from app.models.command import CommandIntent, CommandSessionStatus
from app.schemas.base import SanitizedBaseModel


class CommandContext(SanitizedBaseModel):
    initiative_id: int | None = None
    project_id: int | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    route: str | None = None
    selected_filters: dict[str, Any] = Field(default_factory=dict)


class CommandInterpretRequest(SanitizedBaseModel):
    command: str = Field(min_length=2, max_length=6000)
    context: CommandContext = Field(default_factory=CommandContext)


class CommandSuggestedAction(SanitizedBaseModel):
    action_id: str
    label: str
    intent: CommandIntent
    requires_approval: bool = False
    reason: str | None = None


class CommandInterpretResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    intent: CommandIntent
    confidence: float = Field(ge=0, le=1)
    required_context: dict[str, Any]
    suggested_actions: list[CommandSuggestedAction]
    safety_flags: list[str]
    execution_mode: Literal["read_only", "approval_required", "navigation"]
    message: str


class CommandExecuteRequest(CommandInterpretRequest):
    intent: CommandIntent | None = None
    dry_run: bool = False


class CommandSourceCard(SanitizedBaseModel):
    source_type: str
    source_id: int | None = None
    title: str
    excerpt: str | None = None
    link: str | None = None
    score: float | None = None


class CommandResultCard(SanitizedBaseModel):
    title: str
    description: str | None = None
    kind: str = "info"
    score: float | None = None
    link: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommandResult(SanitizedBaseModel):
    type: Literal["answer", "agent_plan", "risk_map", "assignment", "impact", "cleanup", "navigation", "error"]
    title: str
    summary: str
    cards: list[CommandResultCard] = Field(default_factory=list)
    sources: list[CommandSourceCard] = Field(default_factory=list)
    table: list[dict[str, Any]] = Field(default_factory=list)
    diff: dict[str, Any] | None = None
    suggested_actions: list[CommandSuggestedAction] = Field(default_factory=list)
    approval_state: str = "not_required"
    raw: dict[str, Any] = Field(default_factory=dict)


class CommandExecuteResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    session_id: int
    status: CommandSessionStatus
    intent: CommandIntent
    confidence: float = Field(ge=0, le=1)
    used_tools: list[str]
    approval_state: str
    latency_ms: float
    result: CommandResult
    safety_flags: list[str]


class CommandSessionRead(SanitizedBaseModel):
    id: int
    intent: CommandIntent
    status: CommandSessionStatus
    confidence: float
    command_preview: str
    required_context: dict[str, Any]
    suggested_actions: list[dict[str, Any]]
    safety_flags: list[str]
    result: dict[str, Any]
    used_tools: list[str]
    approval_state: str
    latency_ms: float
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class CommandHistoryResponse(SanitizedBaseModel):
    items: list[CommandSessionRead]


class CommandHealthResponse(SanitizedBaseModel):
    enabled: bool
    status: Literal["ok", "degraded"]
    supported_intents: list[CommandIntent]
    policy: dict[str, Any]
