from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import (
    GuildContext,
    RLSSessionDep,
    get_current_active_user,
    get_guild_membership,
)
from app.models.guild import GuildRole
from app.models.user import User
from app.schemas.rag import (
    RagAnswerRequest,
    RagAnswerResponse,
    RagEvaluationRequest,
    RagEvaluationResponse,
    RagHealthResponse,
    RagIndexStatusResponse,
    RagReindexRequest,
    RagReindexResponse,
    RagSearchRequest,
    RagSearchResponse,
    RagSourceBundleResponse,
)
from app.services import rag_answering, rag_evaluation, rag_indexing, rag_retrieval
from app.services.ai_settings import resolve_ai_settings
from app.services.rag_embeddings import embedding_model_name, resolve_embedding_settings

router = APIRouter()
GuildContextDep = Annotated[GuildContext, Depends(get_guild_membership)]


def _require_guild_admin(context: GuildContext) -> None:
    if context.role != GuildRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Guild admin role required"
        )


@router.post("/search", response_model=RagSearchResponse)
async def rag_search(
    payload: RagSearchRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagSearchResponse:
    return await rag_retrieval.search_workspace(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        request=payload,
    )


@router.post("/answer", response_model=RagAnswerResponse)
async def rag_answer(
    payload: RagAnswerRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagAnswerResponse:
    return await rag_answering.answer_workspace(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        request=payload,
    )


@router.post("/reindex", response_model=RagReindexResponse)
async def rag_reindex(
    payload: RagReindexRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagReindexResponse:
    _require_guild_admin(guild_context)
    queued, skipped = await rag_indexing.queue_reindex_scope(
        session,
        guild_id=guild_context.guild_id,
        initiative_id=payload.initiative_id,
        project_id=payload.project_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        full_rebuild=payload.full_rebuild,
        dry_run=payload.dry_run,
    )
    await session.commit()
    return RagReindexResponse(
        queued_jobs=queued,
        skipped_jobs=skipped,
        dry_run=payload.dry_run,
        message=(
            "RAG reindex jobs queued"
            if not payload.dry_run
            else "RAG reindex dry-run completed"
        ),
    )


@router.get("/sources/{answer_id}", response_model=RagSourceBundleResponse)
async def rag_sources(answer_id: str) -> RagSourceBundleResponse:
    # Answers are not currently persisted; clients receive citations inline in /rag/answer.
    return RagSourceBundleResponse(answer_id=answer_id, sources=[])


@router.get("/health", response_model=RagHealthResponse)
async def rag_health(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagHealthResponse:
    resolved = await resolve_embedding_settings(
        session, current_user, guild_context.guild_id
    )
    status_payload = await rag_indexing.index_status(
        session, guild_id=guild_context.guild_id
    )
    enabled = bool(resolved.enabled or resolved.provider is None)
    failed_jobs = int(status_payload["failed_jobs"])
    return RagHealthResponse(
        enabled=enabled,
        provider=resolved.provider.value if resolved.provider else "local",
        embedding_model=embedding_model_name(resolved),
        indexed_chunks=int(status_payload["indexed_chunks"]),
        queued_jobs=int(status_payload["queued_jobs"]),
        failed_jobs=failed_jobs,
        status="disabled" if not enabled else ("degraded" if failed_jobs else "ok"),
    )


@router.get("/index-status", response_model=RagIndexStatusResponse)
async def rag_index_status(
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagIndexStatusResponse:
    payload = await rag_indexing.index_status(session, guild_id=guild_context.guild_id)
    return RagIndexStatusResponse(**payload)


@router.post("/evaluate", response_model=RagEvaluationResponse)
async def rag_evaluate(
    payload: RagEvaluationRequest,
    session: RLSSessionDep,
    current_user: Annotated[User, Depends(get_current_active_user)],
    guild_context: GuildContextDep,
) -> RagEvaluationResponse:
    _require_guild_admin(guild_context)
    return await rag_evaluation.evaluate_rag(
        session,
        user=current_user,
        guild_id=guild_context.guild_id,
        request=payload,
    )
