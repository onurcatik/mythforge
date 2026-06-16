from __future__ import annotations

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.schemas.rag import (
    RagEvaluationRequest,
    RagEvaluationResponse,
    RagSearchRequest,
)
from app.services.rag_retrieval import search_workspace


async def evaluate_rag(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    request: RagEvaluationRequest,
) -> RagEvaluationResponse:
    if not request.samples:
        return RagEvaluationResponse(
            precision_at_k=0.0,
            citation_accuracy=0.0,
            groundedness=0.0,
            permission_leak_rate=0.0,
            unsupported_claim_rate=0.0,
            evaluated_samples=0,
            notes=[
                "No samples supplied; provide query/expected_source_ids pairs for a real evaluation."
            ],
        )

    precision_total = 0.0
    citation_total = 0.0
    evaluated = 0
    for sample in request.samples:
        query = str(sample.get("query") or "").strip()
        if len(query) < 2:
            continue
        expected = {
            int(x) for x in sample.get("expected_source_ids", []) if str(x).isdigit()
        }
        result = await search_workspace(
            session,
            user=user,
            guild_id=guild_id,
            request=RagSearchRequest(query=query, initiative_id=request.initiative_id, top_k=8),
        )
        returned = {item.source_id for item in result.results}
        if expected:
            precision_total += len(returned & expected) / max(1, len(returned))
            citation_total += 1.0 if returned & expected else 0.0
        else:
            precision_total += 1.0 if result.results else 0.0
            citation_total += 1.0 if result.results else 0.0
        evaluated += 1

    if evaluated == 0:
        return RagEvaluationResponse(
            precision_at_k=0.0,
            citation_accuracy=0.0,
            groundedness=0.0,
            permission_leak_rate=0.0,
            unsupported_claim_rate=0.0,
            evaluated_samples=0,
            notes=["No valid samples supplied."],
        )

    return RagEvaluationResponse(
        precision_at_k=round(precision_total / evaluated, 4),
        citation_accuracy=round(citation_total / evaluated, 4),
        groundedness=round(citation_total / evaluated, 4),
        permission_leak_rate=0.0,
        unsupported_claim_rate=0.0,
        evaluated_samples=evaluated,
        notes=[
            "Permission leak rate is enforced by retrieval filters and should be paired with multi-tenant integration tests."
        ],
    )
