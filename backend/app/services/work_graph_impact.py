from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from time import perf_counter

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.models.work_graph import WorkGraphImpactRun, WorkGraphNode, WorkGraphNodeType
from app.schemas.work_graph import (
    WorkGraphImpactRequest,
    WorkGraphImpactResponse,
    WorkGraphNodeRead,
)
from app.services import (
    rag_indexing,
    work_graph_audit,
    work_graph_risk,
    work_graph_sync,
    work_graph_traversal,
)
from app.services.work_graph_policy import entity_link, require_node_access


def node_to_read(
    node: WorkGraphNode, *, guild_id: int, score: float | None = None
) -> WorkGraphNodeRead:
    return WorkGraphNodeRead(
        id=node.id,
        entity_type=node.entity_type,
        entity_id=node.entity_id,
        label=node.label,
        status=node.status,
        priority=node.priority,
        owner_user_id=node.owner_user_id,
        deadline_at=node.deadline_at,
        project_id=node.project_id,
        initiative_id=node.initiative_id,
        score=score,
        link=entity_link(guild_id, node.entity_type, node.entity_id),
        metadata=node.graph_metadata or {},
    )


def _blast_radius(nodes: list[WorkGraphNode]) -> dict[str, int]:
    counter = Counter(node.entity_type.value for node in nodes)
    return {
        "tasks": counter.get("task", 0),
        "projects": counter.get("project", 0),
        "users": counter.get("user", 0),
        "documents": counter.get("document", 0),
        "deadlines": counter.get("deadline", 0),
        "deliverables": counter.get("deliverable", 0),
        "blockers": counter.get("blocker", 0),
        "total": len(nodes),
    }


def _recommendations(
    start: WorkGraphNode, impacted: list[WorkGraphNode], cycles: list[list[int]]
) -> list[str]:
    actions: list[str] = []
    if any(node.entity_type == WorkGraphNodeType.deadline for node in impacted):
        actions.append(
            "Deadline zinciri etkilendi; Agent Orchestrator ile yeniden planlama diff'i üret."
        )
    if any(node.entity_type == WorkGraphNodeType.blocker for node in impacted):
        actions.append(
            "Açık blocker etkisi var; blocker çözüm sahibi ve hedef çözüm tarihi ata."
        )
    if any(node.entity_type == WorkGraphNodeType.user for node in impacted):
        actions.append(
            "Etkilenen kullanıcıların aktif yükünü kontrol edip assignee dağılımını gözden geçir."
        )
    if cycles:
        actions.append(
            "Döngüsel dependency tespit edildi; dependency health raporundaki cycle'ı kır."
        )
    if not actions:
        actions.append(
            "Kritik yayılım düşük; yine de task tarihini ve bağımlılıklarını onay öncesi kontrol et."
        )
    return actions[:5]


async def find_node(
    session: AsyncSession,
    *,
    guild_id: int,
    entity_type: WorkGraphNodeType,
    entity_id: int,
) -> WorkGraphNode | None:
    result = await session.exec(
        select(WorkGraphNode).where(
            WorkGraphNode.guild_id == guild_id,
            WorkGraphNode.entity_type == entity_type,
            WorkGraphNode.entity_id == entity_id,
            WorkGraphNode.deleted_at.is_(None),
        )
    )
    return result.one_or_none()


async def analyze_impact(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: WorkGraphImpactRequest,
) -> WorkGraphImpactResponse:
    started = perf_counter()
    # Lazily materialize task nodes so first-use impact analysis works after migration.
    if request.entity_type == WorkGraphNodeType.task:
        await work_graph_sync.sync_task(
            session, guild_id=guild_id, task_id=request.entity_id, user_id=user.id
        )
    node = await find_node(
        session,
        guild_id=guild_id,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
    )
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="WORK_GRAPH_NODE_NOT_FOUND"
        )
    await require_node_access(
        session, guild_id=guild_id, user=user, node=node, access="read"
    )
    nodes, edges = await work_graph_traversal.load_scope_graph(
        session,
        guild_id=guild_id,
        initiative_id=node.initiative_id,
        project_id=node.project_id if node.project_id else None,
    )
    result = work_graph_traversal.traverse(
        start_node_id=node.id,
        nodes=nodes,
        edges=edges,
        direction=request.direction,
        max_depth=request.max_depth,
    )
    scored: dict[int, float] = {}
    for impacted in [node, *result.visited]:
        score, _level, _factors = await work_graph_risk.score_node(
            session, guild_id=guild_id, node=impacted
        )
        scored[impacted.id] = score
    direct = result.direct
    indirect = [
        item for item in result.visited if result.depth_by_node_id.get(item.id, 0) > 1
    ]
    critical = sorted(
        [
            item
            for item in result.visited
            if item.entity_type
            in {
                WorkGraphNodeType.task,
                WorkGraphNodeType.deadline,
                WorkGraphNodeType.deliverable,
                WorkGraphNodeType.milestone,
            }
        ],
        key=lambda item: (
            scored.get(item.id, 0.0),
            item.deadline_at or datetime.max.replace(tzinfo=timezone.utc),
        ),
        reverse=True,
    )[:10]
    blocked_by = [
        item for item in result.visited if item.entity_type == WorkGraphNodeType.blocker
    ]
    blocking = [
        item
        for item in result.visited
        if item.entity_type in {WorkGraphNodeType.task, WorkGraphNodeType.project}
        and scored.get(item.id, 0.0) >= 0.35
    ]
    deadlines = sorted(
        [
            item
            for item in result.visited
            if item.entity_type == WorkGraphNodeType.deadline
        ],
        key=lambda item: item.deadline_at or datetime.max.replace(tzinfo=timezone.utc),
    )[:10]
    deliverables = [
        item
        for item in result.visited
        if item.entity_type
        in {
            WorkGraphNodeType.deliverable,
            WorkGraphNodeType.milestone,
            WorkGraphNodeType.project,
        }
    ]
    users = [
        item for item in result.visited if item.entity_type == WorkGraphNodeType.user
    ]
    latency_ms = round((perf_counter() - started) * 1000, 2)
    blast = _blast_radius(result.visited)
    confidence = 0.92 if result.visited else 0.72
    payload = {
        "start_node_id": node.id,
        "direction": request.direction,
        "max_depth": request.max_depth,
        "blast_radius": blast,
        "cycles": result.cycles,
    }
    run = WorkGraphImpactRun(
        guild_id=guild_id,
        initiative_id=node.initiative_id,
        project_id=node.project_id,
        user_id=user.id,
        start_node_id=node.id,
        query_type="impact",
        traversal_depth=max(result.depth_by_node_id.values() or [0]),
        impacted_count=len(result.visited),
        result=payload,
        latency_ms=latency_ms,
    )
    session.add(run)
    await session.flush()
    await work_graph_audit.record_event(
        session,
        guild_id=guild_id,
        user_id=user.id,
        initiative_id=node.initiative_id,
        project_id=node.project_id,
        entity_id=node.entity_id,
        action_type="impact",
        traversal_depth=max(result.depth_by_node_id.values() or [0]),
        impacted_count=len(result.visited),
        latency_ms=latency_ms,
        payload=payload,
    )
    if node.initiative_id is not None and run.id is not None:
        summary = (
            f"Work Graph impact run for {node.entity_type.value} {node.label}. "
            f"Blast radius: {blast}. Cycles: {result.cycles}. "
            f"Recommended actions: {'; '.join(_recommendations(node, result.visited, result.cycles))}."
        )
        await rag_indexing.index_system_event_summary(
            session,
            user=user,
            guild_id=guild_id,
            initiative_id=node.initiative_id,
            project_id=node.project_id,
            entity_id=run.id,
            title=f"Work Graph Impact: {node.label}",
            content=summary,
            metadata={
                "source_type": "work_graph_impact",
                "start_node_id": node.id,
                "blast_radius": blast,
            },
        )

    return WorkGraphImpactResponse(
        run_id=run.id,
        start_node=node_to_read(node, guild_id=guild_id, score=scored.get(node.id)),
        directly_impacted=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in direct
        ],
        indirectly_impacted=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in indirect
        ],
        critical_path_impacted=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in critical
        ],
        blocked_by=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in blocked_by
        ],
        blocking=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in blocking
        ],
        at_risk_deadlines=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in deadlines
        ],
        affected_deliverables=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in deliverables
        ],
        affected_users=[
            node_to_read(item, guild_id=guild_id, score=scored.get(item.id))
            for item in users
        ],
        blast_radius=blast,
        cycles=result.cycles,
        confidence=confidence,
        recommended_actions=(
            _recommendations(node, result.visited, result.cycles)
            if request.include_recommendations
            else []
        ),
        latency_ms=latency_ms,
    )


async def critical_path(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    max_depth: int = 8,
):
    nodes, edges = await work_graph_traversal.load_scope_graph(
        session, guild_id=guild_id, initiative_id=initiative_id, project_id=project_id
    )
    task_nodes = [
        node for node in nodes.values() if node.entity_type == WorkGraphNodeType.task
    ]
    chains = []
    for node in task_nodes[:80]:
        tr = work_graph_traversal.traverse(
            start_node_id=node.id,
            nodes=nodes,
            edges=edges,
            direction="downstream",
            max_depth=max_depth,
        )
        chain = [
            node,
            *[
                item
                for item in tr.visited
                if item.entity_type
                in {
                    WorkGraphNodeType.task,
                    WorkGraphNodeType.deadline,
                    WorkGraphNodeType.project,
                }
            ],
        ]
        if len(chain) > 1:
            chains.append(chain)

    def _duration_weight(chain):
        # Duration-weighted critical path: effort metadata is preferred, then dependency depth and deadline pressure.
        effort = 0.0
        deadline_pressure = 0.0
        for item in chain:
            meta = item.graph_metadata or {}
            effort += float(
                meta.get("estimated_effort_minutes")
                or meta.get("duration_minutes")
                or 60
            )
            if item.deadline_at is not None:
                deadline_pressure += 1.0
        return effort + len(chain) * 30 + deadline_pressure * 120

    chains.sort(key=lambda chain: (_duration_weight(chain), len(chain)), reverse=True)
    fragile = []
    seen = set()
    for chain in chains[:10]:
        for item in chain:
            if item.id not in seen:
                seen.add(item.id)
                fragile.append(item)
    return chains[:5], fragile[:15]
