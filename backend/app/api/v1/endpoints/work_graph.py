from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import select

from app.api.deps import (
    GuildContext,
    RLSSessionDep,
    get_current_active_user,
    get_guild_membership,
)
from app.models.guild import GuildRole
from app.models.user import User
from app.models.work_graph import (
    TaskBlocker,
    TaskDependency,
    WorkGraphAuditEvent,
    WorkGraphEdge,
    WorkGraphNode,
    WorkGraphNodeType,
)
from app.schemas.work_graph import (
    WorkGraphAuditResponse,
    WorkGraphCriticalPathResponse,
    WorkGraphEdgesResponse,
    WorkGraphHealthResponse,
    WorkGraphImpactRequest,
    WorkGraphImpactResponse,
    WorkGraphNodesResponse,
    WorkGraphRebuildRequest,
    WorkGraphRebuildResponse,
    WorkGraphRiskItem,
    WorkGraphRiskMapResponse,
    WorkGraphSyncRequest,
)
from app.services import (
    work_graph_impact,
    work_graph_risk,
    work_graph_sync,
    work_graph_jobs,
)
from app.services.work_graph_policy import require_node_access

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


def _require_guild_admin(context: GuildContext) -> None:
    if context.role != GuildRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Guild admin role required"
        )


@router.get("/nodes", response_model=WorkGraphNodesResponse)
async def list_work_graph_nodes(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    initiative_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    entity_type: WorkGraphNodeType | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> WorkGraphNodesResponse:
    stmt = select(WorkGraphNode).where(
        WorkGraphNode.guild_id == guild_context.guild_id,
        WorkGraphNode.deleted_at.is_(None),
    )
    if initiative_id is not None:
        stmt = stmt.where(WorkGraphNode.initiative_id == initiative_id)
    if project_id is not None:
        stmt = stmt.where(WorkGraphNode.project_id == project_id)
    if entity_type is not None:
        stmt = stmt.where(WorkGraphNode.entity_type == entity_type)
    stmt = stmt.limit(limit)
    nodes = (await session.exec(stmt)).all()
    # Per-node project DAC guard. RLS/guild guard already scopes rows; this removes project-level leaks.
    visible = []
    for node in nodes:
        await require_node_access(
            session,
            guild_id=guild_context.guild_id,
            user=current_user,
            node=node,
            access="read",
        )
        visible.append(
            work_graph_impact.node_to_read(node, guild_id=guild_context.guild_id)
        )
    return WorkGraphNodesResponse(nodes=visible, total=len(visible))


@router.get("/edges", response_model=WorkGraphEdgesResponse)
async def list_work_graph_edges(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    initiative_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> WorkGraphEdgesResponse:
    node_stmt = select(WorkGraphNode.id).where(
        WorkGraphNode.guild_id == guild_context.guild_id,
        WorkGraphNode.deleted_at.is_(None),
    )
    if initiative_id is not None:
        node_stmt = node_stmt.where(WorkGraphNode.initiative_id == initiative_id)
    if project_id is not None:
        node_stmt = node_stmt.where(WorkGraphNode.project_id == project_id)
    node_ids = [row for row in (await session.exec(node_stmt.limit(1000))).all()]
    if not node_ids:
        return WorkGraphEdgesResponse(edges=[], total=0)
    edges = (
        await session.exec(
            select(WorkGraphEdge)
            .where(
                WorkGraphEdge.guild_id == guild_context.guild_id,
                WorkGraphEdge.deleted_at.is_(None),
                WorkGraphEdge.source_node_id.in_(tuple(node_ids)),
                WorkGraphEdge.target_node_id.in_(tuple(node_ids)),
            )
            .limit(limit)
        )
    ).all()
    return WorkGraphEdgesResponse(
        edges=[
            {
                "id": edge.id,
                "source_node_id": edge.source_node_id,
                "target_node_id": edge.target_node_id,
                "edge_type": edge.edge_type,
                "weight": edge.weight,
                "confidence": edge.confidence,
                "is_blocking": edge.is_blocking,
                "lag_minutes": edge.lag_minutes,
                "metadata": edge.graph_metadata or {},
            }
            for edge in edges
        ],
        total=len(edges),
    )


@router.post("/rebuild", response_model=WorkGraphRebuildResponse)
async def rebuild_work_graph(
    payload: WorkGraphRebuildRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphRebuildResponse:
    _require_guild_admin(guild_context)
    snapshot = await work_graph_jobs.enqueue_rebuild(
        session,
        guild_id=guild_context.guild_id,
        initiative_id=payload.initiative_id,
        project_id=payload.project_id,
        user_id=current_user.id,
        dry_run=payload.dry_run,
    )
    await session.commit()
    return WorkGraphRebuildResponse(
        queued=True,
        dry_run=payload.dry_run,
        nodes_synced=0,
        edges_synced=0,
        snapshot_id=snapshot.id,
        message="Work Graph rebuild queued; background worker will update snapshot status",
    )


@router.post("/sync", response_model=WorkGraphRebuildResponse)
async def sync_work_graph_entity(
    payload: WorkGraphSyncRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphRebuildResponse:
    _require_guild_admin(guild_context)
    nodes = edges = 0
    if payload.entity_type == WorkGraphNodeType.task:
        nodes, edges = await work_graph_sync.sync_task(
            session,
            guild_id=guild_context.guild_id,
            task_id=payload.entity_id,
            user_id=current_user.id,
        )
    elif payload.entity_type == WorkGraphNodeType.project:
        nodes, edges = await work_graph_sync.sync_project(
            session, guild_id=guild_context.guild_id, project_id=payload.entity_id
        )
    elif payload.entity_type == WorkGraphNodeType.document:
        nodes, edges = await work_graph_sync.sync_document(
            session, guild_id=guild_context.guild_id, document_id=payload.entity_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sync entity type",
        )
    await session.commit()
    return WorkGraphRebuildResponse(
        nodes_synced=nodes, edges_synced=edges, message="Work Graph entity synced"
    )


@router.post("/impact", response_model=WorkGraphImpactResponse)
async def analyze_work_graph_impact(
    payload: WorkGraphImpactRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphImpactResponse:
    response = await work_graph_impact.analyze_impact(
        session, user=current_user, guild_id=guild_context.guild_id, request=payload
    )
    await session.commit()
    return response


@router.get("/critical-path", response_model=WorkGraphCriticalPathResponse)
async def get_critical_path(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    initiative_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
) -> WorkGraphCriticalPathResponse:
    chains, fragile = await work_graph_impact.critical_path(
        session,
        guild_id=guild_context.guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
    )
    return WorkGraphCriticalPathResponse(
        scope={"initiative_id": initiative_id, "project_id": project_id},
        chains=[
            [
                work_graph_impact.node_to_read(node, guild_id=guild_context.guild_id)
                for node in chain
            ]
            for chain in chains
        ],
        fragile_nodes=[
            work_graph_impact.node_to_read(node, guild_id=guild_context.guild_id)
            for node in fragile
        ],
        recommended_actions=[
            "En uzun zincirdeki task deadline ve blocker durumlarını Agent Orchestrator preview ile yeniden simüle et."
        ],
    )


@router.get("/risk-map", response_model=WorkGraphRiskMapResponse)
async def get_risk_map(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    initiative_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
) -> WorkGraphRiskMapResponse:
    rows = await work_graph_risk.risk_map(
        session,
        guild_id=guild_context.guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        limit=limit,
    )
    by_project: dict[str, float] = {}
    by_assignee: dict[str, float] = {}
    by_deadline: dict[str, float] = {}
    by_blocker: dict[str, float] = {}
    items = []
    for node, risk in rows:
        read = work_graph_impact.node_to_read(
            node, guild_id=guild_context.guild_id, score=risk.score
        )
        items.append(
            WorkGraphRiskItem(
                node=read, score=risk.score, level=risk.level, factors=risk.factors
            )
        )
        if node.project_id is not None:
            by_project[str(node.project_id)] = max(
                by_project.get(str(node.project_id), 0.0), risk.score
            )
        if node.owner_user_id is not None:
            by_assignee[str(node.owner_user_id)] = max(
                by_assignee.get(str(node.owner_user_id), 0.0), risk.score
            )
        if node.deadline_at is not None:
            by_deadline[node.deadline_at.date().isoformat()] = max(
                by_deadline.get(node.deadline_at.date().isoformat(), 0.0), risk.score
            )
        if "open_blockers" in (risk.factors or {}):
            by_blocker[str(node.entity_id)] = risk.factors["open_blockers"]
    await session.commit()
    return WorkGraphRiskMapResponse(
        items=items,
        by_project=by_project,
        by_assignee=by_assignee,
        by_deadline=by_deadline,
        by_blocker=by_blocker,
    )


@router.get("/health", response_model=WorkGraphHealthResponse)
async def work_graph_health(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphHealthResponse:
    nodes = (
        await session.exec(
            select(func.count())
            .select_from(WorkGraphNode)
            .where(
                WorkGraphNode.guild_id == guild_context.guild_id,
                WorkGraphNode.deleted_at.is_(None),
            )
        )
    ).one()
    edges = (
        await session.exec(
            select(func.count())
            .select_from(WorkGraphEdge)
            .where(
                WorkGraphEdge.guild_id == guild_context.guild_id,
                WorkGraphEdge.deleted_at.is_(None),
            )
        )
    ).one()
    open_blockers = (
        await session.exec(
            select(func.count())
            .select_from(TaskBlocker)
            .where(
                TaskBlocker.guild_id == guild_context.guild_id,
                TaskBlocker.deleted_at.is_(None),
            )
        )
    ).one()
    dependencies = (
        await session.exec(
            select(func.count())
            .select_from(TaskDependency)
            .where(
                TaskDependency.guild_id == guild_context.guild_id,
                TaskDependency.deleted_at.is_(None),
            )
        )
    ).one()
    return WorkGraphHealthResponse(
        enabled=True,
        status="ok",
        nodes=int(nodes or 0),
        edges=int(edges or 0),
        open_blockers=int(open_blockers or 0),
        dependencies=int(dependencies or 0),
        policy={
            "cross_guild_graph_leak": "blocked_by_rls",
            "project_permission_filter": "enforced_on_nodes_and_impact",
            "deleted_entity_leak": "blocked_by_deleted_at_filter",
            "agent_execution": "graph_outputs_are_preview_only_until_agent_approval",
        },
    )


@router.get("/audit/{entity_id}", response_model=WorkGraphAuditResponse)
async def work_graph_audit(
    entity_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> WorkGraphAuditResponse:
    rows = (
        await session.exec(
            select(WorkGraphAuditEvent)
            .where(
                WorkGraphAuditEvent.guild_id == guild_context.guild_id,
                WorkGraphAuditEvent.entity_id == entity_id,
            )
            .order_by(WorkGraphAuditEvent.created_at.desc())
            .limit(50)
        )
    ).all()
    return WorkGraphAuditResponse(
        events=[
            {
                "id": row.id,
                "action_type": row.action_type,
                "project_id": row.project_id,
                "initiative_id": row.initiative_id,
                "traversal_depth": row.traversal_depth,
                "impacted_count": row.impacted_count,
                "latency_ms": row.latency_ms,
                "policy_decision": row.policy_decision,
                "payload": row.payload,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    )
