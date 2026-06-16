"""Server-side Local AI Mode policy helpers.

Local AI Mode is a privacy control, not only a frontend preference. When it is
active, downstream RAG, Agent, Assignment, Command Center and task generation
flows must resolve to Ollama and must not fallback to cloud providers.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.ai_settings import AIProvider, ResolvedAISettings

LOCAL_RUNTIME_LABEL = "Local Ollama"
DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_OLLAMA_CHAT_MODEL = "llama3.2"
DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"


class LocalAIConfigurationError(RuntimeError):
    """Raised when Local AI Mode cannot safely execute."""


@dataclass(frozen=True)
class AIRuntimeDescriptor:
    provider: str | None
    model: str | None
    embedding_model: str | None
    runtime_mode: str
    local_only: bool
    cloud_allowed: bool
    label: str


def enforce_local_only(settings: ResolvedAISettings, *, operation: str) -> ResolvedAISettings:
    """Ensure local-only settings cannot escape to cloud providers."""
    if not settings.local_only:
        return settings
    if settings.provider != AIProvider.ollama:
        # resolve_ai_settings normally coerces this, but keep a defense-in-depth
        # guard close to runtime consumers as well.
        settings.provider = AIProvider.ollama
    settings.api_key = None
    settings.base_url = settings.base_url or DEFAULT_OLLAMA_BASE_URL
    settings.model = settings.model or DEFAULT_OLLAMA_CHAT_MODEL
    settings.embedding_model = settings.embedding_model or DEFAULT_OLLAMA_EMBEDDING_MODEL
    settings.runtime_mode = "local"
    settings.fallback_allowed = False
    return settings


def descriptor(settings: ResolvedAISettings) -> AIRuntimeDescriptor:
    provider = settings.provider.value if hasattr(settings.provider, "value") else settings.provider
    local = bool(settings.local_only or provider == AIProvider.ollama.value)
    return AIRuntimeDescriptor(
        provider=provider,
        model=settings.model,
        embedding_model=settings.embedding_model,
        runtime_mode="local" if local else ("cloud" if provider else "disabled"),
        local_only=bool(settings.local_only),
        cloud_allowed=not settings.local_only and provider not in {None, AIProvider.ollama.value},
        label=LOCAL_RUNTIME_LABEL if local else (provider or "No AI runtime"),
    )


def audit_payload(settings: ResolvedAISettings, *, operation: str, fallback_blocked: bool = False) -> dict:
    info = descriptor(settings)
    return {
        "operation": operation,
        "provider": info.provider,
        "model": info.model,
        "embedding_model": info.embedding_model,
        "runtime_mode": info.runtime_mode,
        "local_only": info.local_only,
        "cloud_allowed": info.cloud_allowed,
        "fallback_blocked": bool(fallback_blocked or info.local_only),
        "label": info.label,
    }
