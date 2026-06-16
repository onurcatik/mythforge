from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models.comment import Comment
from app.models.document import Document
from app.models.initiative import Initiative
from app.models.project import Project
from app.models.rag import RagSourceType
from app.models.task import Task
from app.services.ai_generation import lexical_to_markdown

MAX_CHUNK_CHARS = 2400
CHUNK_OVERLAP_CHARS = 250
MIN_CHUNK_CHARS = 24


@dataclass(frozen=True)
class ChunkPayload:
    guild_id: int
    initiative_id: int
    project_id: int | None
    entity_type: RagSourceType
    entity_id: int
    title: str
    content: str
    source_version: str
    created_by_id: int | None
    updated_at: datetime
    metadata: dict[str, Any]


def _norm(text: str | None) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text.replace("\x00", " ")).strip()
    return cleaned


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def source_version(updated_at: datetime | None, content: str) -> str:
    stamp = updated_at.isoformat() if updated_at else "no-date"
    return f"{stamp}:{content_hash(content)[:16]}"


def split_chunks(
    text: str, *, max_chars: int = MAX_CHUNK_CHARS, overlap: int = CHUNK_OVERLAP_CHARS
) -> list[str]:
    text = _norm(text)
    if len(text) < MIN_CHUNK_CHARS:
        return []
    if len(text) <= max_chars:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            boundary = max(text.rfind(". ", start, end), text.rfind("\n", start, end))
            if boundary > start + max_chars // 2:
                end = boundary + 1
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


def payload_from_initiative(Initiative: Initiative) -> ChunkPayload | None:
    text = _norm("\n".join([Initiative.name, Initiative.description or ""]))
    if not text:
        return None
    return ChunkPayload(
        guild_id=Initiative.guild_id,
        initiative_id=Initiative.id or 0,
        project_id=None,
        entity_type=RagSourceType.Initiative,
        entity_id=Initiative.id or 0,
        title=Initiative.name,
        content=text,
        source_version=source_version(Initiative.updated_at, text),
        created_by_id=None,
        updated_at=Initiative.updated_at,
        metadata={"source": "Initiative"},
    )


def payload_from_project(project: Project) -> ChunkPayload | None:
    text = _norm("\n".join([project.name, project.description or ""]))
    if not text:
        return None
    return ChunkPayload(
        guild_id=project.guild_id or 0,
        initiative_id=project.initiative_id,
        project_id=project.id,
        entity_type=RagSourceType.project,
        entity_id=project.id or 0,
        title=project.name,
        content=text,
        source_version=source_version(project.updated_at, text),
        created_by_id=project.owner_id,
        updated_at=project.updated_at,
        metadata={"source": "project", "is_archived": project.is_archived},
    )


def payload_from_task(
    task: Task, project: Project | None = None
) -> ChunkPayload | None:
    parts = [task.title, task.description or ""]
    text = _norm("\n".join(parts))
    if not text:
        return None
    project_id = task.project_id
    initiative_id = project.initiative_id if project else 0
    return ChunkPayload(
        guild_id=task.guild_id or (project.guild_id if project else 0) or 0,
        initiative_id=initiative_id,
        project_id=project_id,
        entity_type=RagSourceType.task,
        entity_id=task.id or 0,
        title=task.title,
        content=text,
        source_version=source_version(task.updated_at, text),
        created_by_id=task.created_by_id,
        updated_at=task.updated_at,
        metadata={
            "source": "task",
            "priority": task.priority.value,
            "is_archived": task.is_archived,
        },
    )


def payload_from_document(document: Document) -> ChunkPayload | None:
    if document.document_type.value == "native":
        body = lexical_to_markdown(document.content or {})
    else:
        body = " ".join(
            str(part)
            for part in [
                document.original_filename,
                document.file_content_type,
                document.file_url,
            ]
            if part
        )
    text = _norm("\n".join([document.title, body]))
    if not text:
        return None
    project_id = (
        document.project_links[0].project_id
        if getattr(document, "project_links", None)
        else None
    )
    return ChunkPayload(
        guild_id=document.guild_id or 0,
        initiative_id=document.initiative_id,
        project_id=project_id,
        entity_type=RagSourceType.document,
        entity_id=document.id or 0,
        title=document.title,
        content=text,
        source_version=source_version(document.updated_at, text),
        created_by_id=document.created_by_id,
        updated_at=document.updated_at,
        metadata={"source": "document", "document_type": document.document_type.value},
    )


def payload_from_comment(
    comment: Comment,
    *,
    task: Task | None = None,
    document: Document | None = None,
    project: Project | None = None,
) -> ChunkPayload | None:
    text = _norm(comment.content)
    if not text:
        return None
    if document:
        initiative_id = document.initiative_id
        project_id = (
            document.project_links[0].project_id
            if getattr(document, "project_links", None)
            else None
        )
        parent_title = document.title
    elif task:
        initiative_id = project.initiative_id if project else 0
        project_id = task.project_id
        parent_title = task.title
    else:
        initiative_id = 0
        project_id = None
        parent_title = "Comment"
    updated_at = comment.updated_at or comment.created_at
    return ChunkPayload(
        guild_id=comment.guild_id or 0,
        initiative_id=initiative_id,
        project_id=project_id,
        entity_type=RagSourceType.comment,
        entity_id=comment.id or 0,
        title=f"Comment on {parent_title}",
        content=text,
        source_version=source_version(updated_at, text),
        created_by_id=comment.author_id,
        updated_at=updated_at,
        metadata={
            "source": "comment",
            "task_id": comment.task_id,
            "document_id": comment.document_id,
        },
    )
