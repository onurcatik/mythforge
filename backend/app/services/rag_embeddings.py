from __future__ import annotations

import hashlib
import math
from typing import Iterable

import httpx
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.messages import AIMessages
from app.models.user import User
from app.schemas.ai_settings import AIProvider, ResolvedAISettings
from app.services.ai.providers.ollama_openai_adapter import (
    OllamaAdapterError,
    embeddings as ollama_embeddings,
)
from app.services.ai.local_ai_mode import enforce_local_only
from app.services.ai_settings import resolve_ai_settings
from app.services.webhook_target_url import (
    WebhookTargetUrlError,
    WebhookTargetUrlPrivateError,
    assert_target_url_is_public_async,
)

DEFAULT_EMBEDDING_DIMENSION = 384
DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"


class RagEmbeddingError(Exception):
    pass


def _hash_embedding(text: str, dimension: int = DEFAULT_EMBEDDING_DIMENSION) -> list[float]:
    """Deterministic fallback embedding for local dev and tests.

    This is not a semantic model; it lets indexing and permission tests run
    without external network calls. Production should configure an embedding
    provider through AI settings.
    """
    vector = [0.0] * dimension
    words = text.lower().split()
    for word in words:
        digest = hashlib.sha256(word.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimension
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


def vector_literal(values: Iterable[float]) -> str:
    return "[" + ",".join(f"{float(v):.8f}" for v in values) + "]"


def embedding_model_name(resolved: ResolvedAISettings) -> str:
    if resolved.provider == AIProvider.openai:
        return resolved.embedding_model or resolved.model or DEFAULT_OPENAI_EMBEDDING_MODEL
    if resolved.provider == AIProvider.ollama:
        return resolved.embedding_model or DEFAULT_OLLAMA_EMBEDDING_MODEL
    if resolved.provider == AIProvider.custom:
        return resolved.embedding_model or resolved.model or "custom-embedding"
    return "local-hash-384"


async def resolve_embedding_settings(
    session: AsyncSession,
    user: User,
    guild_id: int,
) -> ResolvedAISettings:
    resolved = enforce_local_only(await resolve_ai_settings(session, user, guild_id), operation="rag.embedding")
    if resolved.provider == AIProvider.anthropic:
        # Anthropic has no embeddings endpoint in this app's provider set, so
        # keep generation on Anthropic while embeddings use local deterministic
        # vectors unless the admin configures OpenAI/Ollama/custom.
        resolved.provider = None
        resolved.model = "local-hash-384"
    return resolved


async def embed_texts(
    texts: list[str],
    *,
    settings: ResolvedAISettings,
) -> tuple[list[list[float]], str, int]:
    model = embedding_model_name(settings)

    if not texts:
        return [], model, DEFAULT_EMBEDDING_DIMENSION

    if not settings.enabled or not settings.provider:
        embeddings = [_hash_embedding(text) for text in texts]
        return embeddings, "local-hash-384", DEFAULT_EMBEDDING_DIMENSION

    if settings.provider == AIProvider.openai:
        if not settings.api_key:
            raise RagEmbeddingError("OpenAI API key is missing")
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.api_key}"},
                json={"model": model, "input": texts},
            )
            if response.status_code >= 400:
                raise RagEmbeddingError("OpenAI embedding request failed")
            data = response.json().get("data", [])
        embeddings = [item["embedding"] for item in sorted(data, key=lambda item: item.get("index", 0))]
        if len(embeddings) != len(texts):
            raise RagEmbeddingError("OpenAI embedding response size mismatch")
        return embeddings, model, len(embeddings[0]) if embeddings else 0

    if settings.provider == AIProvider.ollama:
        try:
            embeddings = await ollama_embeddings(
                texts=texts,
                base_url=settings.base_url,
                api_key=settings.api_key,
                model=model,
                timeout=60.0,
            )
        except OllamaAdapterError as exc:
            raise RagEmbeddingError(str(exc)) from exc
        if not embeddings or not embeddings[0]:
            raise RagEmbeddingError("Ollama returned empty embeddings")
        return embeddings, model, len(embeddings[0])

    if settings.provider == AIProvider.custom:
        if not settings.base_url:
            raise RagEmbeddingError("Custom embedding base URL is missing")
        try:
            await assert_target_url_is_public_async(settings.base_url)
        except (WebhookTargetUrlError, WebhookTargetUrlPrivateError) as exc:
            raise RagEmbeddingError(AIMessages.INVALID_BASE_URL) from exc
        headers = {"Authorization": f"Bearer {settings.api_key}"} if settings.api_key else {}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.base_url.rstrip("/") + "/embeddings",
                headers=headers,
                json={"model": model, "input": texts},
            )
            if response.status_code >= 400:
                raise RagEmbeddingError("Custom embedding request failed")
            payload = response.json()
        data = payload.get("data") or []
        embeddings = [item.get("embedding") for item in data]
        if len(embeddings) != len(texts) or any(not item for item in embeddings):
            raise RagEmbeddingError("Custom embedding response size mismatch")
        return embeddings, model, len(embeddings[0])

    embeddings = [_hash_embedding(text) for text in texts]
    return embeddings, "local-hash-384", DEFAULT_EMBEDDING_DIMENSION
