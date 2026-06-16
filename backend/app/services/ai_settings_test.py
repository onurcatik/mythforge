"""Tests for AI settings SSRF guard on base_url."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.schemas.ai_settings import (
    AIProvider,
    GuildAISettingsUpdate,
    UserAISettingsUpdate,
)
from app.services.ai_settings import (
    _test_ollama_connection,
    _test_custom_connection,
    _fetch_ollama_models,
    _fetch_custom_models,
    update_guild_ai_settings,
    update_user_ai_settings,
)


@pytest.mark.unit
async def test_ollama_test_connection_blocks_private_ip():
    """_test_ollama_connection rejects a private-IP base_url."""
    result = await _test_ollama_connection("http://169.254.169.254/", None)
    assert result.success is False
    assert "Invalid base URL" in result.message


@pytest.mark.unit
async def test_ollama_test_connection_allows_no_base_url():
    """_test_ollama_connection with no base_url uses the localhost default (not SSRF-guarded)."""
    with patch("app.services.ai_settings.ollama_health") as mock_health:
        mock_health.return_value = MagicMock(
            ok=True,
            base_url="http://localhost:11434",
            models=["llama3"],
            selected_model=None,
            selected_model_available=None,
            latency_ms=12.0,
            message="Ollama connection successful",
        )
        result = await _test_ollama_connection(None, None)
        assert result.success is True
        assert result.available_models == ["llama3"]


@pytest.mark.unit
async def test_custom_test_connection_blocks_private_ip():
    """_test_custom_connection rejects a private-IP base_url."""
    result = await _test_custom_connection(None, "http://10.0.0.1/", None)
    assert result.success is False
    assert "Invalid base URL" in result.message


@pytest.mark.unit
async def test_fetch_ollama_models_blocks_private_ip():
    """_fetch_ollama_models rejects a private-IP base_url."""
    models, error = await _fetch_ollama_models("http://192.168.1.1/")
    assert models == []
    assert error is not None
    assert "Invalid base URL" in error


@pytest.mark.unit
async def test_fetch_custom_models_blocks_private_ip():
    """_fetch_custom_models rejects a private-IP base_url."""
    models, error = await _fetch_custom_models(None, "http://172.16.0.1/")
    assert models == []
    assert error is not None
    assert "Invalid base URL" in error


@pytest.mark.unit
async def test_custom_test_connection_returns_error_without_base_url():
    """_test_custom_connection with no base_url returns the 'Base URL required' error without hitting SSRF guard."""
    result = await _test_custom_connection(None, None, None)
    assert result.success is False
    assert "Base URL is required" in result.message


@pytest.mark.unit
async def test_fetch_ollama_models_allows_no_base_url():
    """_fetch_ollama_models with no base_url uses localhost default (not SSRF-guarded)."""
    with patch("app.services.ai_settings.ollama_list_models", AsyncMock(return_value=["llama3"])):
        models, error = await _fetch_ollama_models(None)
        assert error is None
        assert "llama3" in models


@pytest.mark.unit
async def test_update_guild_ai_settings_allows_ollama_override():
    """Guild AI settings can select Ollama when platform override is enabled."""
    platform_settings = MagicMock(ai_allow_guild_override=True)
    guild_settings = MagicMock()
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    payload = GuildAISettingsUpdate(provider=AIProvider.ollama, base_url=None, model="llama3.2")

    with patch("app.services.ai_settings.get_app_settings", AsyncMock(return_value=platform_settings)), patch(
        "app.services.ai_settings.get_or_create_guild_settings", AsyncMock(return_value=guild_settings)
    ), patch("app.services.ai_settings.reapply_rls_context", AsyncMock()), patch(
        "app.services.ai_settings.get_guild_ai_settings", AsyncMock(return_value=MagicMock())
    ):
        await update_guild_ai_settings(session, 1, payload)

    assert guild_settings.ai_provider == "ollama"
    assert guild_settings.ai_model == "llama3.2"


@pytest.mark.unit
async def test_update_user_ai_settings_allows_ollama_override():
    """User AI settings can select Ollama when user override is enabled."""
    platform_settings = MagicMock(ai_allow_user_override=True)
    user = MagicMock()
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    payload = UserAISettingsUpdate(provider=AIProvider.ollama, base_url=None, model="llama3.2")

    with patch("app.services.ai_settings.get_app_settings", AsyncMock(return_value=platform_settings)), patch(
        "app.services.ai_settings.reapply_rls_context", AsyncMock()
    ), patch("app.services.ai_settings.get_user_ai_settings", AsyncMock(return_value=MagicMock())):
        await update_user_ai_settings(session, user, payload, guild_id=None)

    assert user.ai_provider == "ollama"
    assert user.ai_model == "llama3.2"


@pytest.mark.unit
async def test_ollama_test_connection_bypass_allows_http_private():
    """bypass_ssrf=True (platform admin) lets http://private through."""
    with patch("app.services.ai_settings.ollama_health") as mock_health:
        mock_health.return_value = MagicMock(
            ok=True,
            base_url="http://10.0.0.1:11434",
            models=["llama3"],
            selected_model=None,
            selected_model_available=None,
            latency_ms=12.0,
            message="Ollama connection successful",
        )
        result = await _test_ollama_connection("http://10.0.0.1:11434", None, bypass_ssrf=True)
        assert result.success is True


@pytest.mark.unit
async def test_fetch_ollama_models_bypass_allows_http_private():
    """bypass_ssrf=True lets _fetch_ollama_models hit a private endpoint."""
    with patch("app.services.ai_settings.ollama_list_models", AsyncMock(return_value=["llama3"])):
        models, error = await _fetch_ollama_models("http://192.168.1.10:11434", bypass_ssrf=True)
        assert error is None
        assert "llama3" in models


@pytest.mark.unit
async def test_update_guild_ai_settings_allows_clear_settings_with_ollama_unset():
    """clear_settings=True bypasses the provider check (settings get nulled regardless)."""
    platform_settings = MagicMock(ai_allow_guild_override=True)
    guild_settings = MagicMock()
    session = MagicMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    payload = GuildAISettingsUpdate(clear_settings=True, provider=AIProvider.ollama)

    with patch(
        "app.services.ai_settings.get_app_settings",
        AsyncMock(return_value=platform_settings),
    ), patch(
        "app.services.ai_settings.get_or_create_guild_settings",
        AsyncMock(return_value=guild_settings),
    ), patch(
        "app.services.ai_settings.reapply_rls_context",
        AsyncMock(),
    ), patch(
        "app.services.ai_settings.get_guild_ai_settings",
        AsyncMock(return_value=MagicMock()),
    ):
        await update_guild_ai_settings(session, 1, payload)

    assert guild_settings.ai_provider is None
