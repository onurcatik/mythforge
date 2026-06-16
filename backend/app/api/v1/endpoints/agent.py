from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import GuildContext, RLSSessionDep, get_current_active_user, get_guild_membership
from app.models.agent import AgentApprovalDecision
from app.models.user import User
from app.schemas.agent import (
    AgentApprovalRequest,
    AgentApprovalResponse,
    AgentAuditResponse,
    AgentDiffRequest,
    AgentDiffResponse,
    AgentEvaluationRequest,
    AgentEvaluationResponse,
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentHealthResponse,
    AgentPlanRequest,
    AgentPlanResponse,
    AgentRejectRequest,
    AgentRollbackRequest,
    AgentRollbackResponse,
)
from app.services import agent_evaluation, agent_orchestrator

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


@router.post("/plan", response_model=AgentPlanResponse)
async def plan_with_agent(
    request: AgentPlanRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentPlanResponse:
    return await agent_orchestrator.create_plan(session, user=current_user, guild_id=guild_context.guild_id, request=request)


@router.post("/diff", response_model=AgentDiffResponse)
async def diff_agent_plan(
    request: AgentDiffRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentDiffResponse:
    return await agent_orchestrator.get_diff(session, user=current_user, guild_id=guild_context.guild_id, session_id=request.session_id)


@router.post("/approve", response_model=AgentApprovalResponse)
async def approve_agent_plan(
    request: AgentApprovalRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentApprovalResponse:
    return await agent_orchestrator.approve_or_reject(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        session_id=request.session_id,
        expected_plan_version=request.expected_plan_version,
        decision=request.decision,
        step_ids=request.step_ids,
        reason=request.reason,
    )


@router.post("/execute", response_model=AgentExecuteResponse)
async def execute_agent_plan(
    request: AgentExecuteRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentExecuteResponse:
    return await agent_orchestrator.execute_approved(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        session_id=request.session_id,
        expected_plan_version=request.expected_plan_version,
        step_ids=request.step_ids,
    )


@router.post("/reject", response_model=AgentApprovalResponse)
async def reject_agent_plan(
    request: AgentRejectRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentApprovalResponse:
    return await agent_orchestrator.reject_plan(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        session_id=request.session_id,
        expected_plan_version=request.expected_plan_version,
        reason=request.reason,
    )


@router.post("/rollback", response_model=AgentRollbackResponse)
async def rollback_agent_plan(
    request: AgentRollbackRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentRollbackResponse:
    rolled_back, failed, status = await agent_orchestrator.rollback_session(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        session_id=request.session_id,
        step_ids=request.step_ids,
    )
    return AgentRollbackResponse(session_id=request.session_id, status=status, rolled_back_step_ids=rolled_back, failed_step_ids=failed)


@router.get("/sessions/{session_id}", response_model=AgentPlanResponse)
async def get_agent_session(
    session_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentPlanResponse:
    return await agent_orchestrator.read_session(session, user=current_user, guild_id=guild_context.guild_id, session_id=session_id)


@router.get("/audit/{session_id}", response_model=AgentAuditResponse)
async def get_agent_audit(
    session_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentAuditResponse:
    return await agent_orchestrator.read_audit(session, user=current_user, guild_id=guild_context.guild_id, session_id=session_id)


@router.get("/health", response_model=AgentHealthResponse)
async def agent_health() -> AgentHealthResponse:
    return AgentHealthResponse(
        enabled=True,
        status="ok",
        planning_requires_approval=True,
        write_without_approval=False,
        policy={
            "critical_writes_require_approval": True,
            "cross_guild_access": "blocked",
            "prompt_injection_content": "treated_as_data",
            "execution_requires_plan_version_match": True,
        },
    )


@router.post("/evaluate", response_model=AgentEvaluationResponse)
async def evaluate_agent(
    request: AgentEvaluationRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> AgentEvaluationResponse:
    return await agent_evaluation.evaluate_agent(session, guild_id=guild_context.guild_id, session_id=request.session_id, samples=request.samples)
