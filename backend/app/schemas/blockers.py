from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel

from app.models.work_graph import WorkGraphBlockerSeverity, WorkGraphBlockerStatus


class BlockerCreate(BaseModel):
    task_id: int
    title: str
    reason: str | None = None
    severity: WorkGraphBlockerSeverity = WorkGraphBlockerSeverity.medium
    owner_user_id: int | None = None
    linked_entity_type: str | None = None
    linked_entity_id: int | None = None


class BlockerUpdate(BaseModel):
    title: str | None = None
    reason: str | None = None
    severity: WorkGraphBlockerSeverity | None = None
    owner_user_id: int | None = None
    linked_entity_type: str | None = None
    linked_entity_id: int | None = None


class BlockerResolveRequest(BaseModel):
    resolution_note: str | None = None


class BlockerRead(BaseModel):
    id: int
    task_id: int
    title: str
    reason: str | None = None
    severity: WorkGraphBlockerSeverity
    status: WorkGraphBlockerStatus
    owner_user_id: int | None = None
    project_id: int | None = None
    initiative_id: int | None = None
    linked_entity_type: str | None = None
    linked_entity_id: int | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BlockerListResponse(BaseModel):
    items: list[BlockerRead]
    total: int
