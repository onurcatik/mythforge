from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.assignment import UserCapacitySnapshot
from app.models.guild import GuildMembership
from app.models.task import Task, TaskAssignee, TaskStatusCategory, TaskStatus
from app.models.user import User, UserStatus
from app.models.work_graph import TaskBlocker, WorkGraphBlockerStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def guild_candidate_users(session: AsyncSession, *, guild_id: int) -> list[tuple[User, GuildMembership]]:
    rows = (await session.exec(
        select(User, GuildMembership)
        .join(GuildMembership, GuildMembership.user_id == User.id)
        .where(GuildMembership.guild_id == guild_id, User.status == UserStatus.active)
        .order_by(GuildMembership.position.asc(), User.id.asc())
    )).all()
    return list(rows)


async def calculate_capacity_for_user(session: AsyncSession, *, guild_id: int, user: User, role: str = "member") -> UserCapacitySnapshot:
    now = _now()
    soon = now + timedelta(days=7)
    active_stmt = (
        select(func.count())
        .select_from(TaskAssignee)
        .join(Task, Task.id == TaskAssignee.task_id)
        .join(TaskStatus, TaskStatus.id == Task.task_status_id)
        .where(
            TaskAssignee.guild_id == guild_id,
            TaskAssignee.user_id == user.id,
            Task.deleted_at.is_(None),
            Task.is_archived.is_(False),
            TaskStatus.category != TaskStatusCategory.done,
        )
    )
    overdue_stmt = active_stmt.where(Task.due_date.is_not(None), Task.due_date < now)
    pressure_stmt = active_stmt.where(Task.due_date.is_not(None), Task.due_date <= soon)
    effort_stmt = (
        select(func.coalesce(func.sum(Task.estimated_effort_minutes), 0))
        .select_from(TaskAssignee)
        .join(Task, Task.id == TaskAssignee.task_id)
        .join(TaskStatus, TaskStatus.id == Task.task_status_id)
        .where(
            TaskAssignee.guild_id == guild_id,
            TaskAssignee.user_id == user.id,
            Task.deleted_at.is_(None),
            Task.is_archived.is_(False),
            TaskStatus.category != TaskStatusCategory.done,
        )
    )
    blocker_stmt = select(func.count()).select_from(TaskBlocker).where(
        TaskBlocker.guild_id == guild_id,
        TaskBlocker.owner_user_id == user.id,
        TaskBlocker.deleted_at.is_(None),
        TaskBlocker.status == WorkGraphBlockerStatus.open,
    )
    active = int((await session.exec(active_stmt)).one() or 0)
    overdue = int((await session.exec(overdue_stmt)).one() or 0)
    pressure = int((await session.exec(pressure_stmt)).one() or 0)
    effort = int((await session.exec(effort_stmt)).one() or 0)
    blockers = int((await session.exec(blocker_stmt)).one() or 0)
    existing = (await session.exec(select(UserCapacitySnapshot).where(UserCapacitySnapshot.guild_id == guild_id, UserCapacitySnapshot.user_id == user.id))).one_or_none()
    snapshot = existing or UserCapacitySnapshot(guild_id=guild_id, user_id=user.id)
    snapshot.active_task_count = active
    snapshot.overdue_task_count = overdue
    snapshot.blocker_owner_count = blockers
    snapshot.deadline_pressure_count = pressure
    snapshot.estimated_effort_minutes = effort
    snapshot.timezone = user.timezone or "UTC"
    snapshot.role = role
    snapshot.availability = {
        "active_task_count": active,
        "overdue_task_count": overdue,
        "deadline_pressure_count": pressure,
        "estimated_effort_minutes": effort,
    }
    snapshot.calculated_at = now
    session.add(snapshot)
    await session.flush()
    return snapshot


async def refresh_guild_capacity(session: AsyncSession, *, guild_id: int) -> list[UserCapacitySnapshot]:
    snapshots: list[UserCapacitySnapshot] = []
    for user, membership in await guild_candidate_users(session, guild_id=guild_id):
        snapshots.append(await calculate_capacity_for_user(session, guild_id=guild_id, user=user, role=membership.role.value))
    return snapshots
