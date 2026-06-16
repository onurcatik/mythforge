from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.api.deps import (
    GuildContext,
    RLSSessionDep,
    get_current_active_user,
    get_guild_membership,
)
from app.models.initiative import Initiative
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.models.work_graph import TaskDependency, WorkGraphNodeType
from app.schemas.dependencies import (
    DependencyCreate,
    DependencyListResponse,
    DependencyRead,
    DependencyUpdate,
)
from app.schemas.work_graph import WorkGraphImpactRequest, WorkGraphImpactResponse
from app.services import assignment_engine, work_graph_impact, work_graph_sync
from app.services.permissions import require_project_access

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


async def _load_task_project(
    session, *, guild_id: int, task_id: int, user: User, access: str = "write"
) -> tuple[Task, Project]:
    task = (
        await session.exec(
            select(Task)
            .join(Task.project)
            .where(
                Task.id == task_id,
                Project.guild_id == guild_id,
                Task.deleted_at.is_(None),
            )
            .options(
                selectinload(Task.project).selectinload(Project.permissions),
                selectinload(Task.project).selectinload(Project.role_permissions),
                selectinload(Task.project)
                .selectinload(Project.Initiative)
                .selectinload(Initiative.memberships),
            )
        )
    ).one_or_none()
    if task is None or task.project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="TASK_NOT_FOUND"
        )
    require_project_access(task.project, user, access=access)
    return task, task.project


async def _would_create_cycle(
    session, *, guild_id: int, source_task_id: int, target_task_id: int
) -> bool:
    rows = (
        await session.exec(
            select(TaskDependency).where(
                TaskDependency.guild_id == guild_id, TaskDependency.deleted_at.is_(None)
            )
        )
    ).all()
    graph: dict[int, list[int]] = {}
    for dep in rows:
        graph.setdefault(dep.source_task_id, []).append(dep.target_task_id)
    graph.setdefault(source_task_id, []).append(target_task_id)
    stack = [target_task_id]
    seen: set[int] = set()
    while stack:
        current = stack.pop()
        if current == source_task_id:
            return True
        if current in seen:
            continue
        seen.add(current)
        stack.extend(graph.get(current, []))
    return False


def _read(dep: TaskDependency) -> DependencyRead:
    return DependencyRead(
        id=dep.id,
        source_task_id=dep.source_task_id,
        target_task_id=dep.target_task_id,
        lag_minutes=dep.lag_minutes,
        project_id=dep.project_id,
        initiative_id=dep.initiative_id,
        created_at=dep.created_at,
    )


@router.get("", response_model=DependencyListResponse)
async def list_dependencies(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    task_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
) -> DependencyListResponse:
    stmt = select(TaskDependency).where(
        TaskDependency.guild_id == guild_context.guild_id,
        TaskDependency.deleted_at.is_(None),
    )
    if task_id is not None:
        stmt = stmt.where(
            (TaskDependency.source_task_id == task_id)
            | (TaskDependency.target_task_id == task_id)
        )
    if project_id is not None:
        stmt = stmt.where(TaskDependency.project_id == project_id)
    rows = (
        await session.exec(stmt.order_by(TaskDependency.created_at.desc()).limit(200))
    ).all()
    visible = []
    for dep in rows:
        await _load_task_project(
            session,
            guild_id=guild_context.guild_id,
            task_id=dep.source_task_id,
            user=current_user,
            access="read",
        )
        visible.append(_read(dep))
    return DependencyListResponse(items=visible, total=len(visible))


@router.post("", response_model=DependencyRead)
async def create_dependency(
    payload: DependencyCreate,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> DependencyRead:
    if payload.source_task_id == payload.target_task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DEPENDENCY_SELF_LOOP_BLOCKED",
        )
    source, project = await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=payload.source_task_id,
        user=current_user,
        access="write",
    )
    target, _target_project = await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=payload.target_task_id,
        user=current_user,
        access="read",
    )
    if await _would_create_cycle(
        session,
        guild_id=guild_context.guild_id,
        source_task_id=payload.source_task_id,
        target_task_id=payload.target_task_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="DEPENDENCY_CYCLE_BLOCKED"
        )
    existing = (
        await session.exec(
            select(TaskDependency).where(
                TaskDependency.guild_id == guild_context.guild_id,
                TaskDependency.source_task_id == payload.source_task_id,
                TaskDependency.target_task_id == payload.target_task_id,
            )
        )
    ).one_or_none()
    dep = existing or TaskDependency(
        guild_id=guild_context.guild_id,
        source_task_id=payload.source_task_id,
        target_task_id=payload.target_task_id,
        created_by_id=current_user.id,
    )
    dep.initiative_id = project.initiative_id
    dep.project_id = project.id
    dep.lag_minutes = payload.lag_minutes
    dep.deleted_at = None
    session.add(dep)
    await session.flush()
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=source.id,
        user_id=current_user.id,
    )
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=target.id,
        user_id=current_user.id,
    )
    await assignment_engine.recommend_for_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=source.id,
        requested_by=current_user,
        auto_apply=False,
    )
    await session.commit()
    return _read(dep)


@router.patch("/{dependency_id}", response_model=DependencyRead)
async def update_dependency(
    dependency_id: int,
    payload: DependencyUpdate,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> DependencyRead:
    dep = (
        await session.exec(
            select(TaskDependency).where(
                TaskDependency.guild_id == guild_context.guild_id,
                TaskDependency.id == dependency_id,
                TaskDependency.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if dep is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="DEPENDENCY_NOT_FOUND"
        )
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=dep.source_task_id,
        user=current_user,
        access="write",
    )
    if payload.lag_minutes is not None:
        dep.lag_minutes = payload.lag_minutes
    session.add(dep)
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=dep.source_task_id,
        user_id=current_user.id,
    )
    await session.commit()
    return _read(dep)


@router.delete("/{dependency_id}", response_model=DependencyRead)
async def delete_dependency(
    dependency_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> DependencyRead:
    dep = (
        await session.exec(
            select(TaskDependency).where(
                TaskDependency.guild_id == guild_context.guild_id,
                TaskDependency.id == dependency_id,
                TaskDependency.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if dep is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="DEPENDENCY_NOT_FOUND"
        )
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=dep.source_task_id,
        user=current_user,
        access="write",
    )
    dep.deleted_at = datetime.now(timezone.utc)
    session.add(dep)
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=dep.source_task_id,
        user_id=current_user.id,
    )
    await session.commit()
    return _read(dep)


@router.get("/impact/{task_id}", response_model=WorkGraphImpactResponse)
async def dependency_impact(
    task_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphImpactResponse:
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=task_id,
        user=current_user,
        access="read",
    )
    response = await work_graph_impact.analyze_impact(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        request=WorkGraphImpactRequest(
            entity_type=WorkGraphNodeType.task, entity_id=task_id, direction="both"
        ),
    )
    await session.commit()
    return response
