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
from app.models.work_graph import TaskBlocker, WorkGraphBlockerStatus
from app.schemas.blockers import (
    BlockerCreate,
    BlockerListResponse,
    BlockerRead,
    BlockerResolveRequest,
    BlockerUpdate,
)
from app.services import assignment_engine, work_graph_sync
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


def _read(blocker: TaskBlocker) -> BlockerRead:
    return BlockerRead(
        id=blocker.id,
        task_id=blocker.task_id,
        title=blocker.title,
        reason=blocker.reason,
        severity=blocker.severity,
        status=blocker.status,
        owner_user_id=blocker.owner_user_id,
        project_id=blocker.project_id,
        initiative_id=blocker.initiative_id,
        linked_entity_type=blocker.linked_entity_type,
        linked_entity_id=blocker.linked_entity_id,
        resolved_at=blocker.resolved_at,
        created_at=blocker.created_at,
        updated_at=blocker.updated_at,
    )


@router.get("", response_model=BlockerListResponse)
async def list_blockers(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    task_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
) -> BlockerListResponse:
    stmt = select(TaskBlocker).where(
        TaskBlocker.guild_id == guild_context.guild_id, TaskBlocker.deleted_at.is_(None)
    )
    if task_id is not None:
        stmt = stmt.where(TaskBlocker.task_id == task_id)
    if project_id is not None:
        stmt = stmt.where(TaskBlocker.project_id == project_id)
    rows = (
        await session.exec(stmt.order_by(TaskBlocker.created_at.desc()).limit(200))
    ).all()
    visible = []
    for blocker in rows:
        await _load_task_project(
            session,
            guild_id=guild_context.guild_id,
            task_id=blocker.task_id,
            user=current_user,
            access="read",
        )
        visible.append(_read(blocker))
    return BlockerListResponse(items=visible, total=len(visible))


@router.post("", response_model=BlockerRead)
async def create_blocker(
    payload: BlockerCreate,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> BlockerRead:
    task, project = await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=payload.task_id,
        user=current_user,
        access="write",
    )
    blocker = TaskBlocker(
        guild_id=guild_context.guild_id,
        initiative_id=project.initiative_id,
        project_id=project.id,
        task_id=task.id,
        title=payload.title,
        reason=payload.reason,
        severity=payload.severity,
        owner_user_id=payload.owner_user_id,
        created_by_id=current_user.id,
        linked_entity_type=payload.linked_entity_type,
        linked_entity_id=payload.linked_entity_id,
    )
    session.add(blocker)
    await session.flush()
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=task.id,
        user_id=current_user.id,
    )
    await assignment_engine.recommend_for_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=task.id,
        requested_by=current_user,
        auto_apply=False,
    )
    await session.commit()
    return _read(blocker)


@router.patch("/{blocker_id}", response_model=BlockerRead)
async def update_blocker(
    blocker_id: int,
    payload: BlockerUpdate,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> BlockerRead:
    blocker = (
        await session.exec(
            select(TaskBlocker).where(
                TaskBlocker.guild_id == guild_context.guild_id,
                TaskBlocker.id == blocker_id,
                TaskBlocker.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if blocker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="BLOCKER_NOT_FOUND"
        )
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user=current_user,
        access="write",
    )
    for key in [
        "title",
        "reason",
        "severity",
        "owner_user_id",
        "linked_entity_type",
        "linked_entity_id",
    ]:
        value = getattr(payload, key)
        if value is not None:
            setattr(blocker, key, value)
    blocker.updated_at = datetime.now(timezone.utc)
    session.add(blocker)
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user_id=current_user.id,
    )
    await session.commit()
    return _read(blocker)


@router.post("/{blocker_id}/resolve", response_model=BlockerRead)
async def resolve_blocker(
    blocker_id: int,
    payload: BlockerResolveRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> BlockerRead:
    blocker = (
        await session.exec(
            select(TaskBlocker).where(
                TaskBlocker.guild_id == guild_context.guild_id,
                TaskBlocker.id == blocker_id,
                TaskBlocker.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if blocker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="BLOCKER_NOT_FOUND"
        )
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user=current_user,
        access="write",
    )
    blocker.status = WorkGraphBlockerStatus.resolved
    blocker.resolved_at = datetime.now(timezone.utc)
    blocker.updated_at = datetime.now(timezone.utc)
    if payload.resolution_note:
        blocker.reason = (
            f"{blocker.reason or ''}\n\nResolution: {payload.resolution_note}".strip()
        )
    session.add(blocker)
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user_id=current_user.id,
    )
    await session.commit()
    return _read(blocker)


@router.delete("/{blocker_id}", response_model=BlockerRead)
async def delete_blocker(
    blocker_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> BlockerRead:
    blocker = (
        await session.exec(
            select(TaskBlocker).where(
                TaskBlocker.guild_id == guild_context.guild_id,
                TaskBlocker.id == blocker_id,
                TaskBlocker.deleted_at.is_(None),
            )
        )
    ).one_or_none()
    if blocker is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="BLOCKER_NOT_FOUND"
        )
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user=current_user,
        access="write",
    )
    blocker.deleted_at = datetime.now(timezone.utc)
    blocker.updated_at = datetime.now(timezone.utc)
    session.add(blocker)
    await work_graph_sync.sync_task(
        session,
        guild_id=guild_context.guild_id,
        task_id=blocker.task_id,
        user_id=current_user.id,
    )
    await session.commit()
    return _read(blocker)


@router.get("/task/{task_id}", response_model=BlockerListResponse)
async def blockers_for_task(
    task_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> BlockerListResponse:
    await _load_task_project(
        session,
        guild_id=guild_context.guild_id,
        task_id=task_id,
        user=current_user,
        access="read",
    )
    rows = (
        await session.exec(
            select(TaskBlocker)
            .where(
                TaskBlocker.guild_id == guild_context.guild_id,
                TaskBlocker.task_id == task_id,
                TaskBlocker.deleted_at.is_(None),
            )
            .order_by(TaskBlocker.created_at.desc())
        )
    ).all()
    return BlockerListResponse(items=[_read(row) for row in rows], total=len(rows))
