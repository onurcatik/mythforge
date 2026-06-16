from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import ConfigDict, Field

from app.models.rag import RagJobStatus, RagSourceType
from app.schemas.base import SanitizedBaseModel


class RagSearchRequest(SanitizedBaseModel):
    query: str = Field(min_length=2, max_length=2000)
    initiative_id: int | None = None
    project_id: int | None = None
    source_types: list[RagSourceType] | None = None
    top_k: int = Field(default=8, ge=1, le=20)
    include_excerpts: bool = True


class RagCitation(SanitizedBaseModel):
    citation_key: str
    source_type: RagSourceType
    source_id: int
    title: str
    excerpt: str
    score: float
    updated_at: datetime | None = None
    link: str


class RagSearchResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    query: str
    results: list[RagCitation]
    source_count: int
    permission_filtered_count: int = 0
    latency_ms: float
    embedding_model: str | None = None


class RagAnswerRequest(RagSearchRequest):
    max_context_chunks: int = Field(default=8, ge=1, le=15)
    answer_style: Literal["concise", "detailed", "actionable"] = "actionable"


class RagAnswerResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    answer: str
    citations: list[RagCitation]
    confidence: float = Field(ge=0, le=1)
    missing_context: list[str]
    follow_up_questions: list[str]
    used_sources: list[str]
    safety_flags: list[str]
    permission_filtered_count: int = 0
    groundedness_score: float = Field(ge=0, le=1)
    latency_ms: float


class RagReindexRequest(SanitizedBaseModel):
    initiative_id: int | None = None
    project_id: int | None = None
    entity_type: RagSourceType | None = None
    entity_id: int | None = None
    full_rebuild: bool = False
    dry_run: bool = False


class RagReindexResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    queued_jobs: int
    skipped_jobs: int
    dry_run: bool
    message: str


class RagHealthResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    enabled: bool
    provider: str | None = None
    embedding_model: str | None = None
    indexed_chunks: int
    queued_jobs: int
    failed_jobs: int
    status: Literal["ok", "degraded", "disabled"]


class RagIndexStatusResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    indexed_chunks: int
    queued_jobs: int
    processing_jobs: int
    failed_jobs: int
    completed_jobs: int
    last_indexed_at: datetime | None = None
    failed_samples: list[dict[str, Any]]


class RagEvaluationRequest(SanitizedBaseModel):
    initiative_id: int | None = None
    samples: list[dict[str, Any]] = Field(default_factory=list, max_length=50)


class RagEvaluationResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    precision_at_k: float
    citation_accuracy: float
    groundedness: float
    permission_leak_rate: float
    unsupported_claim_rate: float
    evaluated_samples: int
    notes: list[str]


class RagSourceBundleResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    answer_id: str
    sources: list[RagCitation]
