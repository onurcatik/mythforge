from enum import Enum
from typing import Optional

from pydantic import ConfigDict, Field

from app.schemas.base import SanitizedBaseModel


class AIProvider(str, Enum):
    openai = "openai"
    anthropic = "anthropic"
    ollama = "ollama"
    custom = "custom"


# Platform (AppSetting) level schemas
class PlatformAISettingsResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    enabled: bool
    provider: Optional[AIProvider] = None
    has_api_key: bool = False
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: bool = False
    runtime_mode: str = "cloud"
    allow_guild_override: bool = True
    allow_user_override: bool = True


class PlatformAISettingsUpdate(SanitizedBaseModel):
    enabled: bool
    provider: Optional[AIProvider] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: bool = False
    allow_guild_override: bool = True
    allow_user_override: bool = True


# Guild level schemas
class GuildAISettingsResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    # Guild's own settings (null = inherit)
    enabled: Optional[bool] = None
    provider: Optional[AIProvider] = None
    has_api_key: bool = False
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: Optional[bool] = None
    allow_user_override: Optional[bool] = None

    # Effective (computed) settings
    effective_enabled: bool = False
    effective_provider: Optional[AIProvider] = None
    effective_base_url: Optional[str] = None
    effective_model: Optional[str] = None
    effective_embedding_model: Optional[str] = None
    effective_local_only: bool = False
    effective_runtime_mode: str = "cloud"
    effective_allow_user_override: bool = True

    # Permission flags
    can_override: bool = True  # Whether guild can override platform settings


class GuildAISettingsUpdate(SanitizedBaseModel):
    enabled: Optional[bool] = None
    provider: Optional[AIProvider] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: Optional[bool] = None
    allow_user_override: Optional[bool] = None
    clear_settings: bool = Field(
        default=False,
        description="If true, clears all guild AI settings to inherit from platform"
    )


# User level schemas
class UserAISettingsResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    # User's own settings (null = inherit)
    enabled: Optional[bool] = None
    provider: Optional[AIProvider] = None
    has_api_key: bool = False
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: Optional[bool] = None

    # Effective (computed) settings
    effective_enabled: bool = False
    effective_provider: Optional[AIProvider] = None
    effective_base_url: Optional[str] = None
    effective_model: Optional[str] = None
    effective_embedding_model: Optional[str] = None
    effective_local_only: bool = False
    effective_runtime_mode: str = "cloud"

    # Permission flags
    can_override: bool = True  # Whether user can override guild/platform settings
    settings_source: str = "platform"  # "platform", "guild", or "user"


class UserAISettingsUpdate(SanitizedBaseModel):
    enabled: Optional[bool] = None
    provider: Optional[AIProvider] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: Optional[bool] = None
    clear_settings: bool = Field(
        default=False,
        description="If true, clears all user AI settings to inherit from guild/platform"
    )


# Resolved settings (final computed, used internally)
class ResolvedAISettings(SanitizedBaseModel):
    enabled: bool = False
    provider: Optional[AIProvider] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: bool = False
    runtime_mode: str = "cloud"
    source: str = "platform"  # Where the settings came from


# Resolved settings response (without API key for frontend)
class ResolvedAISettingsResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    enabled: bool = False
    provider: Optional[AIProvider] = None
    has_api_key: bool = False
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None
    local_only: bool = False
    runtime_mode: str = "cloud"
    source: str = "platform"


# Test connection schemas
class AITestConnectionRequest(SanitizedBaseModel):
    provider: AIProvider
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class AITestConnectionResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    success: bool
    message: str
    available_models: Optional[list[str]] = None
    latency_ms: Optional[float] = None
    selected_model_available: Optional[bool] = None


# Fetch models schemas
class AIModelsRequest(SanitizedBaseModel):
    provider: AIProvider
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class AIModelsResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    models: list[str]
    error: Optional[str] = None


class AIOllamaHealthRequest(SanitizedBaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    embedding_model: Optional[str] = None


class AIOllamaHealthResponse(SanitizedBaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    ok: bool
    base_url: str
    models: list[str]
    selected_model: Optional[str] = None
    selected_model_available: Optional[bool] = None
    embedding_model: Optional[str] = None
    embedding_model_available: Optional[bool] = None
    latency_ms: float
    message: str
