from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.assignment import (
    AssignmentActionType,
    AssignmentMode,
    AssignmentRecommendation,
    AssignmentRecommendationStatus,
    AssignmentScoreSnapshot,
)
from app.models.project import Project
from app.models.task import Task, TaskAssignee
from app.models.user import User
from app.schemas.assignment import (
    AssignmentRecommendationRead,
    AssignmentRecommendResponse,
    AssignmentApplyResponse,
)
from app.services import (
    assignment_audit,
    assignment_capacity,
    assignment_policy,
    assignment_scoring,
    work_graph_sync,
)
from app.services.ai.local_ai_mode import (
    audit_payload as runtime_audit_payload,
    enforce_local_only,
)
from app.services.ai_settings import resolve_ai_settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _reasoning(score_breakdown: dict) -> str:
    parts = []
    if score_breakdown.get("skill_match", 0) >= 0.75:
        parts.append("skill uyumu güçlü")
    if score_breakdown.get("workload_balance", 0) >= 0.7:
        parts.append("aktif yük dengeli")
    if score_breakdown.get("deadline_feasibility", 0) >= 0.7:
        parts.append("deadline uygulanabilir")
    if score_breakdown.get("timezone_fit", 0) >= 0.7:
        parts.append("timezone uyumu yeterli")
    if not parts:
        parts.append("en iyi mevcut aday ancak confidence sınırlı")
    return "; ".join(parts)


def _to_read(
    rec: AssignmentRecommendation, user_name: str | None = None
) -> AssignmentRecommendationRead:
    return AssignmentRecommendationRead(
        id=rec.id,
        task_id=rec.task_id,
        recommended_user_id=rec.recommended_user_id,
        recommended_user_name=user_name,
        score=rec.score,
        confidence=rec.confidence,
        mode=rec.mode,
        status=rec.status,
        reasoning=rec.reasoning,
        score_breakdown=rec.score_breakdown or {},
        policy_decision=rec.policy_decision,
        created_at=rec.created_at,
        applied_at=rec.applied_at,
        rejected_at=rec.rejected_at,
    )


async def _load_task(session: AsyncSession, *, guild_id: int, task_id: int) -> Task:
    task = (
        await session.exec(
            select(Task)
            .join(Task.project)
            .where(
                Task.id == task_id,
                Project.guild_id == guild_id,
                Task.deleted_at.is_(None),
            )
            .options(selectinload(Task.project), selectinload(Task.assignees))
        )
    ).one_or_none()
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="TASK_NOT_FOUND"
        )
    return task


async def recommend_for_task(
    session: AsyncSession,
    *,
    guild_id: int,
    task_id: int,
    requested_by: User,
    auto_apply: bool = False,
    confidence_threshold: float = 0.72,
) -> AssignmentRecommendResponse:
    started = perf_counter()
    runtime_settings = enforce_local_only(
        await resolve_ai_settings(session, requested_by, guild_id),
        operation="assignment.recommend",
    )
    runtime_payload = runtime_audit_payload(
        runtime_settings, operation="assignment.recommend"
    )
    task = await _load_task(session, guild_id=guild_id, task_id=task_id)
    project = task.project
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PROJECT_NOT_FOUND"
        )
    await work_graph_sync.sync_task(
        session, guild_id=guild_id, task_id=task.id, user_id=requested_by.id
    )
    candidates = []
    graph_blast_radius = 0
    user_name_by_id: dict[int, str | None] = {}
    for user, membership in await assignment_capacity.guild_candidate_users(
        session, guild_id=guild_id
    ):
        if not await assignment_policy.user_can_be_assigned(
            session, guild_id=guild_id, project=project, user=user
        ):
            continue
        capacity = await assignment_capacity.calculate_capacity_for_user(
            session, guild_id=guild_id, user=user, role=membership.role.value
        )
        score, confidence, breakdown = await assignment_scoring.score_candidate(
            session,
            guild_id=guild_id,
            task=task,
            user=user,
            capacity=capacity,
            role=membership.role.value,
        )
        graph_blast_radius = max(
            graph_blast_radius,
            int(
                (breakdown.get("raw", {}).get("graph", {}) or {}).get("blast_radius", 0)
                or 0
            ),
        )
        mode = AssignmentMode.recommend
        decision = await assignment_policy.evaluate_assignment(
            session,
            guild_id=guild_id,
            task=task,
            project=project,
            candidate=user,
            confidence=confidence,
            auto_apply_requested=auto_apply,
            confidence_threshold=confidence_threshold,
            graph_blast_radius=graph_blast_radius,
        )
        if not decision.allowed:
            mode = AssignmentMode.approval_required
        elif decision.requires_approval:
            mode = AssignmentMode.approval_required
        elif decision.auto_apply_allowed:
            mode = AssignmentMode.auto
        rec = AssignmentRecommendation(
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            project_id=project.id,
            task_id=task.id,
            recommended_user_id=user.id,
            score=score,
            confidence=confidence,
            mode=mode,
            status=AssignmentRecommendationStatus.draft,
            reasoning=_reasoning(breakdown),
            score_breakdown=breakdown,
            policy_decision=decision.reason,
            created_by_id=requested_by.id,
        )
        candidates.append(rec)
        user_name_by_id[user.id] = user.full_name or user.email
        session.add(
            AssignmentScoreSnapshot(
                guild_id=guild_id,
                initiative_id=project.initiative_id,
                project_id=project.id,
                task_id=task.id,
                user_id=user.id,
                score=score,
                confidence=confidence,
                breakdown=breakdown,
            )
        )
    if not candidates:
        await assignment_audit.record_assignment_event(
            session,
            guild_id=guild_id,
            action_type=AssignmentActionType.policy_block,
            user_id=requested_by.id,
            project_id=project.id,
            initiative_id=project.initiative_id,
            task_id=task.id,
            policy_decision="no_assignable_candidates",
        )
        return AssignmentRecommendResponse(
            recommendation=None,
            candidates=[],
            policy={"decision": "no_assignable_candidates"},
            graph_impact={},
        )
    candidates.sort(key=lambda item: (item.score, item.confidence), reverse=True)
    best = candidates[0]
    # Supersede old open recommendations for this task.
    old = (
        await session.exec(
            select(AssignmentRecommendation).where(
                AssignmentRecommendation.guild_id == guild_id,
                AssignmentRecommendation.task_id == task.id,
                AssignmentRecommendation.status.in_(
                    (
                        AssignmentRecommendationStatus.draft,
                        AssignmentRecommendationStatus.ready,
                        AssignmentRecommendationStatus.approved,
                    )
                ),
            )
        )
    ).all()
    for item in old:
        item.status = AssignmentRecommendationStatus.superseded
        item.updated_at = _now()
        session.add(item)
    best.status = AssignmentRecommendationStatus.ready
    session.add(best)
    await session.flush()
    latency_ms = round((perf_counter() - started) * 1000, 2)
    await assignment_audit.record_assignment_event(
        session,
        guild_id=guild_id,
        action_type=AssignmentActionType.recommend,
        user_id=requested_by.id,
        project_id=project.id,
        initiative_id=project.initiative_id,
        task_id=task.id,
        new_assignee_id=best.recommended_user_id,
        recommendation_id=best.id,
        score=best.score,
        confidence=best.confidence,
        policy_decision=best.policy_decision,
        payload={
            "candidate_count": len(candidates),
            "graph_blast_radius": graph_blast_radius,
            "ai_runtime": runtime_payload,
        },
        latency_ms=latency_ms,
    )
    if best.mode == AssignmentMode.auto:
        await apply_recommendation(
            session,
            guild_id=guild_id,
            recommendation_id=best.id,
            current_user=requested_by,
            require_approval_override=False,
        )
    return AssignmentRecommendResponse(
        recommendation=_to_read(best, user_name_by_id.get(best.recommended_user_id)),
        candidates=[
            _to_read(item, user_name_by_id.get(item.recommended_user_id))
            for item in candidates[:5]
        ],
        policy={
            "decision": best.policy_decision,
            "mode": best.mode.value,
            "confidence_threshold": confidence_threshold,
            "ai_runtime": runtime_payload,
        },
        graph_impact={"blast_radius": graph_blast_radius, "source": "work_graph_risk"},
    )


async def apply_recommendation(
    session: AsyncSession,
    *,
    guild_id: int,
    recommendation_id: int,
    current_user: User,
    require_approval_override: bool = False,
) -> AssignmentApplyResponse:
    rec = (
        await session.exec(
            select(AssignmentRecommendation).where(
                AssignmentRecommendation.guild_id == guild_id,
                AssignmentRecommendation.id == recommendation_id,
            )
        )
    ).one_or_none()
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASSIGNMENT_RECOMMENDATION_NOT_FOUND",
        )
    task = await _load_task(session, guild_id=guild_id, task_id=rec.task_id)
    project = task.project
    if rec.mode == AssignmentMode.approval_required and not require_approval_override:
        rec.status = AssignmentRecommendationStatus.approved
        rec.approved_by_id = current_user.id
        rec.updated_at = _now()
        session.add(rec)
        await assignment_audit.record_assignment_event(
            session,
            guild_id=guild_id,
            action_type=AssignmentActionType.policy_block,
            user_id=current_user.id,
            initiative_id=rec.initiative_id,
            project_id=rec.project_id,
            task_id=rec.task_id,
            recommendation_id=rec.id,
            new_assignee_id=rec.recommended_user_id,
            score=rec.score,
            confidence=rec.confidence,
            policy_decision="agent_approval_required",
        )
        return AssignmentApplyResponse(
            applied=False,
            task_id=rec.task_id,
            assignee_id=rec.recommended_user_id,
            recommendation_id=rec.id,
            status=rec.status,
            message="Assignment requires Agent approval/diff before execution",
            requires_approval=True,
        )
    existing = (
        await session.exec(
            select(TaskAssignee).where(
                TaskAssignee.task_id == rec.task_id,
                TaskAssignee.user_id == rec.recommended_user_id,
            )
        )
    ).one_or_none()
    old_assignee_id = task.assignees[0].id if task.assignees else None
    if existing is None:
        session.add(
            TaskAssignee(
                task_id=rec.task_id, user_id=rec.recommended_user_id, guild_id=guild_id
            )
        )
    rec.status = AssignmentRecommendationStatus.applied
    rec.approved_by_id = current_user.id
    rec.applied_at = _now()
    rec.updated_at = _now()
    session.add(rec)
    await work_graph_sync.sync_task(
        session, guild_id=guild_id, task_id=rec.task_id, user_id=current_user.id
    )
    await assignment_audit.record_assignment_event(
        session,
        guild_id=guild_id,
        action_type=AssignmentActionType.apply,
        user_id=current_user.id,
        initiative_id=rec.initiative_id,
        project_id=rec.project_id,
        task_id=rec.task_id,
        old_assignee_id=old_assignee_id,
        new_assignee_id=rec.recommended_user_id,
        recommendation_id=rec.id,
        score=rec.score,
        confidence=rec.confidence,
        policy_decision="applied",
    )
    return AssignmentApplyResponse(
        applied=True,
        task_id=rec.task_id,
        assignee_id=rec.recommended_user_id,
        recommendation_id=rec.id,
        status=rec.status,
        message="Assignment applied",
        requires_approval=False,
    )


async def reject_recommendation(
    session: AsyncSession,
    *,
    guild_id: int,
    recommendation_id: int,
    current_user: User,
    reason: str | None = None,
) -> AssignmentRecommendation:
    rec = (
        await session.exec(
            select(AssignmentRecommendation).where(
                AssignmentRecommendation.guild_id == guild_id,
                AssignmentRecommendation.id == recommendation_id,
            )
        )
    ).one_or_none()
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASSIGNMENT_RECOMMENDATION_NOT_FOUND",
        )
    rec.status = AssignmentRecommendationStatus.rejected
    rec.rejected_at = _now()
    rec.updated_at = _now()
    session.add(rec)
    await assignment_audit.record_assignment_event(
        session,
        guild_id=guild_id,
        action_type=AssignmentActionType.reject,
        user_id=current_user.id,
        initiative_id=rec.initiative_id,
        project_id=rec.project_id,
        task_id=rec.task_id,
        new_assignee_id=rec.recommended_user_id,
        recommendation_id=rec.id,
        score=rec.score,
        confidence=rec.confidence,
        policy_decision="rejected",
        payload={"reason": reason},
    )
    return rec


async def latest_for_task(
    session: AsyncSession, *, guild_id: int, task_id: int
) -> list[AssignmentRecommendation]:
    return (
        await session.exec(
            select(AssignmentRecommendation)
            .where(
                AssignmentRecommendation.guild_id == guild_id,
                AssignmentRecommendation.task_id == task_id,
            )
            .order_by(AssignmentRecommendation.created_at.desc())
            .limit(10)
        )
    ).all()
