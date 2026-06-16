from __future__ import annotations

from typing import Any

from app.models.agent import AgentPlanStep, AgentStepAction


def build_step_diff(action: AgentStepAction, *, current: dict[str, Any] | None, proposed: dict[str, Any]) -> dict[str, Any]:
    current = current or {}
    if action in {AgentStepAction.create_project, AgentStepAction.create_task, AgentStepAction.create_subtask}:
        return {
            "kind": "create",
            "before": None,
            "after": proposed,
            "fields_changed": sorted(proposed.keys()),
        }
    if action == AgentStepAction.assign_user:
        return {
            "kind": "assign",
            "before": {"assignee_ids": current.get("assignee_ids", [])},
            "after": {"assignee_ids": proposed.get("assignee_ids", [])},
            "fields_changed": ["assignee_ids"],
        }
    if action == AgentStepAction.set_deadline:
        return {
            "kind": "reschedule",
            "before": {"due_date": current.get("due_date")},
            "after": {"due_date": proposed.get("due_date")},
            "fields_changed": ["due_date"],
        }
    if action == AgentStepAction.add_dependency:
        return {
            "kind": "dependency",
            "before": current,
            "after": proposed,
            "fields_changed": sorted(proposed.keys()),
        }
    return {
        "kind": "update",
        "before": current,
        "after": proposed,
        "fields_changed": sorted(set(current.keys()) | set(proposed.keys())),
    }


def summarize_steps(steps: list[AgentPlanStep]) -> str:
    creates = sum(1 for s in steps if s.action in {AgentStepAction.create_project, AgentStepAction.create_task, AgentStepAction.create_subtask})
    assignments = sum(1 for s in steps if s.action == AgentStepAction.assign_user)
    deadlines = sum(1 for s in steps if s.action == AgentStepAction.set_deadline)
    deps = sum(1 for s in steps if s.action == AgentStepAction.add_dependency)
    return f"Plan {creates} create action, {assignments} assignment update, {deadlines} deadline update and {deps} dependency proposal içeriyor; write işlemleri onaydan sonra uygulanır."
