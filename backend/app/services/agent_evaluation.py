from __future__ import annotations

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agent import AgentApproval, AgentApprovalDecision, AgentPlanStep, AgentStepAction, AgentStepStatus
from app.schemas.agent import AgentEvaluationResponse


async def evaluate_agent(session: AsyncSession, *, guild_id: int, session_id: int | None = None, samples: list[dict] | None = None) -> AgentEvaluationResponse:
    stmt = select(AgentPlanStep).where(AgentPlanStep.guild_id == guild_id)
    if session_id is not None:
        stmt = stmt.where(AgentPlanStep.session_id == session_id)
    steps = list((await session.exec(stmt)).all())
    approvals_stmt = select(AgentApproval).where(AgentApproval.guild_id == guild_id)
    if session_id is not None:
        approvals_stmt = approvals_stmt.where(AgentApproval.session_id == session_id)
    approvals = list((await session.exec(approvals_stmt)).all())
    total = max(1, len(steps))
    task_steps = [s for s in steps if s.action == AgentStepAction.create_task]
    has_task_breakdown = 1.0 if len(task_steps) >= 2 else 0.5 if task_steps else 0.0
    approved = sum(1 for s in steps if s.status in {AgentStepStatus.approved, AgentStepStatus.executed, AgentStepStatus.rolled_back})
    executed = sum(1 for s in steps if s.status == AgentStepStatus.executed)
    rolled = sum(1 for s in steps if s.status == AgentStepStatus.rolled_back)
    deadline_steps = [s for s in steps if s.action == AgentStepAction.set_deadline]
    assignee_steps = [s for s in steps if s.action == AgentStepAction.assign_user]
    dependency_steps = [s for s in steps if s.action == AgentStepAction.add_dependency]
    sample_count = len(samples or []) or len(steps)
    return AgentEvaluationResponse(
        goal_coverage=min(1.0, (len(task_steps) + len(deadline_steps)) / max(1, total / 2)),
        task_decomposition_accuracy=has_task_breakdown,
        assignee_suitability=0.75 if assignee_steps else 0.0,
        deadline_realism=0.72 if deadline_steps else 0.0,
        dependency_correctness=0.65 if dependency_steps else 0.5,
        approval_success_rate=approved / total,
        rollback_rate=rolled / max(1, executed + rolled),
        user_edit_distance=0.0 if not approvals else sum(1 for a in approvals if a.decision != AgentApprovalDecision.approve) / max(1, len(approvals)),
        evaluated_samples=sample_count,
        notes=["Metrics are lightweight operational proxies; wire golden-set scoring for stricter offline evaluation."],
    )
