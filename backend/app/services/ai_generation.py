"""AI Generation service for task-related AI features.

This service provides AI-powered generation of subtasks and descriptions
using the configured AI provider (OpenAI, Anthropic, Ollama, or custom).
"""

from __future__ import annotations

import html
import json
import httpx
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.messages import AIMessages
from app.models.task import Task
from app.models.user import User
from app.schemas.ai_settings import AIProvider
from app.services.ai.providers.ollama_openai_adapter import (
    OllamaAdapterError,
    chat_completion as ollama_chat_completion,
)
from app.services.ai.local_ai_mode import enforce_local_only
from app.services.ai_settings import resolve_ai_settings
from app.services.webhook_target_url import (
    WebhookTargetUrlError,
    WebhookTargetUrlPrivateError,
    assert_target_url_is_public_async,
)

# Maximum output lengths to prevent excessive LLM responses
_MAX_SUBTASK_LENGTH = 200
_MAX_DESCRIPTION_LENGTH = 2000
_MAX_SUMMARY_LENGTH = 5000


class AIGenerationError(Exception):
    """Raised when AI generation fails."""

    pass


async def _validate_generation_base_url(
    provider: AIProvider | None,
    base_url: str | None,
) -> None:
    # Ollama is platform-admin-only (guild/user can no longer select it),
    # so its base_url is operator-controlled and trusted. Only custom
    # providers still flow user-supplied URLs that need the SSRF guard.
    if provider != AIProvider.custom or not base_url:
        return
    try:
        await assert_target_url_is_public_async(base_url)
    except (WebhookTargetUrlError, WebhookTargetUrlPrivateError) as exc:
        raise AIGenerationError(AIMessages.INVALID_BASE_URL) from exc


async def generate_subtasks(
    session: AsyncSession,
    user: User,
    guild_id: int | None,
    task: Task,
    *,
    initiative_name: str | None = None,
    project_name: str | None = None,
) -> list[str]:
    """Generate subtask suggestions using configured AI provider."""
    resolved = enforce_local_only(
        await resolve_ai_settings(session, user, guild_id), operation="task.generation"
    )

    if not resolved.enabled:
        raise AIGenerationError("AI features are not enabled")

    if not resolved.api_key and resolved.provider != AIProvider.ollama:
        raise AIGenerationError("No API key configured for AI provider")

    if not resolved.provider:
        raise AIGenerationError("No AI provider configured")

    await _validate_generation_base_url(resolved.provider, resolved.base_url)

    locale = getattr(user, "locale", None) or "en"
    system_prompt, user_content = _build_subtasks_prompt(
        task, initiative_name, project_name, locale=locale
    )

    if resolved.provider == AIProvider.openai:
        return await _generate_openai_subtasks(
            api_key=resolved.api_key,
            model=resolved.model or "gpt-4o-mini",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.anthropic:
        return await _generate_anthropic_subtasks(
            api_key=resolved.api_key,
            model=resolved.model or "claude-3-5-haiku-20241022",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.ollama:
        return await _generate_ollama_subtasks(
            base_url=resolved.base_url or "http://localhost:11434",
            model=resolved.model or "llama3.2",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.custom:
        return await _generate_custom_subtasks(
            api_key=resolved.api_key,
            base_url=resolved.base_url,
            model=resolved.model,
            system_prompt=system_prompt,
            user_content=user_content,
        )
    else:
        raise AIGenerationError(f"Unsupported AI provider: {resolved.provider}")


async def generate_description(
    session: AsyncSession,
    user: User,
    guild_id: int | None,
    task: Task,
    *,
    initiative_name: str | None = None,
    project_name: str | None = None,
) -> str:
    """Generate/enhance task description using configured AI provider."""
    resolved = enforce_local_only(
        await resolve_ai_settings(session, user, guild_id), operation="task.generation"
    )

    if not resolved.enabled:
        raise AIGenerationError("AI features are not enabled")

    if not resolved.api_key and resolved.provider != AIProvider.ollama:
        raise AIGenerationError("No API key configured for AI provider")

    if not resolved.provider:
        raise AIGenerationError("No AI provider configured")

    await _validate_generation_base_url(resolved.provider, resolved.base_url)

    locale = getattr(user, "locale", None) or "en"
    system_prompt, user_content = _build_description_prompt(
        task, initiative_name, project_name, locale=locale
    )

    if resolved.provider == AIProvider.openai:
        return await _generate_openai_description(
            api_key=resolved.api_key,
            model=resolved.model or "gpt-4o-mini",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.anthropic:
        return await _generate_anthropic_description(
            api_key=resolved.api_key,
            model=resolved.model or "claude-3-5-haiku-20241022",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.ollama:
        return await _generate_ollama_description(
            base_url=resolved.base_url or "http://localhost:11434",
            model=resolved.model or "llama3.2",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.custom:
        return await _generate_custom_description(
            api_key=resolved.api_key,
            base_url=resolved.base_url,
            model=resolved.model,
            system_prompt=system_prompt,
            user_content=user_content,
        )
    else:
        raise AIGenerationError(f"Unsupported AI provider: {resolved.provider}")


async def generate_document_summary(
    session: AsyncSession,
    user: User,
    guild_id: int | None,
    document_content: dict | None,
    document_title: str,
) -> str:
    """Generate a summary of a document using configured AI provider."""
    resolved = enforce_local_only(
        await resolve_ai_settings(session, user, guild_id), operation="task.generation"
    )

    if not resolved.enabled:
        raise AIGenerationError("AI features are not enabled")

    if not resolved.api_key and resolved.provider != AIProvider.ollama:
        raise AIGenerationError("No API key configured for AI provider")

    if not resolved.provider:
        raise AIGenerationError("No AI provider configured")

    await _validate_generation_base_url(resolved.provider, resolved.base_url)

    # Convert Lexical JSON to markdown for better AI comprehension
    markdown_content = lexical_to_markdown(document_content)
    if not markdown_content.strip():
        raise AIGenerationError("Document has no content to summarize")

    locale = getattr(user, "locale", None) or "en"
    system_prompt, user_content = _build_summary_prompt(
        document_title, markdown_content, locale=locale
    )

    if resolved.provider == AIProvider.openai:
        return await _generate_openai_summary(
            api_key=resolved.api_key,
            model=resolved.model or "gpt-4o-mini",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.anthropic:
        return await _generate_anthropic_summary(
            api_key=resolved.api_key,
            model=resolved.model or "claude-3-5-haiku-20241022",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.ollama:
        return await _generate_ollama_summary(
            base_url=resolved.base_url or "http://localhost:11434",
            model=resolved.model or "llama3.2",
            system_prompt=system_prompt,
            user_content=user_content,
        )
    elif resolved.provider == AIProvider.custom:
        return await _generate_custom_summary(
            api_key=resolved.api_key,
            base_url=resolved.base_url,
            model=resolved.model,
            system_prompt=system_prompt,
            user_content=user_content,
        )
    else:
        raise AIGenerationError(f"Unsupported AI provider: {resolved.provider}")


def _locale_instruction(locale: str) -> str:
    """Return a prompt instruction for the target language, empty for English."""
    if locale == "en":
        return ""
    _LOCALE_NAMES = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "pt": "Portuguese",
        "ja": "Japanese",
        "ko": "Korean",
        "zh": "Chinese",
    }
    lang = _LOCALE_NAMES.get(locale, locale)
    return f"Write your response in {lang}.\n"


def _truncate_output(text: str, max_length: int) -> str:
    """Truncate LLM output to a maximum length."""
    if len(text) <= max_length:
        return text
    truncated = text[:max_length]
    # Try to break at last word boundary
    last_space = truncated.rfind(" ")
    if last_space > max_length // 2:
        truncated = truncated[:last_space]
    return truncated + "..."


# ---------------------------------------------------------------------------
# Prompt builders — return (system_prompt, user_content) tuples.
#
# System prompts contain only instructions. User content wraps all
# user-provided data in XML tags so the LLM can distinguish it from
# instructions, mitigating prompt-injection risks.
# ---------------------------------------------------------------------------


def _build_summary_prompt(
    title: str, content: str, *, locale: str = "en"
) -> tuple[str, str]:
    """Build system/user prompt pair for document summarization."""
    lang_instruction = _locale_instruction(locale)
    system_prompt = (
        "Summarize the provided document in 2-4 paragraphs, focusing on the key points.\n"
        "Write a clear, concise summary that captures the main ideas and important details.\n"
        f"{lang_instruction}"
        "Return ONLY the summary text, no other commentary."
    )
    user_content = (
        f"<document>\n"
        f"  <title>{html.escape(title)}</title>\n"
        f"  <content>\n{html.escape(content)}\n  </content>\n"
        f"</document>"
    )
    return system_prompt, user_content


def _build_subtasks_prompt(
    task: Task,
    initiative_name: str | None = None,
    project_name: str | None = None,
    *,
    locale: str = "en",
) -> tuple[str, str]:
    """Build system/user prompt pair for subtask generation."""
    lang_instruction = _locale_instruction(locale)
    system_prompt = (
        "Generate actionable subtasks for the task provided by the user.\n"
        "Return 3-7 specific, actionable subtasks as a JSON array of strings.\n"
        "Each subtask should be a clear action item that contributes to completing the main task.\n"
        "Keep each subtask concise (under 100 characters).\n"
        "Do not include numbering or bullet points in the subtask text.\n"
        f"{lang_instruction}"
        "Return ONLY the JSON array, no other text."
    )

    context_parts = []
    if initiative_name:
        context_parts.append(f"  <Initiative>{html.escape(initiative_name)}</Initiative>")
    if project_name:
        context_parts.append(f"  <project>{html.escape(project_name)}</project>")
    context_xml = (
        "\n<context>\n" + "\n".join(context_parts) + "\n</context>"
        if context_parts
        else ""
    )

    description_xml = (
        f"\n  <description>{html.escape(task.description)}</description>"
        if task.description
        else ""
    )
    user_content = (
        f"<task>\n"
        f"  <title>{html.escape(task.title)}</title>{description_xml}\n"
        f"</task>{context_xml}"
    )
    return system_prompt, user_content


def _build_description_prompt(
    task: Task,
    initiative_name: str | None = None,
    project_name: str | None = None,
    *,
    locale: str = "en",
) -> tuple[str, str]:
    """Build system/user prompt pair for description generation."""
    lang_instruction = _locale_instruction(locale)
    system_prompt = (
        "Write a clear task description for the task provided by the user.\n"
        "Write 2-4 sentences explaining what needs to be done, the expected outcome, "
        "and any key considerations.\n"
        "Be specific and actionable. Use markdown formatting if helpful.\n"
        f"{lang_instruction}"
        "Return ONLY the description text, no other commentary."
    )

    context_parts = []
    if initiative_name:
        context_parts.append(f"  <Initiative>{html.escape(initiative_name)}</Initiative>")
    if project_name:
        context_parts.append(f"  <project>{html.escape(project_name)}</project>")
    context_xml = (
        "\n<context>\n" + "\n".join(context_parts) + "\n</context>"
        if context_parts
        else ""
    )

    existing_xml = (
        f"\n  <existing_description>{html.escape(task.description)}</existing_description>"
        if task.description
        else ""
    )
    user_content = (
        f"<task>\n"
        f"  <title>{html.escape(task.title)}</title>{existing_xml}\n"
        f"</task>{context_xml}"
    )
    return system_prompt, user_content


def _parse_subtasks_response(text: str) -> list[str]:
    """Parse AI response to extract subtask list."""
    text = text.strip()

    # Try to find JSON array in response
    start_idx = text.find("[")
    end_idx = text.rfind("]")

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_text = text[start_idx : end_idx + 1]
        try:
            subtasks = json.loads(json_text)
            if isinstance(subtasks, list):
                return [
                    _truncate_output(str(s).strip(), _MAX_SUBTASK_LENGTH)
                    for s in subtasks
                    if s and str(s).strip()
                ]
        except json.JSONDecodeError:
            pass

    # Fallback: split by newlines if JSON parsing fails
    lines = text.split("\n")
    subtasks = []
    for line in lines:
        line = line.strip()
        # Remove common list prefixes
        for prefix in ["- ", "* ", "• "]:
            if line.startswith(prefix):
                line = line[len(prefix) :]
                break
        # Remove numbered prefixes like "1. " or "1) "
        if line and line[0].isdigit():
            for sep in [". ", ") ", ": "]:
                if sep in line[:4]:
                    line = line.split(sep, 1)[-1]
                    break
        if line:
            subtasks.append(_truncate_output(line, _MAX_SUBTASK_LENGTH))

    return subtasks[:7]  # Limit to 7 subtasks


def _is_openai_new_api_model(model: str) -> bool:
    """Check if the model uses the newer OpenAI API parameters.

    Reasoning models (o1, o3) and GPT-5+ models use:
    - max_completion_tokens instead of max_tokens
    - Don't support temperature parameter
    """
    model_lower = model.lower()
    # Reasoning models and GPT-5+ series
    return model_lower.startswith(("o1", "o3", "gpt-5"))


def _openai_messages(system_prompt: str, user_content: str) -> list[dict[str, str]]:
    """Build a messages array for OpenAI-compatible APIs."""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


# ---------------------------------------------------------------------------
# OpenAI implementation
# ---------------------------------------------------------------------------


async def _generate_openai_subtasks(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> list[str]:
    """Generate subtasks using OpenAI API."""
    if not api_key:
        raise AIGenerationError("API key is required for OpenAI")

    try:
        # Build request payload - newer models have different parameter requirements
        payload: dict = {
            "model": model,
            "messages": _openai_messages(system_prompt, user_content),
        }
        if _is_openai_new_api_model(model):
            # Reasoning models and GPT-5+ use max_completion_tokens, no temperature
            payload["max_completion_tokens"] = 1000
        else:
            payload["temperature"] = 0.7
            payload["max_tokens"] = 500

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid OpenAI API key")
            elif response.status_code != 200:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get(
                        "message", f"Status {response.status_code}"
                    )
                except Exception:
                    error_msg = f"Status {response.status_code}"
                raise AIGenerationError(f"OpenAI API error: {error_msg}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return _parse_subtasks_response(content)
    except httpx.TimeoutException:
        raise AIGenerationError("OpenAI request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"OpenAI request failed: {str(e)}")


async def _generate_openai_description(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate description using OpenAI API."""
    if not api_key:
        raise AIGenerationError("API key is required for OpenAI")

    try:
        # Build request payload - newer models have different parameter requirements
        payload: dict = {
            "model": model,
            "messages": _openai_messages(system_prompt, user_content),
        }
        if _is_openai_new_api_model(model):
            # Reasoning models and GPT-5+ use max_completion_tokens, no temperature
            payload["max_completion_tokens"] = 1000
        else:
            payload["temperature"] = 0.7
            payload["max_tokens"] = 500

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid OpenAI API key")
            elif response.status_code != 200:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get(
                        "message", f"Status {response.status_code}"
                    )
                except Exception:
                    error_msg = f"Status {response.status_code}"
                raise AIGenerationError(f"OpenAI API error: {error_msg}")

            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            return _truncate_output(text, _MAX_DESCRIPTION_LENGTH)
    except httpx.TimeoutException:
        raise AIGenerationError("OpenAI request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"OpenAI request failed: {str(e)}")


async def _generate_openai_summary(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate summary using OpenAI API."""
    if not api_key:
        raise AIGenerationError("API key is required for OpenAI")

    try:
        payload: dict = {
            "model": model,
            "messages": _openai_messages(system_prompt, user_content),
        }
        if _is_openai_new_api_model(model):
            payload["max_completion_tokens"] = 2000
        else:
            payload["temperature"] = 0.5
            payload["max_tokens"] = 1000

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid OpenAI API key")
            elif response.status_code != 200:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get(
                        "message", f"Status {response.status_code}"
                    )
                except Exception:
                    error_msg = f"Status {response.status_code}"
                raise AIGenerationError(f"OpenAI API error: {error_msg}")

            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            return _truncate_output(text, _MAX_SUMMARY_LENGTH)
    except httpx.TimeoutException:
        raise AIGenerationError("OpenAI request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"OpenAI request failed: {str(e)}")


# ---------------------------------------------------------------------------
# Anthropic implementation
# ---------------------------------------------------------------------------


async def _generate_anthropic_subtasks(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> list[str]:
    """Generate subtasks using Anthropic API."""
    if not api_key:
        raise AIGenerationError("API key is required for Anthropic")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 500,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_content}],
                },
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid Anthropic API key")
            elif response.status_code != 200:
                raise AIGenerationError(f"Anthropic API error: {response.status_code}")

            data = response.json()
            content = data["content"][0]["text"]
            return _parse_subtasks_response(content)
    except httpx.TimeoutException:
        raise AIGenerationError("Anthropic request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"Anthropic request failed: {str(e)}")


async def _generate_anthropic_description(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate description using Anthropic API."""
    if not api_key:
        raise AIGenerationError("API key is required for Anthropic")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 500,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_content}],
                },
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid Anthropic API key")
            elif response.status_code != 200:
                raise AIGenerationError(f"Anthropic API error: {response.status_code}")

            data = response.json()
            text = data["content"][0]["text"].strip()
            return _truncate_output(text, _MAX_DESCRIPTION_LENGTH)
    except httpx.TimeoutException:
        raise AIGenerationError("Anthropic request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"Anthropic request failed: {str(e)}")


async def _generate_anthropic_summary(
    api_key: str | None,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate summary using Anthropic API."""
    if not api_key:
        raise AIGenerationError("API key is required for Anthropic")

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": 1000,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_content}],
                },
            )

            if response.status_code == 401:
                raise AIGenerationError("Invalid Anthropic API key")
            elif response.status_code != 200:
                raise AIGenerationError(f"Anthropic API error: {response.status_code}")

            data = response.json()
            text = data["content"][0]["text"].strip()
            return _truncate_output(text, _MAX_SUMMARY_LENGTH)
    except httpx.TimeoutException:
        raise AIGenerationError("Anthropic request timed out")
    except AIGenerationError:
        raise
    except Exception as e:
        raise AIGenerationError(f"Anthropic request failed: {str(e)}")


# ---------------------------------------------------------------------------
# Ollama implementation
# ---------------------------------------------------------------------------


async def _generate_ollama_subtasks(
    base_url: str,
    model: str,
    system_prompt: str,
    user_content: str,
) -> list[str]:
    """Generate subtasks through Ollama's OpenAI-compatible adapter."""
    try:
        content = await ollama_chat_completion(
            base_url=base_url,
            model=model,
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=0.2,
            max_tokens=700,
            json_mode=True,
            timeout=60.0,
        )
        return _parse_subtasks_response(content)
    except OllamaAdapterError as exc:
        raise AIGenerationError(str(exc)) from exc
    except httpx.TimeoutException:
        raise AIGenerationError("Ollama request timed out")


async def _generate_ollama_description(
    base_url: str,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate description through Ollama's OpenAI-compatible adapter."""
    try:
        text = await ollama_chat_completion(
            base_url=base_url,
            model=model,
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=0.2,
            max_tokens=900,
            timeout=60.0,
        )
        return _truncate_output(text.strip(), _MAX_DESCRIPTION_LENGTH)
    except OllamaAdapterError as exc:
        raise AIGenerationError(str(exc)) from exc
    except httpx.TimeoutException:
        raise AIGenerationError("Ollama request timed out")


async def _generate_ollama_summary(
    base_url: str,
    model: str,
    system_prompt: str,
    user_content: str,
) -> str:
    """Generate summary through Ollama's OpenAI-compatible adapter."""
    try:
        text = await ollama_chat_completion(
            base_url=base_url,
            model=model,
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=0.1,
            max_tokens=1800,
            timeout=120.0,
        )
        return _truncate_output(text.strip(), _MAX_SUMMARY_LENGTH)
    except OllamaAdapterError as exc:
        raise AIGenerationError(str(exc)) from exc
    except httpx.TimeoutException:
        raise AIGenerationError("Ollama request timed out")


def lexical_to_markdown(document_content: dict | None) -> str:
    """Convert Lexical editor JSON content to a markdown string.

    This lightweight implementation serializes the provided Lexical JSON
    (as used by the backend for document summarisation) into readable markdown.
    It handles common node types: paragraph, heading, list, code, and quote.
    Unknown nodes are JSON‑dumped to avoid data loss.
    """
    import json

    if not document_content:
        return ""

    def render_node(node: dict) -> str:
        node_type = node.get("type")
        if node_type == "paragraph":
            return "".join(child.get("text", "") for child in node.get("children", []))
        if node_type == "heading":
            level = node.get("tag", "h2")[-1]
            try:
                level_int = int(level)
            except ValueError:
                level_int = 2
            heading_text = "".join(
                child.get("text", "") for child in node.get("children", [])
            )
            return f"{'#' * level_int} {heading_text}"
        if node_type == "list":
            items = []
            for child in node.get("children", []):
                item_text = "".join(
                    grandchild.get("text", "")
                    for grandchild in child.get("children", [])
                )
                prefix = "-" if node.get("listType") == "bullet" else "1."
                items.append(f"{prefix} {item_text}")
            return "\n".join(items)
        if node_type == "code":
            language = node.get("language", "")
            code_text = "".join(
                child.get("text", "") for child in node.get("children", [])
            )
            fence = "```" + language if language else "```"
            return f"{fence}\n{code_text}\n```"
        if node_type == "quote":
            quote_text = "".join(
                child.get("text", "") for child in node.get("children", [])
            )
            return "> " + quote_text.replace("\n", "\n> ")
        return json.dumps(node, ensure_ascii=False)

    root_nodes = (
        document_content.get("root", []) if isinstance(document_content, dict) else []
    )
    rendered = [render_node(n) for n in root_nodes]
    return "\n\n".join(rendered).strip()
