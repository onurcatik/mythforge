from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agent import (
    AgentPlanStep,
    AgentSession,
    AgentSessionStatus,
    AgentStepAction,
    AgentStepStatus,
)
from app.models.project import Project, ProjectPermission, ProjectPermissionLevel
from app.models.task import Subtask, Task, TaskAssignee, TaskPriority
from app.models.user import User
from app.schemas.agent import AgentExecutionResult
from app.services import task_statuses as task_statuses_service, work_graph_sync
from app.services.agent_policy import (
    ensure_plan_version,
    ensure_steps_approved,
    get_project_for_write,
)


def _link(guild_id: int, entity_type: str, entity_id: int | None) -> str | None:
    if entity_id is None:
        return None
    if entity_type == "project":
        return f"/g/{guild_id}/projects/{entity_id}"
    if entity_type == "task":
        return f"/g/{guild_id}/tasks/{entity_id}"
    return None


async def _next_task_position(session: AsyncSession, project_id: int) -> float:
    result = await session.exec(
        select(func.max(Task.position)).where(Task.project_id == project_id)
    )
    current = result.one_or_none()
    return float(current or 0) + 1000.0


async def _create_project(
    session: AsyncSession, *, user: User, guild_id: int, patch: dict[str, Any]
) -> Project:
    project = Project(
        guild_id=guild_id,
        name=str(patch.get("name") or "Agent Project")[:255],
        icon=patch.get("icon"),
        description=patch.get("description"),
        owner_id=int(patch.get("owner_id") or user.id),
        initiative_id=int(patch["initiative_id"]),
    )
    session.add(project)
    await session.flush()
    session.add(
        ProjectPermission(
            project_id=project.id,
            user_id=project.owner_id,
            guild_id=guild_id,
            level=ProjectPermissionLevel.owner,
        )
    )
    await task_statuses_service.ensure_default_statuses(session, project.id)
    return project


async def _create_task(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    patch: dict[str, Any],
    project_id: int,
) -> Task:
    statuses = await task_statuses_service.ensure_default_statuses(session, project_id)
    default_status = await task_statuses_service.get_default_status(session, project_id)
    if default_status is None:
        default_status = statuses[0]
    priority_raw = patch.get("priority") or "medium"
    try:
        priority = TaskPriority(priority_raw)
    except ValueError:
        priority = TaskPriority.medium
    task = Task(
        guild_id=guild_id,
        project_id=project_id,
        task_status_id=default_status.id,
        title=str(patch.get("title") or "Agent task")[:500],
        description=patch.get("description"),
        priority=priority,
        position=await _next_task_position(session, project_id),
        created_by_id=user.id,
    )
    session.add(task)
    await session.flush()
    return task


async def execute_plan(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    agent_session: AgentSession,
    steps: list[AgentPlanStep],
    expected_plan_version: int,
) -> tuple[list[AgentExecutionResult], list[AgentExecutionResult]]:
    ensure_plan_version(agent_session.plan_version, expected_plan_version)
    if agent_session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="AGENT_SESSION_OWNER_REQUIRED"
        )
    ensure_steps_approved(steps)

    agent_session.status = AgentSessionStatus.executing
    project_map: dict[str, int] = {}
    task_map: dict[str, int] = {}
    if agent_session.project_id:
        project = await get_project_for_write(
            session, guild_id=guild_id, user=user, project_id=agent_session.project_id
        )
        project_map["existing_project"] = project.id

    executed: list[AgentExecutionResult] = []
    skipped: list[AgentExecutionResult] = []
    for step in sorted(steps, key=lambda item: item.step_order):
        if step.status != AgentStepStatus.approved:
            skipped.append(
                AgentExecutionResult(
                    step_id=step.id,
                    action=step.action,
                    status=step.status,
                    entity_type=step.entity_type,
                    entity_id=step.entity_id,
                    result=step.result,
                )
            )
            continue
        step.status = AgentStepStatus.executing
        step.error = None
        try:
            patch = step.proposed_patch or {}
            entity_id: int | None = None
            result_payload: dict[str, Any] = {}
            if step.action == AgentStepAction.create_project:
                project = await _create_project(
                    session, user=user, guild_id=guild_id, patch=patch
                )
                key = str(patch.get("project_key") or f"project_{project.id}")
                project_map[key] = project.id
                entity_id = project.id
                await work_graph_sync.sync_project(
                    session, guild_id=guild_id, project_id=project.id
                )
                result_payload = {
                    "project_id": project.id,
                    "project_key": key,
                    "rollback": {"delete_project_id": project.id},
                }
            elif step.action == AgentStepAction.create_task:
                project_key = str(patch.get("project_key") or "existing_project")
                project_id = int(
                    patch.get("project_id") or project_map.get(project_key) or 0
                )
                if project_id <= 0:
                    raise RuntimeError("Missing project mapping for task creation")
                await get_project_for_write(
                    session, guild_id=guild_id, user=user, project_id=project_id
                )
                task = await _create_task(
                    session,
                    user=user,
                    guild_id=guild_id,
                    patch=patch,
                    project_id=project_id,
                )
                key = str(patch.get("task_key") or f"task_{task.id}")
                task_map[key] = task.id
                entity_id = task.id
                await work_graph_sync.sync_task(
                    session, guild_id=guild_id, task_id=task.id, user_id=user.id
                )
                result_payload = {
                    "task_id": task.id,
                    "task_key": key,
                    "project_id": project_id,
                    "rollback": {"delete_task_id": task.id},
                }
            elif step.action == AgentStepAction.create_subtask:
                task_key = str(patch.get("task_key") or "")
                task_id = int(patch.get("task_id") or task_map.get(task_key) or 0)
                if task_id <= 0:
                    raise RuntimeError("Missing task mapping for subtask creation")
                subtask = Subtask(
                    guild_id=guild_id,
                    task_id=task_id,
                    content=str(patch.get("content") or "Subtask"),
                    position=int(patch.get("position") or 0),
                )
                session.add(subtask)
                await session.flush()
                entity_id = subtask.id
                await work_graph_sync.sync_task(
                    session, guild_id=guild_id, task_id=task_id, user_id=user.id
                )
                result_payload = {
                    "subtask_id": subtask.id,
                    "task_id": task_id,
                    "rollback": {"delete_subtask_id": subtask.id},
                }
            elif step.action == AgentStepAction.assign_user:
                task_key = str(patch.get("task_key") or "")
                task_id = int(patch.get("task_id") or task_map.get(task_key) or 0)
                if task_id <= 0:
                    raise RuntimeError("Missing task mapping for assignment")
                assignee_ids = [
                    int(x) for x in patch.get("assignee_ids", []) if x is not None
                ]
                for assignee_id in assignee_ids:
                    exists = await session.exec(
                        select(TaskAssignee).where(
                            TaskAssignee.task_id == task_id,
                            TaskAssignee.user_id == assignee_id,
                        )
                    )
                    if exists.one_or_none() is None:
                        session.add(
                            TaskAssignee(
                                task_id=task_id, user_id=assignee_id, guild_id=guild_id
                            )
                        )
                entity_id = task_id
                await work_graph_sync.sync_task(
                    session, guild_id=guild_id, task_id=task_id, user_id=user.id
                )
                result_payload = {
                    "task_id": task_id,
                    "assignee_ids": assignee_ids,
                    "rollback": {"remove_assignees": assignee_ids, "task_id": task_id},
                }
            elif step.action == AgentStepAction.set_deadline:
                task_key = str(patch.get("task_key") or "")
                task_id = int(patch.get("task_id") or task_map.get(task_key) or 0)
                if task_id <= 0:
                    raise RuntimeError("Missing task mapping for deadline")
                task_result = await session.exec(
                    select(Task).where(Task.id == task_id, Task.guild_id == guild_id)
                )
                task = task_result.one_or_none()
                if task is None:
                    raise RuntimeError("Task not found for deadline")
                previous_due_date = task.due_date.isoformat() if task.due_date else None
                raw_due = patch.get("due_date")
                task.due_date = (
                    datetime.fromisoformat(str(raw_due).replace("Z", "+00:00"))
                    if raw_due
                    else None
                )
                task.updated_at = datetime.now(timezone.utc)
                entity_id = task_id
                await work_graph_sync.sync_task(
                    session, guild_id=guild_id, task_id=task_id, user_id=user.id
                )
                result_payload = {
                    "task_id": task_id,
                    "due_date": raw_due,
                    "rollback": {
                        "task_id": task_id,
                        "previous_due_date": previous_due_date,
                    },
                }
            else:
                result_payload = {
                    "skipped_reason": "Action is proposal-only in current executor"
                }

            step.status = AgentStepStatus.executed
            step.entity_id = entity_id
            step.executed_at = datetime.now(timezone.utc)
            step.result = result_payload
            step.updated_at = datetime.now(timezone.utc)
            executed.append(
                AgentExecutionResult(
                    step_id=step.id,
                    action=step.action,
                    status=step.status,
                    entity_type=step.entity_type,
                    entity_id=entity_id,
                    link=_link(guild_id, step.entity_type, entity_id),
                    result=result_payload,
                )
            )
        except Exception as exc:  # noqa: BLE001 - stored as safe operation error
            step.status = AgentStepStatus.failed
            step.error = str(exc)[:2000]
            step.updated_at = datetime.now(timezone.utc)
            skipped.append(
                AgentExecutionResult(
                    step_id=step.id,
                    action=step.action,
                    status=step.status,
                    entity_type=step.entity_type,
                    entity_id=step.entity_id,
                    error=step.error,
                    result=step.result,
                )
            )

    agent_session.updated_at = datetime.now(timezone.utc)
    agent_session.status = (
        AgentSessionStatus.completed
        if not any(item.status == AgentStepStatus.failed for item in steps)
        else AgentSessionStatus.failed
    )
    return executed, skipped


async def rollback_plan(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    agent_session: AgentSession,
    steps: list[AgentPlanStep],
) -> tuple[list[int], list[int]]:
    if agent_session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="AGENT_SESSION_OWNER_REQUIRED"
        )
    rolled_back: list[int] = []
    failed: list[int] = []
    for step in sorted(steps, key=lambda item: item.step_order, reverse=True):
        rb = (step.result or {}).get("rollback", {})
        try:
            if rb.get("delete_subtask_id"):
                obj = (
                    await session.exec(
                        select(Subtask).where(
                            Subtask.id == int(rb["delete_subtask_id"]),
                            Subtask.guild_id == guild_id,
                        )
                    )
                ).one_or_none()
                if obj:
                    await session.delete(obj)
            elif rb.get("delete_task_id"):
                obj = (
                    await session.exec(
                        select(Task).where(
                            Task.id == int(rb["delete_task_id"]),
                            Task.guild_id == guild_id,
                        )
                    )
                ).one_or_none()
                if obj:
                    await session.delete(obj)
            elif rb.get("delete_project_id"):
                obj = (
                    await session.exec(
                        select(Project).where(
                            Project.id == int(rb["delete_project_id"]),
                            Project.guild_id == guild_id,
                        )
                    )
                ).one_or_none()
                if obj:
                    obj.is_archived = True
                    obj.archived_at = datetime.now(timezone.utc)
            elif rb.get("remove_assignees"):
                task_id = int(rb["task_id"])
                for assignee_id in rb["remove_assignees"]:
                    obj = (
                        await session.exec(
                            select(TaskAssignee).where(
                                TaskAssignee.task_id == task_id,
                                TaskAssignee.user_id == int(assignee_id),
                            )
                        )
                    ).one_or_none()
                    if obj:
                        await session.delete(obj)
            elif "previous_due_date" in rb:
                task = (
                    await session.exec(
                        select(Task).where(
                            Task.id == int(rb["task_id"]), Task.guild_id == guild_id
                        )
                    )
                ).one_or_none()
                if task:
                    prev = rb.get("previous_due_date")
                    task.due_date = datetime.fromisoformat(prev) if prev else None
            else:
                continue
            step.status = AgentStepStatus.rolled_back
            step.updated_at = datetime.now(timezone.utc)
            rolled_back.append(step.id)
        except Exception:
            failed.append(step.id)
    agent_session.status = (
        AgentSessionStatus.rolled_back if not failed else AgentSessionStatus.failed
    )
    agent_session.updated_at = datetime.now(timezone.utc)
    return rolled_back, failed
