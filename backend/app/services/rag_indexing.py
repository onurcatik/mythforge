from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import delete, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import AdminSessionLocal
from app.models.comment import Comment
from app.models.document import Document
from app.models.initiative import Initiative
from app.models.project import Project
from app.models.rag import RagChunk, RagIndexJob, RagJobStatus, RagSourceType
from app.models.task import Task
from app.models.user import User
from app.services.rag_chunking import (
    ChunkPayload,
    content_hash,
    payload_from_comment,
    payload_from_document,
    payload_from_initiative,
    payload_from_project,
    payload_from_task,
    split_chunks,
)
from app.services.rag_embeddings import embed_texts, resolve_embedding_settings

logger = logging.getLogger(__name__)
RAG_INDEX_POLL_SECONDS = 15
MAX_JOB_ATTEMPTS = 5


async def _scope_for_entity(
    session: AsyncSession, entity_type: RagSourceType, entity_id: int
) -> tuple[int | None, int | None, int | None]:
    if entity_type == RagSourceType.Initiative:
        result = await session.exec(select(Initiative).where(Initiative.id == entity_id))
        item = result.one_or_none()
        return (item.guild_id, item.id, None) if item else (None, None, None)
    if entity_type == RagSourceType.project:
        result = await session.exec(select(Project).where(Project.id == entity_id))
        item = result.one_or_none()
        return (item.guild_id, item.initiative_id, item.id) if item else (None, None, None)
    if entity_type == RagSourceType.task:
        result = await session.exec(
            select(Task).options(selectinload(Task.project)).where(Task.id == entity_id)
        )
        item = result.one_or_none()
        if item and item.project:
            return (
                item.guild_id or item.project.guild_id,
                item.project.initiative_id,
                item.project_id,
            )
        return (
            item.guild_id if item else None,
            None,
            item.project_id if item else None,
        )
    if entity_type == RagSourceType.document:
        result = await session.exec(select(Document).where(Document.id == entity_id))
        item = result.one_or_none()
        return (item.guild_id, item.initiative_id, None) if item else (None, None, None)
    if entity_type == RagSourceType.comment:
        result = await session.exec(select(Comment).where(Comment.id == entity_id))
        item = result.one_or_none()
        if not item:
            return (None, None, None)
        if item.task_id:
            task_result = await session.exec(
                select(Task)
                .options(selectinload(Task.project))
                .where(Task.id == item.task_id)
            )
            task = task_result.one_or_none()
            if task and task.project:
                return (
                    item.guild_id or task.guild_id or task.project.guild_id,
                    task.project.initiative_id,
                    task.project_id,
                )
        if item.document_id:
            doc_result = await session.exec(
                select(Document).where(Document.id == item.document_id)
            )
            document = doc_result.one_or_none()
            if document:
                return (item.guild_id or document.guild_id, document.initiative_id, None)
        return (item.guild_id, None, None)
    return (None, None, None)


async def enqueue_index_job(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int,
    entity_type: RagSourceType,
    entity_id: int,
    project_id: int | None = None,
    source_version: str | None = None,
) -> bool:
    if initiative_id <= 0 or project_id is None:
        resolved_guild_id, resolved_initiative_id, resolved_project_id = (
            await _scope_for_entity(session, entity_type, entity_id)
        )
        guild_id = resolved_guild_id or guild_id
        initiative_id = resolved_initiative_id or initiative_id
        project_id = project_id if project_id is not None else resolved_project_id
    if initiative_id <= 0:
        return False
    version = source_version or f"queued:{datetime.now(timezone.utc).isoformat()}"
    job = RagIndexJob(
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        source_version=version,
        status=RagJobStatus.queued,
    )
    session.add(job)
    try:
        await session.flush()
        return True
    except IntegrityError:
        await session.rollback()
        return False


async def _payload_for_entity(
    session: AsyncSession, entity_type: RagSourceType, entity_id: int
) -> ChunkPayload | None:
    if entity_type == RagSourceType.Initiative:
        result = await session.exec(select(Initiative).where(Initiative.id == entity_id))
        Initiative = result.one_or_none()
        if not Initiative or Initiative.deleted_at:
            return None
        return payload_from_initiative(Initiative)

    if entity_type == RagSourceType.project:
        result = await session.exec(select(Project).where(Project.id == entity_id))
        project = result.one_or_none()
        if not project or project.deleted_at or project.is_archived:
            return None
        return payload_from_project(project)

    if entity_type == RagSourceType.task:
        stmt = (
            select(Task).options(selectinload(Task.project)).where(Task.id == entity_id)
        )
        result = await session.exec(stmt)
        task = result.one_or_none()
        if not task or task.deleted_at or task.is_archived:
            return None
        return payload_from_task(task, task.project)

    if entity_type == RagSourceType.document:
        stmt = (
            select(Document)
            .options(selectinload(Document.project_links))
            .where(Document.id == entity_id)
        )
        result = await session.exec(stmt)
        document = result.one_or_none()
        if not document or document.deleted_at:
            return None
        return payload_from_document(document)

    if entity_type == RagSourceType.comment:
        stmt = select(Comment).where(Comment.id == entity_id)
        result = await session.exec(stmt)
        comment = result.one_or_none()
        if not comment or comment.deleted_at:
            return None
        task = None
        document = None
        project = None
        if comment.task_id:
            task_result = await session.exec(
                select(Task)
                .options(selectinload(Task.project))
                .where(Task.id == comment.task_id)
            )
            task = task_result.one_or_none()
            project = task.project if task else None
        if comment.document_id:
            doc_result = await session.exec(
                select(Document)
                .options(selectinload(Document.project_links))
                .where(Document.id == comment.document_id)
            )
            document = doc_result.one_or_none()
        return payload_from_comment(
            comment, task=task, document=document, project=project
        )

    return None


async def _mark_entity_deleted(
    session: AsyncSession, entity_type: RagSourceType, entity_id: int
) -> None:
    result = await session.exec(
        select(RagChunk).where(
            RagChunk.entity_type == entity_type,
            RagChunk.entity_id == entity_id,
            RagChunk.deleted_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    for chunk in result.all():
        chunk.deleted_at = now
        session.add(chunk)


async def index_entity(
    session: AsyncSession,
    *,
    user: User,
    entity_type: RagSourceType,
    entity_id: int,
) -> int:
    payload = await _payload_for_entity(session, entity_type, entity_id)
    if payload is None:
        await _mark_entity_deleted(session, entity_type, entity_id)
        return 0

    chunks = split_chunks(payload.content)
    if not chunks:
        await _mark_entity_deleted(session, entity_type, entity_id)
        return 0

    settings = await resolve_embedding_settings(session, user, payload.guild_id)
    embeddings, embedding_model, embedding_dimension = await embed_texts(
        chunks, settings=settings
    )
    if embeddings and any(len(item) != embedding_dimension for item in embeddings):
        raise ValueError("Embedding dimension mismatch")

    # Replace only this model/version identity; keep old versions soft-deleted for audit/debug.
    await _mark_entity_deleted(session, entity_type, entity_id)

    for index, chunk_text in enumerate(chunks):
        excerpt = chunk_text[:997] + "..." if len(chunk_text) > 1000 else chunk_text
        session.add(
            RagChunk(
                guild_id=payload.guild_id,
                initiative_id=payload.initiative_id,
                project_id=payload.project_id,
                entity_type=payload.entity_type,
                entity_id=payload.entity_id,
                chunk_index=index,
                title=payload.title[:512],
                content=chunk_text,
                excerpt=excerpt,
                source_version=payload.source_version,
                content_hash=content_hash(chunk_text),
                embedding_model=embedding_model,
                embedding_dimension=embedding_dimension,
                embedding=embeddings[index],
                source_metadata=payload.metadata,
                visibility_scope="guild",
                created_by_id=payload.created_by_id,
                updated_at=payload.updated_at,
            )
        )
    return len(chunks)


async def queue_reindex_scope(
    session: AsyncSession,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    entity_type: RagSourceType | None = None,
    entity_id: int | None = None,
    full_rebuild: bool = False,
    dry_run: bool = False,
) -> tuple[int, int]:
    candidates: list[tuple[RagSourceType, int, int, int | None]] = []

    if entity_type and entity_id:
        candidates.append((entity_type, entity_id, initiative_id or 0, project_id))
    else:
        init_stmt = select(Initiative).where(
            Initiative.guild_id == guild_id, Initiative.deleted_at.is_(None)
        )
        if initiative_id:
            init_stmt = init_stmt.where(Initiative.id == initiative_id)
        init_result = await session.exec(init_stmt)
        for Initiative in init_result.all():
            candidates.append((RagSourceType.Initiative, Initiative.id, Initiative.id, None))

        project_stmt = select(Project).where(
            Project.guild_id == guild_id,
            Project.deleted_at.is_(None),
            Project.is_archived.is_(False),
        )
        if initiative_id:
            project_stmt = project_stmt.where(Project.initiative_id == initiative_id)
        if project_id:
            project_stmt = project_stmt.where(Project.id == project_id)
        project_result = await session.exec(project_stmt)
        project_ids: list[int] = []
        for project in project_result.all():
            project_ids.append(project.id)
            candidates.append(
                (RagSourceType.project, project.id, project.initiative_id, project.id)
            )

        task_stmt = (
            select(Task)
            .join(Project, Project.id == Task.project_id)
            .where(
                Task.guild_id == guild_id,
                Task.deleted_at.is_(None),
                Task.is_archived.is_(False),
            )
        )
        if initiative_id:
            task_stmt = task_stmt.where(Project.initiative_id == initiative_id)
        if project_id:
            task_stmt = task_stmt.where(Task.project_id == project_id)
        task_result = await session.exec(task_stmt)
        for task in task_result.all():
            candidates.append(
                (RagSourceType.task, task.id, initiative_id or 0, task.project_id)
            )

        doc_stmt = select(Document).where(
            Document.guild_id == guild_id, Document.deleted_at.is_(None)
        )
        if initiative_id:
            doc_stmt = doc_stmt.where(Document.initiative_id == initiative_id)
        doc_result = await session.exec(doc_stmt)
        for document in doc_result.all():
            candidates.append(
                (RagSourceType.document, document.id, document.initiative_id, None)
            )

    if dry_run:
        return len(candidates), 0

    queued = 0
    skipped = 0
    if full_rebuild:
        delete_stmt = delete(RagChunk).where(RagChunk.guild_id == guild_id)
        if initiative_id:
            delete_stmt = delete_stmt.where(RagChunk.initiative_id == initiative_id)
        await session.exec(delete_stmt)

    for item_type, item_id, item_initiative_id, item_project_id in candidates:
        ok = await enqueue_index_job(
            session,
            guild_id=guild_id,
            initiative_id=item_initiative_id or initiative_id or 0,
            project_id=item_project_id,
            entity_type=item_type,
            entity_id=item_id,
        )
        if ok:
            queued += 1
        else:
            skipped += 1
    return queued, skipped


async def process_rag_index_jobs() -> None:
    async with AdminSessionLocal() as session:
        now = datetime.now(timezone.utc)
        stmt = (
            select(RagIndexJob)
            .where(
                RagIndexJob.status == RagJobStatus.queued, RagIndexJob.run_after <= now
            )
            .order_by(RagIndexJob.created_at.asc())
            .limit(10)
        )
        result = await session.exec(stmt)
        jobs = result.all()
        if not jobs:
            return

        # Use the creator/admin surrogate for provider resolution. If no user is available,
        # local deterministic embeddings are used by resolve path fallback in tests.
        user_result = await session.exec(select(User).order_by(User.id.asc()).limit(1))
        user = user_result.one_or_none()
        if not user:
            return

        for job in jobs:
            job.status = RagJobStatus.processing
            job.attempts += 1
            job.updated_at = now
            session.add(job)
            await session.commit()
            try:
                await index_entity(
                    session,
                    user=user,
                    entity_type=job.entity_type,
                    entity_id=job.entity_id,
                )
                job.status = RagJobStatus.completed
                job.last_error = None
            except Exception as exc:  # pragma: no cover - defensive background worker
                logger.exception("RAG index job failed: %s", job.id)
                job.last_error = str(exc)[:4000]
                if job.attempts >= MAX_JOB_ATTEMPTS:
                    job.status = RagJobStatus.failed
                else:
                    job.status = RagJobStatus.queued
                    job.run_after = datetime.now(timezone.utc) + timedelta(
                        seconds=2 ** min(job.attempts, 8)
                    )
            job.updated_at = datetime.now(timezone.utc)
            session.add(job)
            await session.commit()


async def _count(session: AsyncSession, stmt) -> int:
    result = await session.exec(stmt)
    return int(result.one() or 0)


async def index_status(session: AsyncSession, *, guild_id: int) -> dict:
    chunk_count = await _count(
        session,
        select(func.count())
        .select_from(RagChunk)
        .where(RagChunk.guild_id == guild_id, RagChunk.deleted_at.is_(None)),
    )
    queued = await _count(
        session,
        select(func.count())
        .select_from(RagIndexJob)
        .where(
            RagIndexJob.guild_id == guild_id, RagIndexJob.status == RagJobStatus.queued
        ),
    )
    processing = await _count(
        session,
        select(func.count())
        .select_from(RagIndexJob)
        .where(
            RagIndexJob.guild_id == guild_id,
            RagIndexJob.status == RagJobStatus.processing,
        ),
    )
    failed = await _count(
        session,
        select(func.count())
        .select_from(RagIndexJob)
        .where(
            RagIndexJob.guild_id == guild_id, RagIndexJob.status == RagJobStatus.failed
        ),
    )
    completed = await _count(
        session,
        select(func.count())
        .select_from(RagIndexJob)
        .where(
            RagIndexJob.guild_id == guild_id,
            RagIndexJob.status == RagJobStatus.completed,
        ),
    )
    last_result = await session.exec(
        select(RagChunk.updated_at)
        .where(RagChunk.guild_id == guild_id, RagChunk.deleted_at.is_(None))
        .order_by(RagChunk.updated_at.desc())
        .limit(1)
    )
    failed_result = await session.exec(
        select(RagIndexJob)
        .where(
            RagIndexJob.guild_id == guild_id, RagIndexJob.status == RagJobStatus.failed
        )
        .order_by(RagIndexJob.updated_at.desc())
        .limit(5)
    )
    return {
        "indexed_chunks": chunk_count or 0,
        "queued_jobs": queued or 0,
        "processing_jobs": processing or 0,
        "failed_jobs": failed or 0,
        "completed_jobs": completed or 0,
        "last_indexed_at": last_result.one_or_none(),
        "failed_samples": [
            {
                "id": job.id,
                "entity_type": job.entity_type.value,
                "entity_id": job.entity_id,
                "error": job.last_error,
            }
            for job in failed_result.all()
        ],
    }


async def index_system_event_summary(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    initiative_id: int,
    entity_id: int,
    title: str,
    content: str,
    project_id: int | None = None,
    metadata: dict | None = None,
) -> int:
    """Directly index permission-scoped graph/assignment summaries as RAG system events."""
    if not content.strip():
        return 0
    chunks = split_chunks(content)
    settings = await resolve_embedding_settings(session, user, guild_id)
    embeddings, embedding_model, embedding_dimension = await embed_texts(
        chunks, settings=settings
    )
    now = datetime.now(timezone.utc)
    result = await session.exec(
        select(RagChunk).where(
            RagChunk.entity_type == RagSourceType.system_event,
            RagChunk.entity_id == entity_id,
            RagChunk.deleted_at.is_(None),
        )
    )
    for old in result.all():
        old.deleted_at = now
        session.add(old)
    for index, chunk_text in enumerate(chunks):
        session.add(
            RagChunk(
                guild_id=guild_id,
                initiative_id=initiative_id,
                project_id=project_id,
                entity_type=RagSourceType.system_event,
                entity_id=entity_id,
                chunk_index=index,
                title=title[:512],
                content=chunk_text,
                excerpt=(
                    chunk_text[:997] + "..." if len(chunk_text) > 1000 else chunk_text
                ),
                source_version=f"system-event:{entity_id}:{int(now.timestamp())}",
                content_hash=content_hash(chunk_text),
                embedding_model=embedding_model,
                embedding_dimension=embedding_dimension,
                embedding=embeddings[index],
                source_metadata=metadata or {"source_type": "system_event"},
                visibility_scope="guild",
                created_by_id=user.id,
                updated_at=now,
            )
        )
    await session.flush()
    return len(chunks)
