from __future__ import annotations

from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.work_graph import WorkGraphAuditEvent


async def record_event(
    session: AsyncSession,
    *,
    guild_id: int,
    action_type: str,
    user_id: int | None = None,
    initiative_id: int | None = None,
    project_id: int | None = None,
    entity_id: int | None = None,
    traversal_depth: int = 0,
    impacted_count: int = 0,
    latency_ms: float = 0.0,
    policy_decision: str = "allow",
    payload: dict[str, Any] | None = None,
) -> WorkGraphAuditEvent:
    event = WorkGraphAuditEvent(
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        user_id=user_id,
        entity_id=entity_id,
        action_type=action_type,
        traversal_depth=traversal_depth,
        impacted_count=impacted_count,
        latency_ms=latency_ms,
        policy_decision=policy_decision,
        payload=payload or {},
    )
    session.add(event)
    await session.flush()
    return event
