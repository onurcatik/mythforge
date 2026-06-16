from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agent import (
    AgentApproval,
    AgentApprovalDecision,
    AgentAuditEvent,
    AgentPlanStep,
    AgentSession,
    AgentSessionStatus,
    AgentStepAction,
    AgentStepStatus,
)
from app.models.user import User
from app.schemas.agent import (
    AgentApprovalResponse,
    AgentAuditEventRead,
    AgentAuditResponse,
    AgentDeadlineSuggestion,
    AgentDiffResponse,
    AgentExecutionResult,
    AgentExecuteResponse,
    AgentPlanRequest,
    AgentPlanResponse,
    AgentPlanStepRead,
    AgentRisk,
    AgentSessionRead,
)
from app.services.agent_audit import record_event
from app.services.agent_diff import summarize_steps
from app.services.agent_executor import execute_plan
from app.services.agent_planner import build_plan
from app.services.agent_policy import ensure_plan_version


def _safe_risks(raw: list[dict[str, Any]]) -> list[AgentRisk]:
    risks: list[AgentRisk] = []
    for item in raw:
        try:
            risks.append(AgentRisk(**item))
        except Exception:
            continue
    return risks


def _step_read(step: AgentPlanStep) -> AgentPlanStepRead:
    return AgentPlanStepRead(
        id=step.id,
        step_order=step.step_order,
        action=step.action,
        status=step.status,
        entity_type=step.entity_type,
        entity_id=step.entity_id,
        title=step.title,
        summary=step.summary,
        rationale=step.rationale,
        proposed_patch=step.proposed_patch,
        current_snapshot=step.current_snapshot,
        diff=step.diff,
        requires_approval=step.requires_approval,
        project_id=step.project_id,
        initiative_id=step.initiative_id,
        result=step.result,
        error=step.error,
    )


def _aggregate_plan(
    session_obj: AgentSession, steps: list[AgentPlanStep]
) -> AgentPlanResponse:
    project_patches = [
        s.proposed_patch for s in steps if s.action == AgentStepAction.create_project
    ]
    task_patches = [
        s.proposed_patch for s in steps if s.action == AgentStepAction.create_task
    ]
    subtask_patches = [
        s.proposed_patch for s in steps if s.action == AgentStepAction.create_subtask
    ]
    dependencies = [
        s.proposed_patch for s in steps if s.action == AgentStepAction.add_dependency
    ]
    assignees = [
        {
            "user_id": (s.proposed_patch.get("assignee_ids") or [None])[0],
            "display_name": None,
            "reason": s.proposed_patch.get("reason") or s.rationale,
            "confidence": 0.62,
        }
        for s in steps
        if s.action == AgentStepAction.assign_user
    ]
    deadlines = [
        AgentDeadlineSuggestion(
            due_date=None,
            reason=s.proposed_patch.get("reason") or s.rationale,
            confidence=0.64,
        )
        for s in steps
        if s.action == AgentStepAction.set_deadline
    ]
    return AgentPlanResponse(
        session_id=session_obj.id,
        status=session_obj.status,
        plan_version=session_obj.plan_version,
        goal=session_obj.goal,
        normalized_goal=session_obj.normalized_goal,
        assumptions=session_obj.assumptions,
        initiative_patch={},
        project_patches=project_patches,
        task_patches=task_patches,
        subtask_patches=subtask_patches,
        dependencies=dependencies,
        assignee_suggestions=assignees,
        deadline_suggestions=deadlines,
        risks=_safe_risks(session_obj.risks),
        required_approvals=session_obj.required_approvals,
        diff_summary=session_obj.session_metadata.get("diff_summary")
        or summarize_steps(steps),
        confidence=session_obj.confidence,
        context_summary=session_obj.context_summary,
        steps=[
            _step_read(step) for step in sorted(steps, key=lambda item: item.step_order)
        ],
    )


async def load_session_and_steps(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    session_id: int,
    step_ids: list[int] | None = None,
) -> tuple[AgentSession, list[AgentPlanStep]]:
    result = await session.exec(
        select(AgentSession).where(
            AgentSession.id == session_id, AgentSession.guild_id == guild_id
        )
    )
    agent_session = result.one_or_none()
    if not agent_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="AGENT_SESSION_NOT_FOUND"
        )
    if agent_session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="AGENT_SESSION_OWNER_REQUIRED"
        )
    stmt = select(AgentPlanStep).where(
        AgentPlanStep.session_id == session_id, AgentPlanStep.guild_id == guild_id
    )
    if step_ids:
        stmt = stmt.where(AgentPlanStep.id.in_(tuple(step_ids)))
    stmt = stmt.order_by(AgentPlanStep.step_order)
    steps_result = await session.exec(stmt)
    steps = list(steps_result.all())
    return agent_session, steps


async def create_plan(
    session: AsyncSession, *, user: User, guild_id: int, request: AgentPlanRequest
) -> AgentPlanResponse:
    agent_session, steps = await build_plan(
        session, user=user, guild_id=guild_id, request=request
    )
    await record_event(
        session,
        user=user,
        guild_id=guild_id,
        initiative_id=agent_session.initiative_id,
        session_id=agent_session.id,
        event_type="agent.plan.created",
        prompt=request.goal,
        model=agent_session.model,
        payload={"step_count": len(steps), "confidence": agent_session.confidence},
    )
    await session.commit()
    return _aggregate_plan(agent_session, steps)


async def get_diff(
    session: AsyncSession, *, user: User, guild_id: int, session_id: int
) -> AgentDiffResponse:
    agent_session, steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id
    )
    return AgentDiffResponse(
        session_id=agent_session.id,
        plan_version=agent_session.plan_version,
        diff_summary=agent_session.session_metadata.get("diff_summary")
        or summarize_steps(steps),
        steps=[_step_read(step) for step in steps],
    )


async def approve_or_reject(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    session_id: int,
    expected_plan_version: int,
    decision: AgentApprovalDecision,
    step_ids: list[int] | None,
    reason: str | None,
) -> AgentApprovalResponse:
    agent_session, selected_steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id, step_ids=step_ids
    )
    ensure_plan_version(agent_session.plan_version, expected_plan_version)
    if not selected_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="AGENT_NO_STEPS_SELECTED"
        )

    now = datetime.now(timezone.utc)
    approved: list[int] = []
    rejected: list[int] = []
    for step in selected_steps:
        if decision == AgentApprovalDecision.approve:
            step.status = AgentStepStatus.approved
            step.approved_by_id = user.id
            step.approved_at = now
            approved.append(step.id)
        else:
            step.status = AgentStepStatus.rejected
            rejected.append(step.id)
        step.updated_at = now
        session.add(
            AgentApproval(
                session_id=agent_session.id,
                step_id=step.id,
                guild_id=guild_id,
                initiative_id=agent_session.initiative_id,
                user_id=user.id,
                decision=decision,
                reason=reason,
                plan_version=agent_session.plan_version,
            )
        )
    all_steps_result = await session.exec(
        select(AgentPlanStep).where(AgentPlanStep.session_id == agent_session.id)
    )
    all_steps = list(all_steps_result.all())
    if all(s.status == AgentStepStatus.rejected for s in all_steps):
        agent_session.status = AgentSessionStatus.rejected
    elif any(s.status == AgentStepStatus.approved for s in all_steps):
        agent_session.status = AgentSessionStatus.approved
    else:
        agent_session.status = AgentSessionStatus.awaiting_approval
    agent_session.updated_at = now
    await record_event(
        session,
        user=user,
        guild_id=guild_id,
        initiative_id=agent_session.initiative_id,
        session_id=agent_session.id,
        event_type="agent.approval.recorded",
        payload={
            "decision": decision.value,
            "approved_step_ids": approved,
            "rejected_step_ids": rejected,
            "reason": reason,
        },
    )
    await session.commit()
    return AgentApprovalResponse(
        session_id=agent_session.id,
        status=agent_session.status,
        approved_step_ids=approved,
        rejected_step_ids=rejected,
        plan_version=agent_session.plan_version,
    )


async def execute_approved(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    session_id: int,
    expected_plan_version: int,
    step_ids: list[int] | None,
) -> AgentExecuteResponse:
    agent_session, steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id, step_ids=step_ids
    )
    executed, skipped = await execute_plan(
        session,
        user=user,
        guild_id=guild_id,
        agent_session=agent_session,
        steps=steps,
        expected_plan_version=expected_plan_version,
    )
    await record_event(
        session,
        user=user,
        guild_id=guild_id,
        initiative_id=agent_session.initiative_id,
        session_id=agent_session.id,
        event_type="agent.execution.completed",
        payload={
            "executed": [item.model_dump() for item in executed],
            "skipped": [item.model_dump() for item in skipped],
            "status": agent_session.status.value,
        },
    )
    await session.commit()
    return AgentExecuteResponse(
        session_id=agent_session.id,
        status=agent_session.status,
        executed=executed,
        skipped=skipped,
        rollback_available=bool(executed),
    )


async def reject_plan(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    session_id: int,
    expected_plan_version: int,
    reason: str | None,
) -> AgentApprovalResponse:
    agent_session, steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id
    )
    ensure_plan_version(agent_session.plan_version, expected_plan_version)
    now = datetime.now(timezone.utc)
    rejected: list[int] = []
    for step in steps:
        if step.status in {AgentStepStatus.proposed, AgentStepStatus.approved}:
            step.status = AgentStepStatus.rejected
            step.updated_at = now
            rejected.append(step.id)
    session.add(
        AgentApproval(
            session_id=agent_session.id,
            step_id=None,
            guild_id=guild_id,
            initiative_id=agent_session.initiative_id,
            user_id=user.id,
            decision=AgentApprovalDecision.reject,
            reason=reason,
            plan_version=agent_session.plan_version,
        )
    )
    agent_session.status = AgentSessionStatus.rejected
    agent_session.updated_at = now
    await record_event(
        session,
        user=user,
        guild_id=guild_id,
        initiative_id=agent_session.initiative_id,
        session_id=agent_session.id,
        event_type="agent.plan.rejected",
        payload={"reason": reason, "rejected_step_ids": rejected},
    )
    await session.commit()
    return AgentApprovalResponse(
        session_id=agent_session.id,
        status=agent_session.status,
        approved_step_ids=[],
        rejected_step_ids=rejected,
        plan_version=agent_session.plan_version,
    )


async def rollback_session(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    session_id: int,
    step_ids: list[int] | None,
) -> tuple[list[int], list[int], AgentSessionStatus]:
    from app.services.agent_executor import rollback_plan

    agent_session, steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id, step_ids=step_ids
    )
    rolled_back, failed = await rollback_plan(
        session, user=user, guild_id=guild_id, agent_session=agent_session, steps=steps
    )
    await record_event(
        session,
        user=user,
        guild_id=guild_id,
        initiative_id=agent_session.initiative_id,
        session_id=agent_session.id,
        event_type="agent.rollback.completed",
        payload={"rolled_back_step_ids": rolled_back, "failed_step_ids": failed},
    )
    await session.commit()
    return rolled_back, failed, agent_session.status


async def read_session(
    session: AsyncSession, *, user: User, guild_id: int, session_id: int
) -> AgentPlanResponse:
    agent_session, steps = await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id
    )
    return _aggregate_plan(agent_session, steps)


async def read_audit(
    session: AsyncSession, *, user: User, guild_id: int, session_id: int
) -> AgentAuditResponse:
    await load_session_and_steps(
        session, user=user, guild_id=guild_id, session_id=session_id
    )
    result = await session.exec(
        select(AgentAuditEvent)
        .where(
            AgentAuditEvent.session_id == session_id,
            AgentAuditEvent.guild_id == guild_id,
        )
        .order_by(AgentAuditEvent.created_at.asc())
    )
    events = [AgentAuditEventRead.model_validate(event) for event in result.all()]
    return AgentAuditResponse(session_id=session_id, events=events)
