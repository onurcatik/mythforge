from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.initiative import Initiative
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.work_graph import WorkGraphNode, WorkGraphNodeType
from app.services.permissions import (
    require_project_access,
    visible_project_ids_subquery,
)


def entity_link(
    guild_id: int, entity_type: WorkGraphNodeType | str, entity_id: int
) -> str | None:
    value = entity_type.value if hasattr(entity_type, "value") else str(entity_type)
    if value == "project":
        return f"/g/{guild_id}/projects/{entity_id}"
    if value == "task":
        return f"/g/{guild_id}/tasks/{entity_id}"
    if value == "document":
        return f"/g/{guild_id}/documents/{entity_id}"
    if value == "Initiative":
        return f"/g/{guild_id}/initiatives/{entity_id}"
    return None


def visible_project_clause(user: User):
    return Project.id.in_(visible_project_ids_subquery(user.id))


async def require_node_access(
    session: AsyncSession,
    *,
    guild_id: int,
    user: User,
    node: WorkGraphNode,
    access: str = "read",
) -> None:
    if node.guild_id != guild_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="WORK_GRAPH_NODE_NOT_FOUND"
        )
    if node.project_id is None:
        return
    result = await session.exec(
        select(Project)
        .where(Project.id == node.project_id, Project.guild_id == guild_id)
        .options(
            selectinload(Project.permissions),
            selectinload(Project.role_permissions),
            selectinload(Project.Initiative).selectinload(Initiative.memberships),
        )
    )
    project = result.one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="WORK_GRAPH_PROJECT_NOT_FOUND"
        )
    require_project_access(project, user, access=access)


async def find_accessible_task(
    session: AsyncSession,
    *,
    guild_id: int,
    user: User,
    task_id: int,
    access: str = "read",
) -> Task:
    result = await session.exec(
        select(Task)
        .join(Task.project)
        .where(Task.id == task_id, Project.guild_id == guild_id)
        .options(
            selectinload(Task.project).selectinload(Project.permissions),
            selectinload(Task.project).selectinload(Project.role_permissions),
            selectinload(Task.project)
            .selectinload(Project.Initiative)
            .selectinload(Initiative.memberships),
        )
    )
    task = result.one_or_none()
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="TASK_NOT_FOUND"
        )
    require_project_access(task.project, user, access=access)
    return task
