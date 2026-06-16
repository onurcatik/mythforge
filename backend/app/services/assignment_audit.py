from __future__ import annotations

from typing import Any
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.assignment import AssignmentActionType, AssignmentAuditEvent


async def record_assignment_event(
    session: AsyncSession,
    *,
    guild_id: int,
    action_type: AssignmentActionType,
    user_id: int | None = None,
    initiative_id: int | None = None,
    project_id: int | None = None,
    task_id: int | None = None,
    old_assignee_id: int | None = None,
    new_assignee_id: int | None = None,
    recommendation_id: int | None = None,
    score: float = 0.0,
    confidence: float = 0.0,
    policy_decision: str = "allow",
    payload: dict[str, Any] | None = None,
    latency_ms: float = 0.0,
) -> AssignmentAuditEvent:
    event = AssignmentAuditEvent(
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        task_id=task_id,
        user_id=user_id,
        old_assignee_id=old_assignee_id,
        new_assignee_id=new_assignee_id,
        recommendation_id=recommendation_id,
        action_type=action_type,
        score=score,
        confidence=confidence,
        policy_decision=policy_decision,
        payload=payload or {},
        latency_ms=latency_ms,
    )
    session.add(event)
    await session.flush()
    return event
