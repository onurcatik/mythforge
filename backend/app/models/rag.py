from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import ConfigDict
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import UserDefinedType
from sqlmodel import Enum as SQLEnum, Field, SQLModel


class Vector(UserDefinedType):
    """Minimal pgvector column type without adding a runtime dependency."""

    cache_ok = True

    def get_col_spec(self, **kw: Any) -> str:  # pragma: no cover - SQLAlchemy hook
        return "vector"

    def bind_processor(self, dialect: Any):  # pragma: no cover - SQLAlchemy hook
        def process(value: Any) -> str | None:
            if value is None:
                return None
            if isinstance(value, str):
                return value
            return "[" + ",".join(str(float(v)) for v in value) + "]"
        return process


class RagSourceType(str, Enum):
    initiative = "initiative"
    project = "project"
    task = "task"
    document = "document"
    comment = "comment"
    decision = "decision"
    system_event = "system_event"


class RagJobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class RagChunk(SQLModel, table=True):
    __tablename__ = "rag_chunks"
    __table_args__ = (
        UniqueConstraint(
            "entity_type",
            "entity_id",
            "chunk_index",
            "source_version",
            "embedding_model",
            "embedding_dimension",
            name="uq_rag_chunk_identity",
        ),
    )
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: int = Field(foreign_key="initiatives.id", nullable=False, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    entity_type: RagSourceType = Field(
        sa_column=Column(SQLEnum(RagSourceType, name="rag_source_type"), nullable=False, index=True)
    )
    entity_id: int = Field(nullable=False, index=True)
    chunk_index: int = Field(nullable=False)
    title: str = Field(sa_column=Column(String(length=512), nullable=False))
    content: str = Field(sa_column=Column(Text, nullable=False))
    excerpt: str = Field(sa_column=Column(String(length=1000), nullable=False))
    source_version: str = Field(sa_column=Column(String(length=128), nullable=False))
    content_hash: str = Field(sa_column=Column(String(length=64), nullable=False, index=True))
    embedding_model: str = Field(sa_column=Column(String(length=128), nullable=False))
    embedding_dimension: int = Field(nullable=False)
    embedding: list[float] | None = Field(default=None, sa_column=Column(Vector(), nullable=True))
    source_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"))
    visibility_scope: str = Field(default="guild", sa_column=Column(String(length=64), nullable=False, server_default="guild"))
    created_by_id: Optional[int] = Field(default=None, foreign_key="users.id", nullable=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True, index=True))


class RagIndexJob(SQLModel, table=True):
    __tablename__ = "rag_index_jobs"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "source_version", name="uq_rag_index_job_version"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: int = Field(foreign_key="initiatives.id", nullable=False, index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    entity_type: RagSourceType = Field(sa_column=Column(SQLEnum(RagSourceType, name="rag_source_type", create_type=False), nullable=False, index=True))
    entity_id: int = Field(nullable=False, index=True)
    source_version: str = Field(sa_column=Column(String(length=128), nullable=False))
    status: RagJobStatus = Field(default=RagJobStatus.queued, sa_column=Column(SQLEnum(RagJobStatus, name="rag_job_status"), nullable=False, index=True))
    attempts: int = Field(default=0, sa_column=Column(Integer, nullable=False, server_default="0"))
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    run_after: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False))


class RagAuditLog(SQLModel, table=True):
    __tablename__ = "rag_audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    guild_id: int = Field(foreign_key="guilds.id", nullable=False, index=True)
    initiative_id: Optional[int] = Field(default=None, foreign_key="initiatives.id", index=True)
    query_hash: str = Field(sa_column=Column(String(length=64), nullable=False, index=True))
    source_count: int = Field(default=0, nullable=False)
    permission_filtered_count: int = Field(default=0, nullable=False)
    model: Optional[str] = Field(default=None, sa_column=Column(String(length=128), nullable=True))
    embedding_model: Optional[str] = Field(default=None, sa_column=Column(String(length=128), nullable=True))
    latency_ms: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    token_usage: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False, server_default="{}"))
    cost_estimate: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    cache_hit: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default="false"))
    safety_flags: list[str] = Field(default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]"))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
