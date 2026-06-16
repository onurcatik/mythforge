"""Ollama OpenAI-compatible adapter.

This module centralizes Ollama calls behind the same payload shape the app
already uses for OpenAI-compatible providers. Ollama does not require an API key
for local deployments, but an optional bearer token is supported for remote
reverse-proxied instances.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, Iterable

import httpx

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_OLLAMA_CHAT_MODEL = "llama3.2"
DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"


class OllamaAdapterError(Exception):
    """Raised when Ollama cannot satisfy a provider request."""


@dataclass(frozen=True)
class OllamaHealth:
    ok: bool
    base_url: str
    models: list[str]
    selected_model: str | None
    selected_model_available: bool | None
    latency_ms: float
    message: str


def normalize_base_url(base_url: str | None) -> str:
    return (base_url or DEFAULT_OLLAMA_BASE_URL).rstrip("/")


def openai_base_url(base_url: str | None) -> str:
    normalized = normalize_base_url(base_url)
    return normalized if normalized.endswith("/v1") else f"{normalized}/v1"


def auth_headers(api_key: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _model_ids_from_openai_payload(payload: dict[str, Any]) -> list[str]:
    models = payload.get("data") or []
    return [str(item.get("id")) for item in models if item.get("id")]


def _model_ids_from_tags_payload(payload: dict[str, Any]) -> list[str]:
    models = payload.get("models") or []
    return [str(item.get("name")) for item in models if item.get("name")]


def model_matches(requested: str | None, available: Iterable[str]) -> bool | None:
    if not requested:
        return None
    models = list(available)
    if requested in models:
        return True
    requested_base = requested.split(":", 1)[0]
    return requested_base in {model.split(":", 1)[0] for model in models}


async def list_models(
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: float = 10.0,
) -> list[str]:
    """List Ollama models using OpenAI-compatible /v1/models first.

    Falls back to the native /api/tags endpoint for older Ollama deployments or
    proxies that do not expose the OpenAI-compatible route.
    """
    root = normalize_base_url(base_url)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(f"{openai_base_url(root)}/models", headers=auth_headers(api_key))
        if response.status_code == 200:
            return _model_ids_from_openai_payload(response.json())
        tags_response = await client.get(f"{root}/api/tags", headers=auth_headers(api_key))
        if tags_response.status_code >= 400:
            raise OllamaAdapterError(f"Ollama model list failed: {tags_response.status_code}")
        return _model_ids_from_tags_payload(tags_response.json())


async def health(
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    timeout: float = 10.0,
) -> OllamaHealth:
    started = time.perf_counter()
    root = normalize_base_url(base_url)
    try:
        models = await list_models(base_url=root, api_key=api_key, timeout=timeout)
        selected_ok = model_matches(model, models)
        if selected_ok is False:
            message = f"Model '{model}' is not installed in Ollama."
            ok = False
        else:
            message = "Ollama connection successful"
            ok = True
        return OllamaHealth(
            ok=ok,
            base_url=root,
            models=models,
            selected_model=model,
            selected_model_available=selected_ok,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            message=message,
        )
    except httpx.ConnectError:
        return OllamaHealth(
            ok=False,
            base_url=root,
            models=[],
            selected_model=model,
            selected_model_available=False if model else None,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            message=f"Could not connect to Ollama at {root}",
        )
    except httpx.TimeoutException:
        return OllamaHealth(
            ok=False,
            base_url=root,
            models=[],
            selected_model=model,
            selected_model_available=False if model else None,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            message="Ollama connection timed out",
        )
    except Exception as exc:  # Avoid leaking prompts/secrets; only connection-level info.
        return OllamaHealth(
            ok=False,
            base_url=root,
            models=[],
            selected_model=model,
            selected_model_available=False if model else None,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            message=f"Ollama connection failed: {exc}",
        )


async def chat_completion(
    *,
    base_url: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    system_prompt: str,
    user_content: str,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    json_mode: bool = False,
    timeout: float = 60.0,
) -> str:
    resolved_model = model or DEFAULT_OLLAMA_CHAT_MODEL
    root = normalize_base_url(base_url)
    payload: dict[str, Any] = {
        "model": resolved_model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{openai_base_url(root)}/chat/completions",
            headers=auth_headers(api_key),
            json=payload,
        )
        if response.status_code == 200:
            content = response.json().get("choices", [{}])[0].get("message", {}).get("content")
            if not content:
                raise OllamaAdapterError("Ollama returned an empty chat completion")
            return str(content)

        # Compatibility fallback for older Ollama builds.
        native_payload: dict[str, Any] = {
            "model": resolved_model,
            "stream": False,
            "messages": payload["messages"],
            "options": {"temperature": temperature},
        }
        if json_mode:
            native_payload["format"] = "json"
        if max_tokens:
            native_payload["options"]["num_predict"] = max_tokens
        native_response = await client.post(
            f"{root}/api/chat",
            headers=auth_headers(api_key),
            json=native_payload,
        )
        if native_response.status_code >= 400:
            raise OllamaAdapterError(f"Ollama chat request failed: {native_response.status_code}")
        content = native_response.json().get("message", {}).get("content")
        if not content:
            raise OllamaAdapterError("Ollama returned an empty chat completion")
        return str(content)


async def chat_completion_json(**kwargs: Any) -> dict[str, Any]:
    content = await chat_completion(json_mode=True, **kwargs)
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise OllamaAdapterError("Ollama did not return valid JSON") from exc


async def embeddings(
    *,
    texts: list[str],
    base_url: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    timeout: float = 60.0,
) -> list[list[float]]:
    if not texts:
        return []
    resolved_model = model or DEFAULT_OLLAMA_EMBEDDING_MODEL
    root = normalize_base_url(base_url)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{openai_base_url(root)}/embeddings",
            headers=auth_headers(api_key),
            json={"model": resolved_model, "input": texts},
        )
        if response.status_code == 200:
            data = response.json().get("data") or []
            vectors = [item.get("embedding") for item in sorted(data, key=lambda item: item.get("index", 0))]
            if len(vectors) != len(texts) or any(not vector for vector in vectors):
                raise OllamaAdapterError("Ollama embedding response size mismatch")
            return vectors

        vectors: list[list[float]] = []
        for text in texts:
            native_response = await client.post(
                f"{root}/api/embeddings",
                headers=auth_headers(api_key),
                json={"model": resolved_model, "prompt": text},
            )
            if native_response.status_code >= 400:
                raise OllamaAdapterError(f"Ollama embedding request failed: {native_response.status_code}")
            vector = native_response.json().get("embedding") or []
            if not vector:
                raise OllamaAdapterError("Ollama returned empty embeddings")
            vectors.append(vector)
        return vectors
