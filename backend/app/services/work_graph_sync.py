from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.document import Document
from app.models.initiative import Initiative
from app.models.project import Project
from app.models.task import Subtask, Task, TaskAssignee
from app.models.user import User
from app.models.work_graph import (
    Skill,
    TaskBlocker,
    TaskDependency,
    TaskRequiredSkill,
    UserSkill,
    WorkGraphBlockerStatus,
    WorkGraphEdge,
    WorkGraphEdgeType,
    WorkGraphNode,
    WorkGraphNodeType,
    WorkGraphSnapshot,
)
from app.services import work_graph_audit


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _status_value(task: Task) -> str | None:
    status_obj = getattr(task, "task_status", None)
    if status_obj is not None and getattr(status_obj, "category", None) is not None:
        return status_obj.category.value
    return None


async def ensure_node(
    session: AsyncSession,
    *,
    guild_id: int,
    entity_type: WorkGraphNodeType,
    entity_id: int,
    label: str,
    initiative_id: int | None = None,
    project_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    owner_user_id: int | None = None,
    deadline_at: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> WorkGraphNode:
    result = await session.exec(
        select(WorkGraphNode).where(
            WorkGraphNode.guild_id == guild_id,
            WorkGraphNode.entity_type == entity_type,
            WorkGraphNode.entity_id == entity_id,
        )
    )
    node = result.one_or_none()
    now = _now()
    if node is None:
        node = WorkGraphNode(
            guild_id=guild_id,
            initiative_id=initiative_id,
            project_id=project_id,
            entity_type=entity_type,
            entity_id=entity_id,
            label=label[:512],
            status=status,
            priority=priority,
            owner_user_id=owner_user_id,
            deadline_at=deadline_at,
            graph_metadata=metadata or {},
            created_at=now,
            updated_at=now,
        )
    else:
        node.initiative_id = initiative_id
        node.project_id = project_id
        node.label = label[:512]
        node.status = status
        node.priority = priority
        node.owner_user_id = owner_user_id
        node.deadline_at = deadline_at
        node.graph_metadata = metadata or {}
        node.updated_at = now
        node.deleted_at = None
    session.add(node)
    await session.flush()
    return node


async def ensure_edge(
    session: AsyncSession,
    *,
    guild_id: int,
    source_node_id: int,
    target_node_id: int,
    edge_type: WorkGraphEdgeType,
    initiative_id: int | None = None,
    weight: float = 1.0,
    confidence: float = 1.0,
    is_blocking: bool = False,
    lag_minutes: int = 0,
    created_by_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> WorkGraphEdge:
    result = await session.exec(
        select(WorkGraphEdge).where(
            WorkGraphEdge.guild_id == guild_id,
            WorkGraphEdge.source_node_id == source_node_id,
            WorkGraphEdge.target_node_id == target_node_id,
            WorkGraphEdge.edge_type == edge_type,
        )
    )
    edge = result.one_or_none()
    now = _now()
    if edge is None:
        edge = WorkGraphEdge(
            guild_id=guild_id,
            initiative_id=initiative_id,
            source_node_id=source_node_id,
            target_node_id=target_node_id,
            edge_type=edge_type,
            weight=weight,
            confidence=confidence,
            is_blocking=is_blocking,
            lag_minutes=lag_minutes,
            created_by_id=created_by_id,
            graph_metadata=metadata or {},
            created_at=now,
            updated_at=now,
        )
    else:
        edge.initiative_id = initiative_id
        edge.weight = weight
        edge.confidence = confidence
        edge.is_blocking = is_blocking
        edge.lag_minutes = lag_minutes
        edge.created_by_id = created_by_id or edge.created_by_id
        edge.graph_metadata = metadata or {}
        edge.updated_at = now
        edge.deleted_at = None
    session.add(edge)
    await session.flush()
    return edge


async def mark_entity_deleted(
    session: AsyncSession,
    *,
    guild_id: int,
    entity_type: WorkGraphNodeType,
    entity_id: int,
) -> int:
    now = _now()
    result = await session.exec(
        select(WorkGraphNode).where(
            WorkGraphNode.guild_id == guild_id,
            WorkGraphNode.entity_type == entity_type,
            WorkGraphNode.entity_id == entity_id,
            WorkGraphNode.deleted_at.is_(None),
        )
    )
    node = result.one_or_none()
    if node is None:
        return 0
    node.deleted_at = now
    node.updated_at = now
    session.add(node)
    edge_result = await session.exec(
        select(WorkGraphEdge).where(
            WorkGraphEdge.guild_id == guild_id,
            WorkGraphEdge.deleted_at.is_(None),
            (WorkGraphEdge.source_node_id == node.id)
            | (WorkGraphEdge.target_node_id == node.id),
        )
    )
    count = 1
    for edge in edge_result.all():
        edge.deleted_at = now
        edge.updated_at = now
        session.add(edge)
        count += 1
    return count


async def sync_project(
    session: AsyncSession, *, guild_id: int, project_id: int
) -> tuple[int, int]:
    result = await session.exec(
        select(Project)
        .where(Project.id == project_id, Project.guild_id == guild_id)
        .options(selectinload(Project.Initiative))
    )
    project = result.one_or_none()
    if project is None:
        return (0, 0)
    node = await ensure_node(
        session,
        guild_id=guild_id,
        initiative_id=project.initiative_id,
        project_id=project.id,
        entity_type=WorkGraphNodeType.project,
        entity_id=project.id,
        label=project.name,
        status="archived" if getattr(project, "is_archived", False) else "active",
        owner_user_id=project.owner_id,
        metadata={"description": project.description or ""},
    )
    nodes = 1
    edges = 0
    if project.initiative_id:
        init_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            project_id=None,
            entity_type=WorkGraphNodeType.Initiative,
            entity_id=project.initiative_id,
            label=project.Initiative.name if project.Initiative else f"Initiative {project.initiative_id}",
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            source_node_id=init_node.id,
            target_node_id=node.id,
            edge_type=WorkGraphEdgeType.contains,
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            source_node_id=node.id,
            target_node_id=init_node.id,
            edge_type=WorkGraphEdgeType.part_of,
        )
        edges += 2
    return (nodes, edges)


async def _sync_task_dependencies(
    session: AsyncSession, *, guild_id: int, task: Task, task_node: WorkGraphNode
) -> int:
    result = await session.exec(
        select(TaskDependency).where(
            TaskDependency.guild_id == guild_id,
            TaskDependency.deleted_at.is_(None),
            (TaskDependency.source_task_id == task.id)
            | (TaskDependency.target_task_id == task.id),
        )
    )
    edges = 0
    for dep in result.all():
        source_task = (
            await session.exec(select(Task).where(Task.id == dep.source_task_id))
        ).one_or_none()
        target_task = (
            await session.exec(select(Task).where(Task.id == dep.target_task_id))
        ).one_or_none()
        if source_task is None or target_task is None:
            continue
        source_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=dep.initiative_id,
            project_id=source_task.project_id,
            entity_type=WorkGraphNodeType.task,
            entity_id=source_task.id,
            label=source_task.title,
            status=_status_value(source_task),
            priority=source_task.priority.value if source_task.priority else None,
            owner_user_id=source_task.created_by_id,
            deadline_at=source_task.due_date,
        )
        target_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=dep.initiative_id,
            project_id=target_task.project_id,
            entity_type=WorkGraphNodeType.task,
            entity_id=target_task.id,
            label=target_task.title,
            status=_status_value(target_task),
            priority=target_task.priority.value if target_task.priority else None,
            owner_user_id=target_task.created_by_id,
            deadline_at=target_task.due_date,
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=dep.initiative_id,
            source_node_id=source_node.id,
            target_node_id=target_node.id,
            edge_type=WorkGraphEdgeType.depends_on,
            is_blocking=True,
            lag_minutes=dep.lag_minutes,
            created_by_id=dep.created_by_id,
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=dep.initiative_id,
            source_node_id=target_node.id,
            target_node_id=source_node.id,
            edge_type=WorkGraphEdgeType.blocks,
            is_blocking=True,
            lag_minutes=dep.lag_minutes,
            created_by_id=dep.created_by_id,
        )
        edges += 2
    return edges


async def _sync_task_blockers(
    session: AsyncSession, *, guild_id: int, task: Task, task_node: WorkGraphNode
) -> tuple[int, int]:
    result = await session.exec(
        select(TaskBlocker).where(
            TaskBlocker.guild_id == guild_id,
            TaskBlocker.task_id == task.id,
            TaskBlocker.deleted_at.is_(None),
            TaskBlocker.status == WorkGraphBlockerStatus.open,
        )
    )
    nodes = 0
    edges = 0
    for blocker in result.all():
        blocker_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=blocker.initiative_id,
            project_id=blocker.project_id,
            entity_type=WorkGraphNodeType.blocker,
            entity_id=blocker.id,
            label=blocker.title,
            status=blocker.status.value,
            priority=blocker.severity.value,
            owner_user_id=blocker.owner_user_id,
            metadata={"reason": blocker.reason, "severity": blocker.severity.value},
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=blocker.initiative_id,
            source_node_id=blocker_node.id,
            target_node_id=task_node.id,
            edge_type=WorkGraphEdgeType.blocks,
            weight=1.5 if blocker.severity.value in {"high", "critical"} else 1.0,
            is_blocking=True,
            created_by_id=blocker.created_by_id,
        )
        nodes += 1
        edges += 1
    return nodes, edges


async def _sync_task_skills(
    session: AsyncSession, *, guild_id: int, task: Task, task_node: WorkGraphNode
) -> tuple[int, int]:
    result = await session.exec(
        select(TaskRequiredSkill, Skill)
        .join(Skill, Skill.id == TaskRequiredSkill.skill_id)
        .where(
            TaskRequiredSkill.guild_id == guild_id,
            TaskRequiredSkill.task_id == task.id,
            Skill.deleted_at.is_(None),
        )
    )
    nodes = 0
    edges = 0
    for required, skill in result.all():
        skill_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=required.initiative_id,
            project_id=required.project_id,
            entity_type=WorkGraphNodeType.skill,
            entity_id=skill.id,
            label=skill.name,
            metadata={"required_level": required.required_level},
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=required.initiative_id,
            source_node_id=task_node.id,
            target_node_id=skill_node.id,
            edge_type=WorkGraphEdgeType.requires_skill,
            weight=float(required.required_level),
        )
        nodes += 1
        edges += 1
    return nodes, edges


async def sync_task(
    session: AsyncSession, *, guild_id: int, task_id: int, user_id: int | None = None
) -> tuple[int, int]:
    result = await session.exec(
        select(Task)
        .join(Task.project)
        .where(Task.id == task_id, Project.guild_id == guild_id)
        .options(
            selectinload(Task.project).selectinload(Project.Initiative),
            selectinload(Task.task_status),
            selectinload(Task.assignees),
            selectinload(Task.subtasks),
        )
    )
    task = result.one_or_none()
    if task is None:
        return (0, 0)
    project = task.project
    nodes, edges = await sync_project(
        session, guild_id=guild_id, project_id=task.project_id
    )
    task_node = await ensure_node(
        session,
        guild_id=guild_id,
        initiative_id=project.initiative_id,
        project_id=project.id,
        entity_type=WorkGraphNodeType.task,
        entity_id=task.id,
        label=task.title,
        status=_status_value(task),
        priority=task.priority.value if task.priority else None,
        owner_user_id=task.created_by_id,
        deadline_at=task.due_date,
        metadata={
            "description": task.description or "",
            "archived": bool(task.is_archived),
            "estimated_effort_minutes": task.estimated_effort_minutes,
            "actual_effort_minutes": task.actual_effort_minutes,
            "complexity_score": task.complexity_score,
            "assignment_locked": task.assignment_locked,
        },
    )
    project_node = await ensure_node(
        session,
        guild_id=guild_id,
        initiative_id=project.initiative_id,
        project_id=project.id,
        entity_type=WorkGraphNodeType.project,
        entity_id=project.id,
        label=project.name,
        owner_user_id=project.owner_id,
    )
    await ensure_edge(
        session,
        guild_id=guild_id,
        initiative_id=project.initiative_id,
        source_node_id=project_node.id,
        target_node_id=task_node.id,
        edge_type=WorkGraphEdgeType.contains,
    )
    await ensure_edge(
        session,
        guild_id=guild_id,
        initiative_id=project.initiative_id,
        source_node_id=task_node.id,
        target_node_id=project_node.id,
        edge_type=WorkGraphEdgeType.part_of,
    )
    nodes += 1
    edges += 2

    for assignee in task.assignees:
        if assignee.id is None:
            continue
        user_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            project_id=project.id,
            entity_type=WorkGraphNodeType.user,
            entity_id=assignee.id,
            label=assignee.full_name or assignee.email,
            metadata={"email": assignee.email},
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            source_node_id=task_node.id,
            target_node_id=user_node.id,
            edge_type=WorkGraphEdgeType.assigned_to,
        )
        nodes += 1
        edges += 1

    if task.due_date is not None:
        deadline_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            project_id=project.id,
            entity_type=WorkGraphNodeType.deadline,
            entity_id=task.id,
            label=f"Deadline: {task.title}",
            deadline_at=task.due_date,
            metadata={"task_id": task.id, "due_date": task.due_date.isoformat()},
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            source_node_id=task_node.id,
            target_node_id=deadline_node.id,
            edge_type=WorkGraphEdgeType.has_deadline,
            is_blocking=True,
        )
        nodes += 1
        edges += 1

    for subtask in task.subtasks:
        if subtask.id is None:
            continue
        sub_node = await ensure_node(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            project_id=project.id,
            entity_type=WorkGraphNodeType.subtask,
            entity_id=subtask.id,
            label=subtask.content,
            status="done" if subtask.is_completed else "todo",
            metadata={"task_id": task.id, "position": subtask.position},
        )
        await ensure_edge(
            session,
            guild_id=guild_id,
            initiative_id=project.initiative_id,
            source_node_id=task_node.id,
            target_node_id=sub_node.id,
            edge_type=WorkGraphEdgeType.contains,
        )
        nodes += 1
        edges += 1

    blocker_nodes, blocker_edges = await _sync_task_blockers(
        session, guild_id=guild_id, task=task, task_node=task_node
    )
    skill_nodes, skill_edges = await _sync_task_skills(
        session, guild_id=guild_id, task=task, task_node=task_node
    )
    dep_edges = await _sync_task_dependencies(
        session, guild_id=guild_id, task=task, task_node=task_node
    )
    nodes += blocker_nodes + skill_nodes
    edges += blocker_edges + skill_edges + dep_edges
    await work_graph_audit.record_event(
        session,
        guild_id=guild_id,
        user_id=user_id,
        initiative_id=project.initiative_id,
        project_id=project.id,
        entity_id=task.id,
        action_type="sync_task",
        payload={"nodes": nodes, "edges": edges},
    )
    return nodes, edges


async def sync_document(
    session: AsyncSession, *, guild_id: int, document_id: int
) -> tuple[int, int]:
    result = await session.exec(
        select(Document).where(
            Document.id == document_id, Document.guild_id == guild_id
        )
    )
    document = result.one_or_none()
    if document is None:
        return (0, 0)
    await ensure_node(
        session,
        guild_id=guild_id,
        initiative_id=document.initiative_id,
        project_id=None,
        entity_type=WorkGraphNodeType.document,
        entity_id=document.id,
        label=document.title,
        owner_user_id=document.created_by_id,
        metadata={
            "document_type": (
                document.document_type.value
                if hasattr(document.document_type, "value")
                else str(document.document_type)
            )
        },
    )
    return (1, 0)


async def rebuild_scope(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    user_id: int | None = None,
    dry_run: bool = False,
) -> tuple[int, int, WorkGraphSnapshot | None]:
    stmt = select(Task).join(Task.project).where(Project.guild_id == guild_id)
    if initiative_id is not None:
        stmt = stmt.where(Project.initiative_id == initiative_id)
    if project_id is not None:
        stmt = stmt.where(Project.id == project_id)
    result = await session.exec(stmt)
    tasks = result.all()
    if dry_run:
        return (len(tasks), 0, None)
    nodes = 0
    edges = 0
    projects = set()
    for task in tasks:
        projects.add(task.project_id)
    for pid in projects:
        pn, pe = await sync_project(session, guild_id=guild_id, project_id=pid)
        nodes += pn
        edges += pe
    for task in tasks:
        tn, te = await sync_task(
            session, guild_id=guild_id, task_id=task.id, user_id=user_id
        )
        nodes += tn
        edges += te
    snapshot = WorkGraphSnapshot(
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        graph_version=f"rebuild-{int(_now().timestamp())}",
        node_count=nodes,
        edge_count=edges,
        status="completed",
    )
    session.add(snapshot)
    await session.flush()
    await work_graph_audit.record_event(
        session,
        guild_id=guild_id,
        user_id=user_id,
        initiative_id=initiative_id,
        project_id=project_id,
        action_type="rebuild",
        impacted_count=nodes,
        payload={"nodes": nodes, "edges": edges},
    )
    return nodes, edges, snapshot
