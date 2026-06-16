from __future__ import annotations

import hashlib
from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agent import AgentAuditEvent
from app.models.user import User


def hash_prompt(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    blocked = {"api_key", "token", "secret", "password", "authorization"}
    out: dict[str, Any] = {}
    for key, value in payload.items():
        if key.lower() in blocked:
            out[key] = "[redacted]"
        elif isinstance(value, dict):
            out[key] = safe_payload(value)
        else:
            out[key] = value
    return out


async def record_event(
    session: AsyncSession,
    *,
    user: User,
    guild_id: int,
    initiative_id: int | None,
    event_type: str,
    session_id: int | None = None,
    payload: dict[str, Any] | None = None,
    prompt: str | None = None,
    model: str | None = None,
    latency_ms: float | None = None,
    token_usage: dict[str, Any] | None = None,
) -> None:
    session.add(
        AgentAuditEvent(
            session_id=session_id,
            user_id=user.id,
            guild_id=guild_id,
            initiative_id=initiative_id,
            event_type=event_type,
            prompt_hash=hash_prompt(prompt) if prompt else None,
            payload=safe_payload(payload or {}),
            token_usage=token_usage or {},
            model=model,
            latency_ms=latency_ms,
        )
    )
