from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.assignment import UserCapacitySnapshot
from app.models.task import Task, TaskAssignee, TaskStatus, TaskStatusCategory
from app.models.user import User
from app.models.work_graph import TaskRequiredSkill, UserSkill, WorkGraphNode, WorkGraphNodeType, WorkGraphRiskScore


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _priority_weight(priority: str | None) -> float:
    return {"low": 0.3, "medium": 0.55, "high": 0.8, "urgent": 1.0}.get(priority or "medium", 0.55)


def _timezone_fit(user_tz: str | None, *, urgent: bool) -> float:
    if not urgent:
        return 0.75
    try:
        local_hour = datetime.now(ZoneInfo(user_tz or "UTC")).hour
    except ZoneInfoNotFoundError:
        local_hour = datetime.now(timezone.utc).hour
    if 8 <= local_hour <= 19:
        return 1.0
    if 6 <= local_hour <= 22:
        return 0.72
    return 0.35


async def skill_match_score(session: AsyncSession, *, guild_id: int, task_id: int, user_id: int) -> tuple[float, dict]:
    required = (await session.exec(select(TaskRequiredSkill).where(TaskRequiredSkill.guild_id == guild_id, TaskRequiredSkill.task_id == task_id))).all()
    if not required:
        return 0.8, {"required": 0, "matched": 0, "missing": []}
    required_by_skill = {item.skill_id: item.required_level for item in required}
    user_skills = (await session.exec(select(UserSkill).where(UserSkill.guild_id == guild_id, UserSkill.user_id == user_id, UserSkill.skill_id.in_(tuple(required_by_skill.keys()))))).all()
    matched = 0
    missing: list[int] = []
    for skill_id, level in required_by_skill.items():
        have = next((item for item in user_skills if item.skill_id == skill_id), None)
        if have and have.level >= level:
            matched += 1
        else:
            missing.append(skill_id)
    return matched / max(1, len(required)), {"required": len(required), "matched": matched, "missing_skill_ids": missing}


async def historical_delivery_score(session: AsyncSession, *, guild_id: int, user_id: int) -> tuple[float, dict]:
    done_count = int((await session.exec(
        select(func.count()).select_from(TaskAssignee).join(Task, Task.id == TaskAssignee.task_id).join(TaskStatus, TaskStatus.id == Task.task_status_id).where(
            TaskAssignee.guild_id == guild_id,
            TaskAssignee.user_id == user_id,
            TaskStatus.category == TaskStatusCategory.done,
        )
    )).one() or 0)
    overdue_done = int((await session.exec(
        select(func.count()).select_from(TaskAssignee).join(Task, Task.id == TaskAssignee.task_id).join(TaskStatus, TaskStatus.id == Task.task_status_id).where(
            TaskAssignee.guild_id == guild_id,
            TaskAssignee.user_id == user_id,
            TaskStatus.category == TaskStatusCategory.done,
            Task.due_date.is_not(None),
            Task.completed_at.is_not(None),
            Task.completed_at > Task.due_date,
        )
    )).one() or 0)
    if done_count == 0:
        return 0.62, {"completed": 0, "overdue_done": 0, "basis": "cold_start"}
    overdue_rate = overdue_done / max(1, done_count)
    score = _clamp(0.9 - overdue_rate * 0.45 + min(done_count, 20) * 0.005)
    return score, {"completed": done_count, "overdue_done": overdue_done, "overdue_rate": round(overdue_rate, 3)}


async def graph_risk_fit(session: AsyncSession, *, guild_id: int, task_id: int) -> tuple[float, dict]:
    node = (await session.exec(select(WorkGraphNode).where(WorkGraphNode.guild_id == guild_id, WorkGraphNode.entity_type == WorkGraphNodeType.task, WorkGraphNode.entity_id == task_id, WorkGraphNode.deleted_at.is_(None)))).one_or_none()
    if node is None:
        return 0.72, {"risk_score": None, "blast_radius": 0}
    risk = (await session.exec(select(WorkGraphRiskScore).where(WorkGraphRiskScore.guild_id == guild_id, WorkGraphRiskScore.node_id == node.id))).one_or_none()
    risk_score = risk.score if risk is not None else 0.25
    blast_radius = int((risk.factors or {}).get("blast_radius", 0)) if risk is not None else 0
    return _clamp(1.0 - risk_score * 0.35), {"risk_score": risk_score, "blast_radius": blast_radius, "node_id": node.id}


def capacity_score(snapshot: UserCapacitySnapshot) -> tuple[float, dict]:
    load_penalty = min(snapshot.active_task_count / 12, 0.55)
    effort_penalty = min(snapshot.estimated_effort_minutes / (40 * 60), 0.25)
    overdue_penalty = min(snapshot.overdue_task_count * 0.08, 0.24)
    blocker_penalty = min(snapshot.blocker_owner_count * 0.04, 0.16)
    score = _clamp(1.0 - load_penalty - effort_penalty - overdue_penalty - blocker_penalty)
    return score, {
        "active_task_count": snapshot.active_task_count,
        "estimated_effort_minutes": snapshot.estimated_effort_minutes,
        "overdue_task_count": snapshot.overdue_task_count,
        "blocker_owner_count": snapshot.blocker_owner_count,
    }


async def score_candidate(session: AsyncSession, *, guild_id: int, task: Task, user: User, capacity: UserCapacitySnapshot, role: str) -> tuple[float, float, dict]:
    skill_score, skill_raw = await skill_match_score(session, guild_id=guild_id, task_id=task.id, user_id=user.id)
    workload_score, workload_raw = capacity_score(capacity)
    history_score, history_raw = await historical_delivery_score(session, guild_id=guild_id, user_id=user.id)
    graph_score, graph_raw = await graph_risk_fit(session, guild_id=guild_id, task_id=task.id)
    urgent = (task.priority.value if task.priority else "medium") in {"urgent", "high"}
    timezone_score = _timezone_fit(user.timezone, urgent=urgent)
    role_score = 1.0 if role in {"admin", "member"} else 0.7
    priority_score = _priority_weight(task.priority.value if task.priority else None)
    deadline_score = 0.78
    if task.due_date is not None:
        hours_left = max((task.due_date - datetime.now(timezone.utc)).total_seconds() / 3600, 0)
        effort_hours = max((task.estimated_effort_minutes or 60) / 60, 1)
        deadline_score = _clamp(hours_left / max(effort_hours * 2.5, 1))
    blocker_score = _clamp(1.0 - min(capacity.blocker_owner_count * 0.08, 0.4))
    fairness_score = _clamp(1.0 - min(capacity.active_task_count / 20, 0.35))
    weights = {
        "skill_match": 0.20,
        "role_match": 0.08,
        "workload_balance": 0.20,
        "deadline_feasibility": 0.14,
        "historical_delivery": 0.12,
        "priority_fit": 0.06,
        "timezone_fit": 0.07,
        "blocker_load": 0.06,
        "graph_risk_fit": 0.05,
        "fairness_fit": 0.02,
    }
    components = {
        "skill_match": skill_score,
        "role_match": role_score,
        "workload_balance": workload_score,
        "deadline_feasibility": deadline_score,
        "historical_delivery": history_score,
        "priority_fit": priority_score,
        "timezone_fit": timezone_score,
        "blocker_load": blocker_score,
        "graph_risk_fit": graph_score,
        "fairness_fit": fairness_score,
    }
    score = sum(components[key] * weights[key] for key in weights)
    evidence_count = 4 + int(skill_raw.get("required", 0) > 0) + int(history_raw.get("completed", 0) > 0) + int(graph_raw.get("risk_score") is not None)
    confidence = _clamp(0.52 + evidence_count * 0.06 - (0.18 if skill_score < 0.5 else 0.0))
    breakdown = {**components, "raw": {"skill": skill_raw, "workload": workload_raw, "history": history_raw, "graph": graph_raw, "weights": weights}}
    return round(score, 4), round(confidence, 4), breakdown
