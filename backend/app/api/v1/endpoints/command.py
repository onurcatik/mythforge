from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import GuildContext, RLSSessionDep, get_current_active_user, get_guild_membership
from app.models.user import User
from app.schemas.command import (
    CommandExecuteRequest,
    CommandExecuteResponse,
    CommandHealthResponse,
    CommandHistoryResponse,
    CommandInterpretRequest,
    CommandInterpretResponse,
    CommandSessionRead,
)
from app.services import command_center

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


@router.post("/interpret", response_model=CommandInterpretResponse)
async def interpret_command(
    payload: CommandInterpretRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> CommandInterpretResponse:
    response = await command_center.interpret_command(session, user=current_user, guild_id=guild_context.guild_id, request=payload)
    await session.commit()
    return response


@router.post("/execute", response_model=CommandExecuteResponse)
async def execute_command(
    payload: CommandExecuteRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> CommandExecuteResponse:
    response = await command_center.execute_command(session, user=current_user, guild_id=guild_context.guild_id, request=payload)
    await session.commit()
    return response


@router.get("/sessions/{session_id}", response_model=CommandSessionRead)
async def get_command_session(
    session_id: int,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> CommandSessionRead:
    return await command_center.read_session(session, guild_id=guild_context.guild_id, user=current_user, session_id=session_id)


@router.get("/history", response_model=CommandHistoryResponse)
async def get_command_history(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
    limit: int = Query(default=25, ge=1, le=100),
) -> CommandHistoryResponse:
    return await command_center.read_history(session, guild_id=guild_context.guild_id, user=current_user, limit=limit)


@router.get("/health", response_model=CommandHealthResponse)
async def get_command_health() -> CommandHealthResponse:
    return command_center.health()
