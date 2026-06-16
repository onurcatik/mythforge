from datetime import datetime, timezone

from app.models.work_graph import WorkGraphEdge, WorkGraphEdgeType, WorkGraphNode, WorkGraphNodeType
from app.services.work_graph_traversal import traverse


def _node(node_id: int, label: str = "n") -> WorkGraphNode:
    return WorkGraphNode(
        id=node_id,
        guild_id=1,
        entity_type=WorkGraphNodeType.task,
        entity_id=node_id,
        label=label,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _edge(edge_id: int, source: int, target: int, edge_type: WorkGraphEdgeType = WorkGraphEdgeType.blocks) -> WorkGraphEdge:
    return WorkGraphEdge(
        id=edge_id,
        guild_id=1,
        source_node_id=source,
        target_node_id=target,
        edge_type=edge_type,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def test_traverse_downstream_is_cycle_safe():
    nodes = {idx: _node(idx) for idx in (1, 2, 3)}
    edges = [_edge(1, 1, 2), _edge(2, 2, 3), _edge(3, 3, 1)]
    result = traverse(start_node_id=1, nodes=nodes, edges=edges, direction="downstream", max_depth=5)
    assert [node.id for node in result.visited] == [2, 3]
    assert result.cycles == [[1, 2, 3, 1]]
    assert result.depth_by_node_id[3] == 2
