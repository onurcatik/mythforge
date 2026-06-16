from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.messages import ProjectMessages
from app.models.agent import AgentPlanStep, AgentStepStatus
from app.models.initiative import Initiative, InitiativeMember, PermissionKey
from app.models.project import Project, ProjectPermission, ProjectRolePermission
from app.models.user import User
from app.services import permissions as permissions_service
from app.services import rls as rls_service

PROMPT_INJECTION_MARKERS = (
    "ignore previous instructions",
    "initiativet previous instructions",
    "discard system prompt",
    "bypass approval",
    "execute without approval",
    "show hidden",
    "print secrets",
    "talimatları unut",
    "onaysız uygula",
    "gizli veriyi göster",
)


def detect_goal_injection(goal: str) -> list[str]:
    lowered = goal.lower()
    return [marker for marker in PROMPT_INJECTION_MARKERS if marker in lowered]


async def get_accessible_initiative(
    session: AsyncSession,
    *,
    guild_id: int,
    user: User,
    initiative_id: int | None,
) -> Initiative:
    stmt = select(Initiative).where(Initiative.guild_id == guild_id)
    if initiative_id is not None:
        stmt = stmt.where(Initiative.id == initiative_id)
    stmt = (
        stmt.join(InitiativeMember, InitiativeMember.initiative_id == Initiative.id)
        .where(InitiativeMember.user_id == user.id)
        .order_by(Initiative.is_default.desc(), Initiative.updated_at.desc())
    )
    result = await session.exec(stmt)
    Initiative = result.first()
    if not Initiative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ProjectMessages.initiative_NOT_FOUND,
        )
    return Initiative


async def get_project_for_write(
    session: AsyncSession,
    *,
    guild_id: int,
    user: User,
    project_id: int,
) -> Project:
    stmt = (
        select(Project)
        .where(Project.id == project_id, Project.guild_id == guild_id)
        .options(
            selectinload(Project.permissions),
            selectinload(Project.role_permissions),
            selectinload(Project.Initiative).selectinload(Initiative.memberships),
        )
    )
    result = await session.exec(stmt)
    project = result.one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=ProjectMessages.NOT_FOUND
        )
    permissions_service.require_project_access(project, user, access="write")
    return project


async def can_create_projects(
    session: AsyncSession, *, initiative_id: int, user: User
) -> bool:
    return await rls_service.check_initiative_permission(
        session,
        initiative_id=initiative_id,
        user=user,
        permission_key=PermissionKey.create_projects,
    )


def ensure_steps_approved(steps: list[AgentPlanStep]) -> None:
    for step in steps:
        if step.requires_approval and step.status != AgentStepStatus.approved:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="AGENT_STEP_REQUIRES_APPROVAL",
            )


def ensure_plan_version(actual: int, expected: int) -> None:
    if actual != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="AGENT_PLAN_VERSION_MISMATCH"
        )
