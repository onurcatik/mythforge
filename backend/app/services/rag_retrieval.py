from __future__ import annotations

import math
import time
from dataclasses import dataclass

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.pam_context import has_active_grant
from app.models.document import Document
from app.models.project import Project
from app.models.rag import RagChunk, RagSourceType
from app.models.task import Task
from app.models.user import User
from app.schemas.rag import RagCitation, RagSearchRequest, RagSearchResponse
from app.services import permissions as permissions_service
from app.services.rag_embeddings import embed_texts, resolve_embedding_settings
from app.services.rag_security import citation_key


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: RagChunk
    score: float
    vector_score: float
    keyword_score: float
    recency_score: float


def _as_vector(value) -> list[float] | None:
    if value is None:
        return None
    if isinstance(value, str):
        raw = value.strip().strip("[]")
        if not raw:
            return None
        return [float(part) for part in raw.split(",")]
    return list(value)


def _dot(a: list[float] | None, b) -> float:
    left = _as_vector(a)
    right = _as_vector(b)
    if not left or not right:
        return 0.0
    if len(left) != len(right):
        return 0.0
    return float(sum(x * y for x, y in zip(left, right)))


def _keyword_score(query: str, content: str, title: str) -> float:
    terms = [term for term in query.lower().split() if len(term) > 1]
    if not terms:
        return 0.0
    haystack = f"{title} {content}".lower()
    hits = sum(1 for term in terms if term in haystack)
    return hits / len(terms)


def _recency_score(chunk: RagChunk) -> float:
    # A lightweight monotonic score: recent chunks get a small ranking boost.
    try:
        age_days = max(0.0, (time.time() - chunk.updated_at.timestamp()) / 86400.0)
    except Exception:
        age_days = 365.0
    return 1.0 / (1.0 + math.log1p(age_days))


def _link_for(chunk: RagChunk, guild_id: int) -> str:
    if chunk.entity_type == RagSourceType.project:
        return f"/g/{guild_id}/projects/{chunk.entity_id}"
    if chunk.entity_type == RagSourceType.task:
        return f"/g/{guild_id}/tasks/{chunk.entity_id}"
    if chunk.entity_type == RagSourceType.document:
        return f"/g/{guild_id}/documents/{chunk.entity_id}"
    if chunk.project_id:
        return f"/g/{guild_id}/projects/{chunk.project_id}"
    return f"/g/{guild_id}/initiatives/{chunk.initiative_id}"


def to_citation(chunk: RagChunk, score: float) -> RagCitation:
    return RagCitation(
        citation_key=citation_key(chunk),
        source_type=chunk.entity_type,
        source_id=chunk.entity_id,
        title=chunk.title,
        excerpt=chunk.excerpt,
        score=round(float(score), 4),
        updated_at=chunk.updated_at,
        link=_link_for(chunk, chunk.guild_id),
    )


async def _visible_project_ids(
    session: AsyncSession, user: User, guild_id: int
) -> set[int]:
    if has_active_grant(guild_id):
        stmt = select(Project.id).where(
            Project.guild_id == guild_id, Project.deleted_at.is_(None)
        )
        result = await session.exec(stmt)
        return set(result.all())
    visible = permissions_service.visible_project_ids_subquery(user.id).subquery()
    stmt = select(Project.id).where(
        Project.guild_id == guild_id, Project.id.in_(select(visible))
    )
    result = await session.exec(stmt)
    return set(result.all())


async def _visible_document_ids(
    session: AsyncSession, user: User, guild_id: int
) -> set[int]:
    if has_active_grant(guild_id):
        stmt = select(Document.id).where(
            Document.guild_id == guild_id, Document.deleted_at.is_(None)
        )
        result = await session.exec(stmt)
        return set(result.all())
    visible = permissions_service.visible_document_ids_subquery(user.id).subquery()
    stmt = select(Document.id).where(
        Document.guild_id == guild_id, Document.id.in_(select(visible))
    )
    result = await session.exec(stmt)
    return set(result.all())


def _chunk_visible(
    chunk: RagChunk, project_ids: set[int], document_ids: set[int]
) -> bool:
    if chunk.entity_type in {RagSourceType.project, RagSourceType.task}:
        return bool(chunk.project_id and chunk.project_id in project_ids)
    if chunk.entity_type == RagSourceType.document:
        return chunk.entity_id in document_ids
    if chunk.entity_type == RagSourceType.comment:
        meta = chunk.source_metadata or {}
        task_project_id = chunk.project_id
        document_id = meta.get("document_id")
        return bool(
            (task_project_id and task_project_id in project_ids)
            or (document_id and document_id in document_ids)
        )
    if chunk.entity_type == RagSourceType.Initiative:
        return True
    return False


async def search_workspace(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: RagSearchRequest,
) -> RagSearchResponse:
    started = time.perf_counter()
    settings = await resolve_embedding_settings(session, user, guild_id)
    query_embeddings, embedding_model, _dimension = await embed_texts(
        [request.query], settings=settings
    )
    query_embedding = query_embeddings[0] if query_embeddings else None

    project_ids = await _visible_project_ids(session, user, guild_id)
    document_ids = await _visible_document_ids(session, user, guild_id)

    stmt = select(RagChunk).where(
        RagChunk.guild_id == guild_id,
        RagChunk.deleted_at.is_(None),
    )
    if request.initiative_id:
        stmt = stmt.where(RagChunk.initiative_id == request.initiative_id)
    if request.project_id:
        stmt = stmt.where(RagChunk.project_id == request.project_id)
    if request.source_types:
        stmt = stmt.where(RagChunk.entity_type.in_(request.source_types))
    stmt = stmt.order_by(RagChunk.updated_at.desc()).limit(1000)

    result = await session.exec(stmt)
    candidates = result.all()
    filtered: list[RagChunk] = []
    permission_filtered_count = 0
    for chunk in candidates:
        if _chunk_visible(chunk, project_ids, document_ids):
            filtered.append(chunk)
        else:
            permission_filtered_count += 1

    ranked: list[RetrievedChunk] = []
    for chunk in filtered:
        vector = _dot(query_embedding, chunk.embedding)
        keyword = _keyword_score(request.query, chunk.content, chunk.title)
        recency = _recency_score(chunk)
        scope = (
            0.05
            if request.project_id and chunk.project_id == request.project_id
            else 0.0
        )
        score = (0.62 * vector) + (0.25 * keyword) + (0.08 * recency) + scope
        ranked.append(
            RetrievedChunk(
                chunk=chunk,
                score=score,
                vector_score=vector,
                keyword_score=keyword,
                recency_score=recency,
            )
        )

    ranked.sort(key=lambda item: item.score, reverse=True)
    top = ranked[: request.top_k]
    latency = (time.perf_counter() - started) * 1000
    return RagSearchResponse(
        query=request.query,
        results=[to_citation(item.chunk, item.score) for item in top],
        source_count=len(top),
        permission_filtered_count=permission_filtered_count,
        latency_ms=round(latency, 2),
        embedding_model=embedding_model,
    )


async def get_chunks_for_citations(
    session: AsyncSession,
    citations: list[RagCitation],
) -> list[RagChunk]:
    if not citations:
        return []
    ids = [citation.source_id for citation in citations]
    types = list({citation.source_type for citation in citations})
    stmt = select(RagChunk).where(
        RagChunk.entity_id.in_(ids),
        RagChunk.entity_type.in_(types),
        RagChunk.deleted_at.is_(None),
    )
    result = await session.exec(stmt)
    chunks = result.all()
    by_key = {citation_key(chunk): chunk for chunk in chunks}
    return [
        by_key[citation.citation_key]
        for citation in citations
        if citation.citation_key in by_key
    ]
