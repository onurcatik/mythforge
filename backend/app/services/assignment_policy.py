from __future__ import annotations

from dataclasses import dataclass

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.project import Project, ProjectPermission, ProjectPermissionLevel
from app.models.task import Task
from app.models.user import User, UserStatus


@dataclass(slots=True)
class AssignmentPolicyDecision:
    allowed: bool
    auto_apply_allowed: bool
    requires_approval: bool
    reason: str


async def user_can_be_assigned(session: AsyncSession, *, guild_id: int, project: Project, user: User) -> bool:
    if user.status != UserStatus.active:
        return False
    if project.owner_id == user.id:
        return True
    perm = (await session.exec(
        select(ProjectPermission).where(
            ProjectPermission.guild_id == guild_id,
            ProjectPermission.project_id == project.id,
            ProjectPermission.user_id == user.id,
            ProjectPermission.level.in_((ProjectPermissionLevel.write, ProjectPermissionLevel.owner)),
        )
    )).one_or_none()
    return perm is not None


async def evaluate_assignment(
    session: AsyncSession,
    *,
    guild_id: int,
    task: Task,
    project: Project,
    candidate: User,
    confidence: float,
    auto_apply_requested: bool,
    confidence_threshold: float,
    graph_blast_radius: int = 0,
) -> AssignmentPolicyDecision:
    if task.assignment_locked:
        return AssignmentPolicyDecision(False, False, True, "assignment_locked")
    if not await user_can_be_assigned(session, guild_id=guild_id, project=project, user=candidate):
        return AssignmentPolicyDecision(False, False, False, "candidate_lacks_project_write_access")
    high_risk = graph_blast_radius >= 8 or (task.priority.value if task.priority else "medium") in {"urgent", "high"}
    if confidence < confidence_threshold:
        return AssignmentPolicyDecision(True, False, True, "confidence_below_threshold")
    if high_risk:
        return AssignmentPolicyDecision(True, False, True, "high_risk_requires_agent_approval")
    return AssignmentPolicyDecision(True, auto_apply_requested, False, "allow")
