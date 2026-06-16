from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class DependencyCreate(BaseModel):
    source_task_id: int
    target_task_id: int
    lag_minutes: int = Field(default=0, ge=0)


class DependencyUpdate(BaseModel):
    lag_minutes: int | None = Field(default=None, ge=0)


class DependencyRead(BaseModel):
    id: int
    source_task_id: int
    target_task_id: int
    lag_minutes: int
    project_id: int | None = None
    initiative_id: int | None = None
    created_at: datetime


class DependencyListResponse(BaseModel):
    items: list[DependencyRead]
    total: int
