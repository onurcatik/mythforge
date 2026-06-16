from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlmodel import select

from app.api.deps import GuildContext, RLSSessionDep, get_current_active_user, get_guild_membership
from app.models.assignment import AssignmentAuditEvent, AssignmentRecommendation
from app.models.user import User
from app.schemas.assignment import (
    AssignmentApplyRequest,
    AssignmentApplyResponse,
    AssignmentAuditResponse,
    AssignmentCapacityItem,
    AssignmentCapacityResponse,
    AssignmentHealthResponse,
    AssignmentRecommendRequest,
    AssignmentRecommendResponse,
    AssignmentRecommendationRead,
    AssignmentRejectRequest,
)
from app.services import assignment_capacity, assignment_engine

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


@router.post("/recommend", response_model=AssignmentRecommendResponse)
async def recommend_assignment(
    payload: AssignmentRecommendRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AssignmentRecommendResponse:
    response = await assignment_engine.recommend_for_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=payload.task_id,
        requested_by=current_user,
        auto_apply=payload.auto_apply,
        confidence_threshold=payload.confidence_threshold,
    )
    await session.commit()
    return response


@router.post("/apply", response_model=AssignmentApplyResponse)
async def apply_assignment(
    payload: AssignmentApplyRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AssignmentApplyResponse:
    response = await assignment_engine.apply_recommendation(
        session,
        guild_id=guild_context.guild_id,
        recommendation_id=payload.recommendation_id,
        current_user=current_user,
        require_approval_override=payload.require_approval_override,
    )
    await session.commit()
    return response


@router.post("/reject", response_model=AssignmentRecommendationRead)
async def reject_assignment(
    payload: AssignmentRejectRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AssignmentRecommendationRead:
    rec = await assignment_engine.reject_recommendation(session, guild_id=guild_context.guild_id, recommendation_id=payload.recommendation_id, current_user=current_user, reason=payload.reason)
    await session.commit()
    return assignment_engine._to_read(rec)


@router.get("/task/{task_id}", response_model=list[AssignmentRecommendationRead])
async def task_assignments(
    task_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> list[AssignmentRecommendationRead]:
    rows = await assignment_engine.latest_for_task(session, guild_id=guild_context.guild_id, task_id=task_id)
    return [assignment_engine._to_read(row) for row in rows]


@router.get("/capacity", response_model=AssignmentCapacityResponse)
async def capacity_map(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AssignmentCapacityResponse:
    rows = await assignment_capacity.refresh_guild_capacity(session, guild_id=guild_context.guild_id)
    await session.commit()
    name_by_id = {user.id: user.full_name or user.email for user, _membership in await assignment_capacity.guild_candidate_users(session, guild_id=guild_context.guild_id)}
    return AssignmentCapacityResponse(
        generated_at=datetime.now(timezone.utc),
        items=[AssignmentCapacityItem(user_id=row.user_id, user_name=name_by_id.get(row.user_id), active_task_count=row.active_task_count, overdue_task_count=row.overdue_task_count, blocker_owner_count=row.blocker_owner_count, deadline_pressure_count=row.deadline_pressure_count, estimated_effort_minutes=row.estimated_effort_minutes, timezone=row.timezone, role=row.role, calculated_at=row.calculated_at) for row in rows],
    )


@router.get("/health", response_model=AssignmentHealthResponse)
async def assignment_health(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AssignmentHealthResponse:
    recs = int((await session.exec(select(func.count()).select_from(AssignmentRecommendation).where(AssignmentRecommendation.guild_id == guild_context.guild_id))).one() or 0)
    caps = len(await assignment_capacity.refresh_guild_capacity(session, guild_id=guild_context.guild_id))
    await session.commit()
    return AssignmentHealthResponse(
        enabled=True,
        status="ok",
        recommendations=recs,
        capacity_snapshots=caps,
        policy={
            "default_mode": "recommendation_first",
            "auto_apply": "requires_policy_allow_and_confidence_threshold",
            "critical_assignment": "agent_approval_required",
            "cross_guild_assignment_leak": "blocked_by_rls_and_project_policy",
        },
    )


@router.get("/audit/{task_id}", response_model=AssignmentAuditResponse)
async def assignment_audit(
    task_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    limit: int = Query(default=50, ge=1, le=200),
) -> AssignmentAuditResponse:
    rows = (await session.exec(select(AssignmentAuditEvent).where(AssignmentAuditEvent.guild_id == guild_context.guild_id, AssignmentAuditEvent.task_id == task_id).order_by(AssignmentAuditEvent.created_at.desc()).limit(limit))).all()
    return AssignmentAuditResponse(events=[{"id": row.id, "action_type": row.action_type.value, "old_assignee_id": row.old_assignee_id, "new_assignee_id": row.new_assignee_id, "recommendation_id": row.recommendation_id, "score": row.score, "confidence": row.confidence, "policy_decision": row.policy_decision, "payload": row.payload, "created_at": row.created_at.isoformat()} for row in rows])
