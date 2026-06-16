from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.work_graph import WorkGraphEdge, WorkGraphEdgeType, WorkGraphNode

DOWNSTREAM_TYPES = {
    WorkGraphEdgeType.blocks,
    WorkGraphEdgeType.impacts,
    WorkGraphEdgeType.contains,
    WorkGraphEdgeType.has_deadline,
    WorkGraphEdgeType.assigned_to,
}
UPSTREAM_TYPES = {
    WorkGraphEdgeType.depends_on,
    WorkGraphEdgeType.part_of,
    WorkGraphEdgeType.requires_skill,
}


@dataclass
class TraversalResult:
    visited: list[WorkGraphNode]
    direct: list[WorkGraphNode]
    edges: list[WorkGraphEdge]
    depth_by_node_id: dict[int, int]
    cycles: list[list[int]]


async def load_scope_graph(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    max_nodes: int = 2500,
) -> tuple[dict[int, WorkGraphNode], list[WorkGraphEdge]]:
    node_stmt = select(WorkGraphNode).where(
        WorkGraphNode.guild_id == guild_id, WorkGraphNode.deleted_at.is_(None)
    )
    if initiative_id is not None:
        node_stmt = node_stmt.where(WorkGraphNode.initiative_id == initiative_id)
    if project_id is not None:
        node_stmt = node_stmt.where(WorkGraphNode.project_id == project_id)
    node_stmt = node_stmt.limit(max_nodes)
    nodes = {
        node.id: node
        for node in (await session.exec(node_stmt)).all()
        if node.id is not None
    }
    if not nodes:
        return {}, []
    edge_stmt = select(WorkGraphEdge).where(
        WorkGraphEdge.guild_id == guild_id,
        WorkGraphEdge.deleted_at.is_(None),
        WorkGraphEdge.source_node_id.in_(tuple(nodes.keys())),
        WorkGraphEdge.target_node_id.in_(tuple(nodes.keys())),
    )
    edges = (await session.exec(edge_stmt)).all()
    return nodes, edges


def traverse(
    *,
    start_node_id: int,
    nodes: dict[int, WorkGraphNode],
    edges: list[WorkGraphEdge],
    direction: str = "downstream",
    max_depth: int = 5,
) -> TraversalResult:
    adjacency: dict[int, list[tuple[int, WorkGraphEdge]]] = defaultdict(list)
    for edge in edges:
        allowed = False
        if direction in {"downstream", "both"} and edge.edge_type in DOWNSTREAM_TYPES:
            adjacency[edge.source_node_id].append((edge.target_node_id, edge))
            allowed = True
        if direction in {"upstream", "both"} and edge.edge_type in UPSTREAM_TYPES:
            adjacency[edge.source_node_id].append((edge.target_node_id, edge))
            allowed = True
        if direction == "both" and not allowed:
            adjacency[edge.source_node_id].append((edge.target_node_id, edge))

    queue: deque[tuple[int, int, tuple[int, ...]]] = deque(
        [(start_node_id, 0, (start_node_id,))]
    )
    seen: set[int] = {start_node_id}
    ordered: list[WorkGraphNode] = []
    traversed_edges: list[WorkGraphEdge] = []
    depth_by_node_id: dict[int, int] = {start_node_id: 0}
    cycles: list[list[int]] = []

    while queue:
        current, depth, path = queue.popleft()
        if depth >= max_depth:
            continue
        for target, edge in adjacency.get(current, []):
            if target not in nodes:
                continue
            if target in path:
                cycles.append(list(path + (target,)))
                continue
            traversed_edges.append(edge)
            if target in seen:
                continue
            seen.add(target)
            depth_by_node_id[target] = depth + 1
            ordered.append(nodes[target])
            queue.append((target, depth + 1, path + (target,)))

    direct = [node for node in ordered if depth_by_node_id.get(node.id, 99) == 1]
    return TraversalResult(
        visited=ordered,
        direct=direct,
        edges=traversed_edges,
        depth_by_node_id=depth_by_node_id,
        cycles=cycles[:20],
    )
