from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from time import perf_counter
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.command import (
    CommandAuditAction,
    CommandAuditEvent,
    CommandIntent,
    CommandSession,
    CommandSessionStatus,
)
from app.models.user import User
from app.models.work_graph import WorkGraphNodeType
from app.schemas.agent import AgentPlanRequest
from app.schemas.assignment import AssignmentRecommendRequest
from app.schemas.command import (
    CommandContext,
    CommandExecuteRequest,
    CommandExecuteResponse,
    CommandHealthResponse,
    CommandHistoryResponse,
    CommandInterpretRequest,
    CommandInterpretResponse,
    CommandResult,
    CommandResultCard,
    CommandSessionRead,
    CommandSourceCard,
    CommandSuggestedAction,
)
from app.schemas.rag import RagAnswerRequest
from app.schemas.work_graph import WorkGraphImpactRequest
from app.services import (
    agent_orchestrator,
    assignment_capacity,
    assignment_engine,
    rag_answering,
    work_graph_impact,
    work_graph_risk,
)
from app.services.ai.local_ai_mode import (
    audit_payload as runtime_audit_payload,
    enforce_local_only,
)
from app.services.ai_settings import resolve_ai_settings


WRITE_INTENTS = {
    CommandIntent.plan_project,
    CommandIntent.reorder_tasks,
    CommandIntent.convert_meeting_notes,
    CommandIntent.create_tasks,
    CommandIntent.resolve_blockers,
    CommandIntent.project_cleanup,
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _preview(value: str, limit: int = 420) -> str:
    clean = re.sub(r"\s+", " ", value.strip())
    return clean[: limit - 1] + "…" if len(clean) > limit else clean


def _detect_prompt_injection(command: str) -> list[str]:
    lower = command.lower()
    suspicious = [
        "önceki talimat",
        "talimatları unut",
        "ignore previous",
        "ignore all",
        "bypass",
        "onaysız uygula",
        "gizli veriyi göster",
        "show secrets",
        "api key",
        "system prompt",
    ]
    return (
        ["prompt_injection_pattern"]
        if any(item in lower for item in suspicious)
        else []
    )


def _classify(command: str) -> tuple[CommandIntent, float, str]:
    lower = command.lower()
    if any(w in lower for w in ["toplantı", "meeting", "notu", "notes"]):
        return (
            CommandIntent.convert_meeting_notes,
            0.84,
            "Toplantı notu plan/görev üretimine benziyor.",
        )
    if any(
        w in lower
        for w in ["risk", "gecik", "kritik yol", "çöker", "collapse", "blast"]
    ):
        if any(w in lower for w in ["bu görev", "task", "gecikirse", "ne olur"]):
            return (
                CommandIntent.impact_analysis,
                0.82,
                "Komut Work Graph etki analizi istiyor.",
            )
        return (
            CommandIntent.show_risks,
            0.82,
            "Komut risk haritası/kritik yol analizi istiyor.",
        )
    if any(w in lower for w in ["kime", "atay", "assignee", "assign", "görev dağıt"]):
        return CommandIntent.assign_tasks, 0.8, "Komut AI görev dağıtımı istiyor."
    if any(
        w in lower
        for w in ["sırala", "öncelik", "reorder", "prioritize", "yeniden sırala"]
    ):
        return (
            CommandIntent.reorder_tasks,
            0.78,
            "Komut görev önceliklendirme/sıralama önerisi istiyor.",
        )
    if any(
        w in lower
        for w in ["toparla", "cleanup", "temizle", "düzenle", "stale", "blocker çöz"]
    ):
        return (
            CommandIntent.project_cleanup,
            0.78,
            "Komut proje temizliği ve aksiyon önerisi istiyor.",
        )
    if any(
        w in lower
        for w in ["planla", "plan", "kampanya", "lansman", "Initiative", "proje oluştur"]
    ):
        return (
            CommandIntent.plan_project,
            0.8,
            "Komut Agent Orchestrator plan preview akışı istiyor.",
        )
    if any(
        w in lower
        for w in ["görev oluştur", "task oluştur", "todo çıkar", "action item"]
    ):
        return CommandIntent.create_tasks, 0.76, "Komut görev üretimi istiyor."
    if any(w in lower for w in ["aç", "git", "open"]):
        return CommandIntent.open_entity, 0.58, "Komut navigasyon niyeti içeriyor."
    return (
        CommandIntent.ask_workspace,
        0.68,
        "Komut workspace içinde kaynaklı cevaplanacak soru gibi görünüyor.",
    )


def _execution_mode(intent: CommandIntent) -> str:
    if intent == CommandIntent.open_entity:
        return "navigation"
    if intent in WRITE_INTENTS:
        return "approval_required"
    return "read_only"


def _suggestions(intent: CommandIntent) -> list[CommandSuggestedAction]:
    base = [
        CommandSuggestedAction(
            action_id="ask_workspace",
            label="Workspace kaynaklarından cevapla",
            intent=CommandIntent.ask_workspace,
        ),
        CommandSuggestedAction(
            action_id="show_risks",
            label="Riskleri ve kritik yolu göster",
            intent=CommandIntent.show_risks,
        ),
        CommandSuggestedAction(
            action_id="plan_with_agent",
            label="Agent plan preview üret",
            intent=CommandIntent.plan_project,
            requires_approval=True,
        ),
        CommandSuggestedAction(
            action_id="assign_tasks",
            label="AI assignee öner",
            intent=CommandIntent.assign_tasks,
        ),
    ]
    if intent == CommandIntent.convert_meeting_notes:
        base.insert(
            0,
            CommandSuggestedAction(
                action_id="meeting_to_plan",
                label="Toplantı notunu plana çevir",
                intent=intent,
                requires_approval=True,
            ),
        )
    elif intent == CommandIntent.reorder_tasks:
        base.insert(
            0,
            CommandSuggestedAction(
                action_id="reorder_tasks",
                label="Görev sıralaması için diff üret",
                intent=intent,
                requires_approval=True,
            ),
        )
    elif intent == CommandIntent.project_cleanup:
        base.insert(
            0,
            CommandSuggestedAction(
                action_id="project_cleanup",
                label="Proje temizliği öner",
                intent=intent,
                requires_approval=True,
            ),
        )
    return base[:5]


async def interpret_command(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: CommandInterpretRequest,
) -> CommandInterpretResponse:
    intent, confidence, message = _classify(request.command)
    safety_flags = _detect_prompt_injection(request.command)
    if safety_flags:
        confidence = max(0.0, confidence - 0.18)
        message = f"{message} Şüpheli talimat kalıpları veri olarak ele alınacak."
    required_context = {
        "guild_id": guild_id,
        "initiative_id": request.context.initiative_id,
        "project_id": request.context.project_id,
        "entity_type": request.context.entity_type,
        "entity_id": request.context.entity_id,
        "route": request.context.route,
    }
    audit = CommandAuditEvent(
        guild_id=guild_id,
        initiative_id=request.context.initiative_id,
        project_id=request.context.project_id,
        user_id=user.id,
        action=CommandAuditAction.interpret,
        intent=intent,
        command_text_hash=_hash_text(request.command),
        payload={
            "confidence": confidence,
            "safety_flags": safety_flags,
            "required_context": required_context,
        },
    )
    session.add(audit)
    return CommandInterpretResponse(
        intent=intent,
        confidence=confidence,
        required_context=required_context,
        suggested_actions=_suggestions(intent),
        safety_flags=safety_flags,
        execution_mode=_execution_mode(intent),
        message=message,
    )


def _result_from_rag(raw: Any) -> CommandResult:
    citations = [
        CommandSourceCard(
            source_type=(
                item.source_type.value
                if hasattr(item.source_type, "value")
                else str(item.source_type)
            ),
            source_id=item.source_id,
            title=item.title,
            excerpt=item.excerpt,
            link=item.link,
            score=item.score,
        )
        for item in raw.citations
    ]
    return CommandResult(
        type="answer",
        title="Workspace answer",
        summary=raw.answer,
        sources=citations,
        cards=[
            CommandResultCard(
                title="Confidence",
                description=f"{round(raw.confidence * 100)}%",
                kind="metric",
                score=raw.confidence,
            ),
            CommandResultCard(
                title="Groundedness",
                description=f"{round(raw.groundedness_score * 100)}%",
                kind="metric",
                score=raw.groundedness_score,
            ),
        ],
        raw=raw.model_dump(mode="json"),
    )


def _result_from_agent(raw: Any, *, title: str) -> CommandResult:
    cards = [
        CommandResultCard(
            title=step.title,
            description=step.summary,
            kind=step.action.value,
            metadata={
                "step_id": step.id,
                "status": step.status.value,
                "requires_approval": step.requires_approval,
            },
        )
        for step in raw.steps[:20]
    ]
    return CommandResult(
        type="agent_plan",
        title=title,
        summary=raw.diff_summary,
        cards=cards,
        diff={
            "session_id": raw.session_id,
            "plan_version": raw.plan_version,
            "steps": [step.model_dump(mode="json") for step in raw.steps],
        },
        suggested_actions=[
            CommandSuggestedAction(
                action_id="approve_in_agent",
                label="Agent diff ekranında onayla",
                intent=CommandIntent.plan_project,
                requires_approval=True,
            )
        ],
        approval_state="awaiting_approval",
        raw=raw.model_dump(mode="json"),
    )


def _node_card(node: Any, *, kind: str = "risk") -> CommandResultCard:
    return CommandResultCard(
        title=node.label,
        description=f"{node.entity_type.value if hasattr(node.entity_type, 'value') else node.entity_type} · status={node.status or 'unknown'}",
        kind=kind,
        score=node.score,
        link=node.link,
        metadata={
            "entity_type": (
                node.entity_type.value
                if hasattr(node.entity_type, "value")
                else node.entity_type
            ),
            "entity_id": node.entity_id,
        },
    )


async def _execute_risks(
    session: AsyncSession, *, guild_id: int, context: CommandContext
) -> CommandResult:
    rows = await work_graph_risk.risk_map(
        session,
        guild_id=guild_id,
        initiative_id=context.initiative_id,
        project_id=context.project_id,
        limit=12,
    )
    chains, fragile = await work_graph_impact.critical_path(
        session,
        guild_id=guild_id,
        initiative_id=context.initiative_id,
        project_id=context.project_id,
        max_depth=6,
    )
    cards = []
    for node, risk in rows[:8]:
        read = work_graph_impact.node_to_read(node, guild_id=guild_id, score=risk.score)
        cards.append(
            CommandResultCard(
                title=read.label,
                description=f"Risk {risk.level} · score {round(risk.score * 100)}%",
                kind="risk",
                score=risk.score,
                link=read.link,
                metadata={"factors": risk.factors},
            )
        )
    for node in fragile[:4]:
        cards.append(
            _node_card(
                work_graph_impact.node_to_read(node, guild_id=guild_id), kind="fragile"
            )
        )
    summary = "Risk map generated from Work Graph."
    if chains:
        summary = f"{len(rows)} risk node and {len(chains)} critical-path chain found."
    return CommandResult(
        type="risk_map",
        title="Project risk overview",
        summary=summary,
        cards=cards,
        suggested_actions=[
            CommandSuggestedAction(
                action_id="replan",
                label="Agent ile yeniden planla",
                intent=CommandIntent.plan_project,
                requires_approval=True,
            )
        ],
        raw={
            "risk_count": len(rows),
            "critical_chain_count": len(chains),
            "fragile_node_count": len(fragile),
        },
    )


async def _execute_impact(
    session: AsyncSession, *, user: User, guild_id: int, context: CommandContext
) -> CommandResult:
    if context.entity_type and context.entity_id:
        entity_type = (
            WorkGraphNodeType(context.entity_type)
            if context.entity_type in WorkGraphNodeType._value2member_map_
            else WorkGraphNodeType.task
        )
        response = await work_graph_impact.analyze_impact(
            session,
            user=user,
            guild_id=guild_id,
            request=WorkGraphImpactRequest(
                entity_type=entity_type,
                entity_id=context.entity_id,
                direction="downstream",
                max_depth=5,
            ),
        )
        cards = [
            _node_card(item, kind="direct") for item in response.directly_impacted[:6]
        ]
        cards.extend(
            _node_card(item, kind="critical")
            for item in response.critical_path_impacted[:6]
        )
        return CommandResult(
            type="impact",
            title=f"Impact analysis: {response.start_node.label}",
            summary=f"Blast radius total: {response.blast_radius.get('total', 0)}. Recommended actions: {'; '.join(response.recommended_actions)}",
            cards=cards,
            suggested_actions=[
                CommandSuggestedAction(
                    action_id="replan_from_impact",
                    label="Bu etkiye göre Agent planı üret",
                    intent=CommandIntent.plan_project,
                    requires_approval=True,
                )
            ],
            raw=response.model_dump(mode="json"),
        )
    return await _execute_risks(session, guild_id=guild_id, context=context)


async def _execute_assignment(
    session: AsyncSession, *, user: User, guild_id: int, context: CommandContext
) -> CommandResult:
    if context.entity_type == "task" and context.entity_id:
        response = await assignment_engine.recommend_for_task(
            session, guild_id=guild_id, task_id=context.entity_id, requested_by=user
        )
        cards = []
        for candidate in response.candidates:
            cards.append(
                CommandResultCard(
                    title=candidate.recommended_user_name
                    or f"User #{candidate.recommended_user_id}",
                    description=candidate.reasoning,
                    kind="assignee",
                    score=candidate.score,
                    metadata={
                        "confidence": candidate.confidence,
                        "breakdown": candidate.score_breakdown,
                        "recommendation_id": candidate.id,
                    },
                )
            )
        return CommandResult(
            type="assignment",
            title="AI assignment recommendation",
            summary=(
                response.recommendation.reasoning
                if response.recommendation
                else "No assignable candidate found."
            ),
            cards=cards,
            suggested_actions=[
                CommandSuggestedAction(
                    action_id="apply_assignment",
                    label="Öneriyi assignment panelinde uygula",
                    intent=CommandIntent.assign_tasks,
                    requires_approval=(
                        response.recommendation.mode.value == "approval_required"
                        if response.recommendation
                        else True
                    ),
                )
            ],
            raw=response.model_dump(mode="json"),
        )
    capacity = await assignment_capacity.refresh_guild_capacity(
        session, guild_id=guild_id
    )
    cards = [
        CommandResultCard(
            title=f"User #{item.user_id}",
            description=f"Active {item.active_task_count} · overdue {item.overdue_task_count} · effort {item.estimated_effort_minutes}m",
            kind="capacity",
            score=max(0, 1 - min(1, item.active_task_count / 12)),
            metadata={"timezone": item.timezone, "role": item.role},
        )
        for item in capacity[:12]
    ]
    return CommandResult(
        type="assignment",
        title="Capacity map",
        summary=f"{len(capacity)} user capacity snapshots refreshed.",
        cards=cards,
        raw={"capacity_count": len(capacity)},
    )


async def execute_command(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: CommandExecuteRequest,
) -> CommandExecuteResponse:
    started = perf_counter()
    runtime_settings = enforce_local_only(
        await resolve_ai_settings(session, user, guild_id), operation="command.execute"
    )
    runtime_payload = runtime_audit_payload(
        runtime_settings, operation="command.execute"
    )
    interpreted = await interpret_command(
        session, user=user, guild_id=guild_id, request=request
    )
    intent = request.intent or interpreted.intent
    command_session = CommandSession(
        guild_id=guild_id,
        initiative_id=request.context.initiative_id,
        project_id=request.context.project_id,
        user_id=user.id,
        command_text_hash=_hash_text(request.command),
        command_preview=_preview(request.command),
        intent=intent,
        confidence=interpreted.confidence,
        status=CommandSessionStatus.running,
        required_context=interpreted.required_context,
        suggested_actions=[
            item.model_dump(mode="json") for item in interpreted.suggested_actions
        ],
        safety_flags=interpreted.safety_flags,
        approval_state=(
            "approval_required" if intent in WRITE_INTENTS else "not_required"
        ),
        model=runtime_payload.get("model"),
    )
    session.add(command_session)
    await session.flush()
    used_tools: list[str] = []
    result: CommandResult
    try:
        if (
            intent == CommandIntent.ask_workspace
            or intent == CommandIntent.summarize_project
        ):
            used_tools.append("rag.answer")
            rag_response = await rag_answering.answer_workspace(
                session,
                user=user,
                guild_id=guild_id,
                request=RagAnswerRequest(
                    query=request.command,
                    initiative_id=request.context.initiative_id,
                    project_id=request.context.project_id,
                    top_k=8,
                    max_context_chunks=8,
                    answer_style="actionable",
                ),
            )
            result = _result_from_rag(rag_response)
        elif intent in {
            CommandIntent.plan_project,
            CommandIntent.reorder_tasks,
            CommandIntent.convert_meeting_notes,
            CommandIntent.create_tasks,
            CommandIntent.project_cleanup,
            CommandIntent.resolve_blockers,
        }:
            used_tools.append("agent.plan")
            goal_prefix = {
                CommandIntent.reorder_tasks: "Görevleri dependency, deadline, blocker ve critical-path riskine göre yeniden sırala: ",
                CommandIntent.convert_meeting_notes: "Bu toplantı notunu goals, decisions, action items, owners, deadlines, blockers ve follow-up tasks olarak plana çevir: ",
                CommandIntent.create_tasks: "Bu metinden uygulanabilir task/subtask planı çıkar: ",
                CommandIntent.project_cleanup: "Bu proje için stale task, overdue item, unresolved blocker, duplicate task ve unclear deadline temizliği planla: ",
                CommandIntent.resolve_blockers: "Açık blockerları çözmek için güvenli aksiyon planı üret: ",
            }.get(intent, "")
            agent_response = await agent_orchestrator.create_plan(
                session,
                user=user,
                guild_id=guild_id,
                request=AgentPlanRequest(
                    goal=f"{goal_prefix}{request.command}",
                    initiative_id=request.context.initiative_id,
                    project_id=request.context.project_id,
                    max_steps=24,
                ),
            )
            result = _result_from_agent(agent_response, title="Agent plan preview")
        elif intent == CommandIntent.show_risks:
            used_tools.extend(["work_graph.risk_map", "work_graph.critical_path"])
            result = await _execute_risks(
                session, guild_id=guild_id, context=request.context
            )
        elif intent == CommandIntent.impact_analysis:
            used_tools.append("work_graph.impact")
            result = await _execute_impact(
                session, user=user, guild_id=guild_id, context=request.context
            )
        elif intent == CommandIntent.assign_tasks:
            used_tools.append("assignments.recommend")
            result = await _execute_assignment(
                session, user=user, guild_id=guild_id, context=request.context
            )
        else:
            result = CommandResult(
                type="navigation",
                title="Open entity",
                summary="Use search results or current page links to open the requested entity.",
                raw={},
            )
        latency_ms = round((perf_counter() - started) * 1000, 2)
        command_session.status = (
            CommandSessionStatus.awaiting_approval
            if result.approval_state == "awaiting_approval"
            else CommandSessionStatus.completed
        )
        command_session.result = result.model_dump(mode="json")
        command_session.used_tools = used_tools
        command_session.latency_ms = latency_ms
        command_session.updated_at = _now()
        session.add(command_session)
        session.add(
            CommandAuditEvent(
                session_id=command_session.id,
                guild_id=guild_id,
                initiative_id=request.context.initiative_id,
                project_id=request.context.project_id,
                user_id=user.id,
                action=CommandAuditAction.execute,
                intent=intent,
                command_text_hash=command_session.command_text_hash,
                used_tools=used_tools,
                approval_state=command_session.approval_state,
                latency_ms=latency_ms,
                payload={
                    "result_type": result.type,
                    "status": command_session.status.value,
                    "ai_runtime": runtime_payload,
                },
            )
        )
        return CommandExecuteResponse(
            session_id=command_session.id,
            status=command_session.status,
            intent=intent,
            confidence=command_session.confidence,
            used_tools=used_tools,
            approval_state=command_session.approval_state,
            latency_ms=latency_ms,
            result=result,
            safety_flags=command_session.safety_flags,
        )
    except Exception as exc:
        latency_ms = round((perf_counter() - started) * 1000, 2)
        command_session.status = CommandSessionStatus.failed
        command_session.error = str(exc)[:1000]
        command_session.latency_ms = latency_ms
        command_session.updated_at = _now()
        session.add(command_session)
        session.add(
            CommandAuditEvent(
                session_id=command_session.id,
                guild_id=guild_id,
                initiative_id=request.context.initiative_id,
                project_id=request.context.project_id,
                user_id=user.id,
                action=CommandAuditAction.error,
                intent=intent,
                command_text_hash=command_session.command_text_hash,
                used_tools=used_tools,
                approval_state=command_session.approval_state,
                latency_ms=latency_ms,
                payload={"error": str(exc)[:1000], "ai_runtime": runtime_payload},
            )
        )
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="COMMAND_EXECUTION_FAILED",
        ) from exc


def _session_read(item: CommandSession) -> CommandSessionRead:
    return CommandSessionRead(
        id=item.id,
        intent=item.intent,
        status=item.status,
        confidence=item.confidence,
        command_preview=item.command_preview,
        required_context=item.required_context or {},
        suggested_actions=item.suggested_actions or [],
        safety_flags=item.safety_flags or [],
        result=item.result or {},
        used_tools=item.used_tools or [],
        approval_state=item.approval_state,
        latency_ms=item.latency_ms,
        error=item.error,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def read_session(
    session: AsyncSession, *, guild_id: int, user: User, session_id: int
) -> CommandSessionRead:
    row = (
        await session.exec(
            select(CommandSession).where(
                CommandSession.guild_id == guild_id,
                CommandSession.user_id == user.id,
                CommandSession.id == session_id,
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="COMMAND_SESSION_NOT_FOUND"
        )
    return _session_read(row)


async def read_history(
    session: AsyncSession, *, guild_id: int, user: User, limit: int = 25
) -> CommandHistoryResponse:
    rows = (
        await session.exec(
            select(CommandSession)
            .where(
                CommandSession.guild_id == guild_id, CommandSession.user_id == user.id
            )
            .order_by(CommandSession.created_at.desc())
            .limit(limit)
        )
    ).all()
    return CommandHistoryResponse(items=[_session_read(row) for row in rows])


def health() -> CommandHealthResponse:
    return CommandHealthResponse(
        enabled=True,
        status="ok",
        supported_intents=list(CommandIntent),
        policy={
            "write_actions": "delegated_to_agent_preview_diff_approval",
            "permission_context": "guild_rls_and_service_policy",
            "prompt_injection_content": "treated_as_data",
            "audit": "command_sessions_and_command_audit_events",
            "local_ai_mode": "server_side_provider_resolution_blocks_cloud_fallback_when_local_only",
        },
    )
