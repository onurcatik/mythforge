from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.work_graph import (
    TaskBlocker,
    TaskDependency,
    TaskRequiredSkill,
    UserSkill,
    WorkGraphBlockerSeverity,
    WorkGraphBlockerStatus,
    WorkGraphNode,
    WorkGraphNodeType,
    WorkGraphRiskScore,
)

_PRIORITY_WEIGHT = {"low": 0.05, "medium": 0.12, "high": 0.22, "urgent": 0.32}
_STATUS_WEIGHT = {"backlog": 0.05, "todo": 0.12, "in_progress": 0.18, "done": -0.25}
_SEVERITY_WEIGHT = {"low": 0.08, "medium": 0.16, "high": 0.28, "critical": 0.40}


def level_for_score(score: float) -> str:
    if score >= 0.80:
        return "critical"
    if score >= 0.60:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


async def score_node(
    session: AsyncSession, *, guild_id: int, node: WorkGraphNode
) -> tuple[float, str, dict[str, Any]]:
    score = 0.05
    factors: dict[str, Any] = {}
    if node.priority:
        weight = _PRIORITY_WEIGHT.get(node.priority, 0.0)
        score += weight
        factors["priority"] = weight
    if node.status:
        weight = _STATUS_WEIGHT.get(node.status, 0.0)
        score += weight
        factors["status"] = weight
    if node.deadline_at:
        now = datetime.now(timezone.utc)
        hours = (node.deadline_at - now).total_seconds() / 3600
        if hours < 0:
            score += 0.35
            factors["overdue"] = 0.35
        elif hours <= 24:
            score += 0.25
            factors["deadline_24h"] = 0.25
        elif hours <= 72:
            score += 0.14
            factors["deadline_72h"] = 0.14
    if node.entity_type == WorkGraphNodeType.task:
        blockers = await session.exec(
            select(TaskBlocker).where(
                TaskBlocker.guild_id == guild_id,
                TaskBlocker.task_id == node.entity_id,
                TaskBlocker.deleted_at.is_(None),
                TaskBlocker.status == WorkGraphBlockerStatus.open,
            )
        )
        blocker_weight = 0.0
        for blocker in blockers.all():
            blocker_weight += _SEVERITY_WEIGHT.get(blocker.severity.value, 0.12)
        if blocker_weight:
            score += min(blocker_weight, 0.45)
            factors["open_blockers"] = min(blocker_weight, 0.45)
        dep_count = (
            await session.exec(
                select(func.count())
                .select_from(TaskDependency)
                .where(
                    TaskDependency.guild_id == guild_id,
                    TaskDependency.deleted_at.is_(None),
                    (TaskDependency.source_task_id == node.entity_id)
                    | (TaskDependency.target_task_id == node.entity_id),
                )
            )
        ).one()
        if dep_count:
            weight = min(float(dep_count) * 0.04, 0.24)
            score += weight
            factors["dependency_degree"] = weight
        required = (
            await session.exec(
                select(TaskRequiredSkill).where(
                    TaskRequiredSkill.guild_id == guild_id,
                    TaskRequiredSkill.task_id == node.entity_id,
                )
            )
        ).all()
        if required and node.owner_user_id:
            user_skill_ids = {
                row.skill_id
                for row in (
                    await session.exec(
                        select(UserSkill).where(
                            UserSkill.guild_id == guild_id,
                            UserSkill.user_id == node.owner_user_id,
                        )
                    )
                ).all()
            }
            missing = [
                row.skill_id for row in required if row.skill_id not in user_skill_ids
            ]
            if missing:
                weight = min(len(missing) * 0.1, 0.3)
                score += weight
                factors["skill_mismatch"] = weight
    score = max(0.0, min(1.0, score))
    return score, level_for_score(score), factors


async def upsert_score(
    session: AsyncSession, *, guild_id: int, node: WorkGraphNode
) -> WorkGraphRiskScore:
    score, level, factors = await score_node(session, guild_id=guild_id, node=node)
    result = await session.exec(
        select(WorkGraphRiskScore).where(
            WorkGraphRiskScore.guild_id == guild_id,
            WorkGraphRiskScore.node_id == node.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        row = WorkGraphRiskScore(
            guild_id=guild_id,
            initiative_id=node.initiative_id,
            project_id=node.project_id,
            node_id=node.id,
            score=score,
            level=level,
            factors=factors,
        )
    else:
        row.initiative_id = node.initiative_id
        row.project_id = node.project_id
        row.score = score
        row.level = level
        row.factors = factors
        row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    await session.flush()
    return row


async def risk_map(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    limit: int = 50,
):
    stmt = select(WorkGraphNode).where(
        WorkGraphNode.guild_id == guild_id,
        WorkGraphNode.deleted_at.is_(None),
        WorkGraphNode.entity_type == WorkGraphNodeType.task,
    )
    if initiative_id is not None:
        stmt = stmt.where(WorkGraphNode.initiative_id == initiative_id)
    if project_id is not None:
        stmt = stmt.where(WorkGraphNode.project_id == project_id)
    stmt = stmt.limit(500)
    nodes = (await session.exec(stmt)).all()
    rows = []
    for node in nodes:
        row = await upsert_score(session, guild_id=guild_id, node=node)
        rows.append((node, row))
    rows.sort(key=lambda pair: pair[1].score, reverse=True)
    return rows[:limit]
