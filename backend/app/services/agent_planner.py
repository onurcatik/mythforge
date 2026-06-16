from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agent import (
    AgentPlanStep,
    AgentSession,
    AgentSessionStatus,
    AgentStepAction,
)
from app.models.initiative import Initiative, InitiativeMember
from app.models.project import Project
from app.models.user import User
from app.schemas.agent import AgentPlanRequest
from app.schemas.rag import RagSearchRequest
from app.services.agent_diff import build_step_diff, summarize_steps
from app.services.ai.local_ai_mode import (
    audit_payload as runtime_audit_payload,
    enforce_local_only,
)
from app.services.ai_settings import resolve_ai_settings
from app.services.agent_policy import (
    can_create_projects,
    detect_goal_injection,
    get_accessible_initiative,
    get_project_for_write,
)
from app.services.rag_retrieval import search_workspace
from app.services import work_graph_impact


def _compact_goal(goal: str) -> str:
    value = re.sub(r"\s+", " ", goal.strip())
    return value[:240]


def _title_from_goal(goal: str) -> str:
    clean = _compact_goal(goal)
    lower = clean.lower()
    if "kampanya" in lower or "campaign" in lower:
        return "AI Campaign Plan"
    if len(clean) <= 64:
        return clean[0].upper() + clean[1:]
    return clean[:61].rstrip() + "..."


def _task_templates(goal: str) -> list[dict[str, Any]]:
    lower = goal.lower()
    if any(
        word in lower
        for word in ("kampanya", "campaign", "marketing", "lansman", "launch")
    ):
        return [
            {
                "title": "Hedef ve başarı metriklerini netleştir",
                "description": "Kampanyanın hedef segmentini, teklifini, KPI setini ve kabul kriterlerini tanımla.",
                "subtasks": [
                    "Hedef kitleyi yaz",
                    "KPI listesini belirle",
                    "Başarı eşiğini onaylat",
                ],
            },
            {
                "title": "Kanal ve içerik stratejisini oluştur",
                "description": "Kampanya kanallarını, mesaj mimarisini, içerik formatlarını ve yayın frekansını planla.",
                "subtasks": [
                    "Kanal listesini çıkar",
                    "Ana mesajları yaz",
                    "İçerik takvimini taslakla",
                ],
            },
            {
                "title": "Landing ve dönüşüm akışını hazırla",
                "description": "Landing page, form, takip eventi ve dönüşüm ölçümünü yayına hazır hale getir.",
                "subtasks": [
                    "Landing brief hazırla",
                    "Form alanlarını belirle",
                    "Analytics eventlerini tanımla",
                ],
            },
            {
                "title": "Lansman öncesi kalite kontrol yap",
                "description": "İçerik, link, hedefleme, bütçe, event tracking ve yasal uygunluk kontrolünü tamamla.",
                "subtasks": ["Linkleri test et", "Tracking doğrula", "Yayın onayı al"],
            },
            {
                "title": "Performansı izle ve optimizasyon döngüsü kur",
                "description": "İlk sonuçları izle, düşük performanslı kanalları işaretle ve optimizasyon aksiyonlarını çıkar.",
                "subtasks": [
                    "Günlük metrik raporu oluştur",
                    "A/B test adaylarını belirle",
                    "Optimizasyon backlog'u aç",
                ],
            },
        ]
    return [
        {
            "title": "Hedefi ve kapsamı netleştir",
            "description": "İstenen sonucu, sınırları, başarı kriterlerini ve teslimatları açık hale getir.",
            "subtasks": [
                "Başarı kriterlerini yaz",
                "Kapsam dışını belirle",
                "Teslimat listesini onaylat",
            ],
        },
        {
            "title": "İş kırılımını ve bağımlılıkları çıkar",
            "description": "Ana iş paketlerini, bağımlılıkları ve kritik yolu planla.",
            "subtasks": [
                "Ana iş paketlerini listele",
                "Bağımlılıkları işaretle",
                "Riskli adımları belirle",
            ],
        },
        {
            "title": "Uygulama ve takip planını başlat",
            "description": "Sorumluları, deadline'ları ve takip ritmini belirleyerek execution döngüsünü başlat.",
            "subtasks": [
                "Sorumluları ata",
                "Deadline önerilerini gözden geçir",
                "Takip ritmini belirle",
            ],
        },
    ]


async def _initiative_members(session: AsyncSession, initiative_id: int) -> list[User]:
    stmt = (
        select(InitiativeMember)
        .where(InitiativeMember.initiative_id == initiative_id)
        .options(selectinload(InitiativeMember.user))
    )
    result = await session.exec(stmt)
    users: list[User] = []
    for membership in result.all():
        if membership.user is not None:
            users.append(membership.user)
    return users


def _round_robin_user(users: list[User], index: int, fallback: User) -> User:
    usable = [u for u in users if u.id is not None]
    return usable[index % len(usable)] if usable else fallback


async def _rag_context(
    session: AsyncSession, *, user: User, guild_id: int, request: AgentPlanRequest
) -> list[dict[str, Any]]:
    try:
        response = await search_workspace(
            session,
            user=user,
            guild_id=guild_id,
            request=RagSearchRequest(
                query=request.goal,
                initiative_id=request.initiative_id,
                project_id=request.project_id,
                top_k=5,
            ),
        )
    except Exception:
        return []
    return [
        {
            "citation_key": item.citation_key,
            "source_type": item.source_type.value,
            "source_id": item.source_id,
            "title": item.title,
            "score": item.score,
        }
        for item in response.results
    ]


async def _work_graph_context(
    session: AsyncSession, *, guild_id: int, request: AgentPlanRequest
) -> list[dict[str, Any]]:
    if request.project_id is None and request.initiative_id is None:
        return []
    try:
        chains, fragile = await work_graph_impact.critical_path(
            session,
            guild_id=guild_id,
            initiative_id=request.initiative_id,
            project_id=request.project_id,
            max_depth=5,
        )
    except Exception:
        return []
    if not chains and not fragile:
        return []
    return [
        {
            "source_type": "work_graph",
            "title": "Work Graph risk context",
            "critical_chain_count": len(chains),
            "fragile_node_count": len(fragile),
            "top_fragile_nodes": [node.label for node in fragile[:5]],
        }
    ]


def _step(
    *,
    guild_id: int,
    session_id: int,
    initiative_id: int | None,
    project_id: int | None,
    order: int,
    action: AgentStepAction,
    entity_type: str,
    title: str,
    summary: str,
    rationale: str,
    proposed: dict[str, Any],
    current: dict[str, Any] | None = None,
) -> AgentPlanStep:
    return AgentPlanStep(
        session_id=session_id,
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        step_order=order,
        action=action,
        entity_type=entity_type,
        title=title,
        summary=summary,
        rationale=rationale,
        proposed_patch=proposed,
        current_snapshot=current or {},
        diff=build_step_diff(action, current=current, proposed=proposed),
        requires_approval=True,
    )


async def build_plan(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: AgentPlanRequest,
) -> tuple[AgentSession, list[AgentPlanStep]]:
    Initiative: Initiative | None = None
    project: Project | None = None
    if request.project_id is not None:
        project = await get_project_for_write(
            session, guild_id=guild_id, user=user, project_id=request.project_id
        )
        Initiative = await get_accessible_initiative(
            session, guild_id=guild_id, user=user, initiative_id=project.initiative_id
        )
    else:
        Initiative = await get_accessible_initiative(
            session, guild_id=guild_id, user=user, initiative_id=request.initiative_id
        )

    runtime_settings = enforce_local_only(
        await resolve_ai_settings(session, user, guild_id), operation="agent.plan"
    )
    runtime_payload = runtime_audit_payload(runtime_settings, operation="agent.plan")
    can_create = (
        await can_create_projects(session, initiative_id=Initiative.id, user=user)
        if Initiative.id
        else False
    )
    context = await _rag_context(session, user=user, guild_id=guild_id, request=request)
    context.extend(
        await _work_graph_context(session, guild_id=guild_id, request=request)
    )
    injection_flags = detect_goal_injection(request.goal)
    templates = _task_templates(request.goal)
    members = await _initiative_members(session, Initiative.id) if Initiative.id else []
    title = _title_from_goal(request.goal)
    confidence = 0.76 if context else 0.66
    if injection_flags:
        confidence -= 0.18

    assumptions = [
        "Plan preview modunda üretildi; kritik write işlemleri açık kullanıcı onayı olmadan uygulanmaz.",
        "Assignee önerileri mevcut Initiative üyeleri, round-robin kapasite yaklaşımı ve varsa Work Graph risk bağlamı ile başlangıç seviyesi hesaplandı.",
        "Deadline önerileri görev sırası, varsayılan iş günü aralığı ve mevcut graph critical-path sinyallerine göre üretildi.",
    ]
    if runtime_settings.local_only:
        assumptions.append(
            "Local AI Mode aktif; planlama cloud modele veri göndermeden Local Ollama runtime policy altında yürütülür."
        )
    if not context:
        assumptions.append(
            "Workspace RAG bağlamı bulunamadı veya erişilebilir kaynak yok; plan hedef metni üzerinden üretildi."
        )
    if injection_flags:
        assumptions.append(
            "Hedef metninde talimat manipülasyonu benzeri ifadeler veri olarak işaretlendi ve sistem talimatı sayılmadı."
        )

    risks = [
        {
            "severity": "medium",
            "title": "Kapasite varsayımı",
            "mitigation": "Onaydan önce assignee ve deadline kartlarını gözden geçir.",
        },
        {
            "severity": "medium",
            "title": "Eksik bağlam",
            "mitigation": "RAG kaynakları azsa ilgili brief veya karar dokümanını workspace'e ekle.",
        },
    ]
    if injection_flags:
        risks.append(
            {
                "severity": "high",
                "title": "Prompt injection sinyali",
                "mitigation": "Plan sadece veri olarak işlendi; execution policy onaysız yazmayı engeller.",
            }
        )

    agent_session = AgentSession(
        guild_id=guild_id,
        initiative_id=Initiative.id,
        project_id=project.id if project else None,
        user_id=user.id,
        goal=request.goal,
        normalized_goal=_compact_goal(request.goal),
        status=AgentSessionStatus.planning,
        confidence=max(0.0, min(1.0, confidence)),
        model=runtime_payload.get("model") or "agent-orchestrator-heuristic-v1",
        assumptions=assumptions,
        risks=risks,
        required_approvals=[
            "create_project",
            "create_task",
            "create_subtask",
            "assign_user",
            "set_deadline",
        ],
        context_summary=context,
        session_metadata={
            "prompt_injection_flags": injection_flags,
            "dry_run": request.dry_run,
            "ai_runtime": runtime_payload,
        },
    )
    session.add(agent_session)
    await session.flush()

    steps: list[AgentPlanStep] = []
    order = 1
    project_key = "existing_project" if project else "new_project_1"
    if project is None:
        if not can_create:
            agent_session.status = AgentSessionStatus.failed
            raise PermissionError("CREATE_PROJECT_PERMISSION_REQUIRED")
        proposed_project = {
            "project_key": project_key,
            "name": title,
            "description": f"Agent-generated project plan for: {request.goal}",
            "initiative_id": Initiative.id,
            "owner_id": user.id,
            "icon": (
                "🚀"
                if (
                    "kampanya" in request.goal.lower()
                    or "campaign" in request.goal.lower()
                )
                else "🧭"
            ),
        }
        steps.append(
            _step(
                guild_id=guild_id,
                session_id=agent_session.id,
                initiative_id=Initiative.id,
                project_id=None,
                order=order,
                action=AgentStepAction.create_project,
                entity_type="project",
                title=f"Project oluştur: {title}",
                summary="Hedef için yeni project açılır.",
                rationale="Kullanıcı hedefi task zincirine dönüştürmek için bir proje konteyneri gerektiriyor.",
                proposed=proposed_project,
            )
        )
        order += 1

    today = datetime.now(timezone.utc).replace(
        hour=17, minute=0, second=0, microsecond=0
    )
    task_limit = max(1, min(len(templates), max(1, (request.max_steps - order) // 4)))
    for index, template in enumerate(templates[:task_limit]):
        task_key = f"task_{index + 1}"
        assignee = _round_robin_user(members, index, user)
        due = today + timedelta(days=(index + 1) * 3)
        task_patch = {
            "task_key": task_key,
            "project_key": project_key,
            "project_id": project.id if project else None,
            "title": template["title"],
            "description": template["description"],
            "priority": "medium" if index < task_limit - 1 else "high",
        }
        steps.append(
            _step(
                guild_id=guild_id,
                session_id=agent_session.id,
                initiative_id=Initiative.id,
                project_id=project.id if project else None,
                order=order,
                action=AgentStepAction.create_task,
                entity_type="task",
                title=f"Task oluştur: {template['title']}",
                summary=template["description"],
                rationale="Hedefin uygulanabilir iş paketine bölünmesi için ana görev oluşturulur.",
                proposed=task_patch,
            )
        )
        order += 1
        steps.append(
            _step(
                guild_id=guild_id,
                session_id=agent_session.id,
                initiative_id=Initiative.id,
                project_id=project.id if project else None,
                order=order,
                action=AgentStepAction.assign_user,
                entity_type="task",
                title=f"Assignee öner: {template['title']}",
                summary=f"Görev {assignee.full_name or 'selected member'} kullanıcısına atanır.",
                rationale="Başlangıç ataması Initiative üyeleri arasında dengeli dağıtım varsayımıyla önerildi.",
                proposed={
                    "task_key": task_key,
                    "assignee_ids": [assignee.id],
                    "reason": "Initiative member round-robin capacity seed",
                },
                current={"assignee_ids": []},
            )
        )
        order += 1
        steps.append(
            _step(
                guild_id=guild_id,
                session_id=agent_session.id,
                initiative_id=Initiative.id,
                project_id=project.id if project else None,
                order=order,
                action=AgentStepAction.set_deadline,
                entity_type="task",
                title=f"Deadline öner: {template['title']}",
                summary=f"Önerilen deadline: {due.date().isoformat()}.",
                rationale="Deadline, görev sırası ve varsayılan üç günlük execution aralıklarıyla hesaplandı.",
                proposed={
                    "task_key": task_key,
                    "due_date": due.isoformat(),
                    "reason": "sequential three-day planning cadence",
                },
                current={"due_date": None},
            )
        )
        order += 1
        for sub_index, subtask in enumerate(template["subtasks"][:3]):
            if order > request.max_steps:
                break
            steps.append(
                _step(
                    guild_id=guild_id,
                    session_id=agent_session.id,
                    initiative_id=Initiative.id,
                    project_id=project.id if project else None,
                    order=order,
                    action=AgentStepAction.create_subtask,
                    entity_type="subtask",
                    title=f"Subtask oluştur: {subtask}",
                    summary=subtask,
                    rationale="Ana görevi takip edilebilir küçük adıma böler.",
                    proposed={
                        "task_key": task_key,
                        "content": subtask,
                        "position": sub_index,
                    },
                )
            )
            order += 1
            if order > request.max_steps:
                break
        if order > request.max_steps:
            break

    for step in steps:
        session.add(step)
    agent_session.status = AgentSessionStatus.awaiting_approval
    agent_session.session_metadata = {
        **agent_session.session_metadata,
        "diff_summary": summarize_steps(steps),
    }
    await session.flush()
    return agent_session, steps
