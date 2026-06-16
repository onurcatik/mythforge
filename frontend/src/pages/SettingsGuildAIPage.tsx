import { type FormEvent, useEffect, useState } from "react";

import type {
  AIProvider,
  AIOllamaHealthResponse,
  AITestConnectionResponse,
  GuildAISettingsUpdate,
} from "@/api/generated/initiativeAPI.schemas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AIRuntimeSettingsForm,
  type RuntimeFormState,
} from "@/features/ai-runtime-settings/AIRuntimeSettingsForm";
import { useRuntimeProfile } from "@/features/ai-runtime-settings/useRuntimeProfile";
import {
  useFetchAIModels,
  useGuildAISettings,
  useOllamaHealth,
  useTestAIConnection,
  useUpdateGuildAISettings,
} from "@/hooks/useAISettings";
import { useGuilds } from "@/hooks/useGuilds";
import { toast } from "@/lib/chesterToast";
import { getErrorMessage } from "@/lib/errorMessage";

const DEFAULT_FORM: RuntimeFormState = {
  enabled: null,
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  embeddingModel: "",
  localOnly: false,
  allowUserOverride: null,
};

export const SettingsGuildAIPage = () => {
  const { activeGuild, activeGuildId } = useGuilds();
  const isGuildAdmin = activeGuild?.role === "admin";
  const [useInheritedSettings, setUseInheritedSettings] = useState(true);
  const [formState, setFormState] = useState<RuntimeFormState>(DEFAULT_FORM);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [runtimeHealth, setRuntimeHealth] = useState<{
    test?: AITestConnectionResponse | null;
    ollama?: AIOllamaHealthResponse | null;
  }>({});
  const { profile, setProfile, normalizeForProvider } = useRuntimeProfile(
    "guild",
    activeGuildId,
  );

  const settingsQuery = useGuildAISettings(activeGuildId, {
    enabled: isGuildAdmin,
  });

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    const hasOwnSettings =
      data.enabled !== null ||
      data.provider !== null ||
      data.has_api_key ||
      data.base_url !== null ||
      data.model !== null;

    setUseInheritedSettings(!hasOwnSettings);
    setFormState({
      enabled: data.enabled ?? data.effective_enabled,
      provider: data.provider ?? data.effective_provider ?? "",
      apiKey: "",
      baseUrl: data.base_url ?? data.effective_base_url ?? "",
      model: data.model ?? data.effective_model ?? "",
      embeddingModel:
        data.embedding_model ?? data.effective_embedding_model ?? "",
      localOnly: Boolean(data.local_only ?? data.effective_local_only),
      allowUserOverride:
        data.allow_user_override ?? data.effective_allow_user_override,
    });
    setHasExistingKey(data.has_api_key);
    normalizeForProvider(
      data.provider ?? data.effective_provider ?? "",
      data.model ?? data.effective_model ?? "",
    );
  }, [settingsQuery.data, normalizeForProvider]);

  const updateMutation = useUpdateGuildAISettings({
    onSuccess: (data) => {
      toast.success("Guild AI runtime settings saved.");
      setFormState((prev) => ({ ...prev, apiKey: "" }));
      setHasExistingKey(data.has_api_key);
    },
    onError: (error: Error) =>
      toast.error(
        getErrorMessage(error, "Could not save guild AI runtime settings."),
      ),
  });

  const testMutation = useTestAIConnection({
    onSuccess: (data) => {
      setRuntimeHealth((prev) => ({ ...prev, test: data }));
      if (data.available_models?.length)
        setAvailableModels(data.available_models);
      data.success ? toast.success(data.message) : toast.error(data.message);
    },
    onError: () => toast.error("Connection test failed."),
  });

  const fetchModelsMutation = useFetchAIModels({
    onSuccess: (data) => {
      if (data.models.length) setAvailableModels(data.models);
      if (data.error) toast.error(data.error);
    },
  });

  const ollamaHealthMutation = useOllamaHealth({
    onSuccess: (data) => {
      setRuntimeHealth((prev) => ({ ...prev, ollama: data }));
      if (data.models.length) setAvailableModels(data.models);
      data.ok ? toast.success(data.message) : toast.error(data.message);
    },
    onError: () => toast.error("Ollama health check failed."),
  });

  if (!isGuildAdmin) {
    return (
      <p className="text-muted-foreground text-sm">
        Only guild admins can manage guild AI runtime settings.
      </p>
    );
  }

  if (settingsQuery.isLoading)
    return (
      <p className="text-muted-foreground text-sm">
        Loading guild AI runtime settings...
      </p>
    );
  if (settingsQuery.isError || !settingsQuery.data)
    return (
      <p className="text-destructive text-sm">
        Could not load guild AI runtime settings.
      </p>
    );

  const canEdit = Boolean(settingsQuery.data.can_override);
  const activeProvider = useInheritedSettings
    ? settingsQuery.data.effective_provider
    : formState.provider;
  const activeBaseUrl = useInheritedSettings
    ? (settingsQuery.data.effective_base_url ?? "")
    : formState.baseUrl;
  const activeModel = useInheritedSettings
    ? (settingsQuery.data.effective_model ?? "")
    : formState.model;
  const activeEmbeddingModel = useInheritedSettings
    ? (settingsQuery.data.effective_embedding_model ?? "")
    : formState.embeddingModel;
  const activeLocalOnly = useInheritedSettings
    ? Boolean(settingsQuery.data.effective_local_only)
    : Boolean(formState.localOnly);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (useInheritedSettings) {
      updateMutation.mutate({ clear_settings: true });
      return;
    }
    const payload: GuildAISettingsUpdate = {
      enabled: formState.enabled,
      provider: formState.provider || null,
      base_url: formState.baseUrl || null,
      model: formState.model || null,
      embedding_model: formState.embeddingModel || null,
      local_only: Boolean(formState.localOnly),
      allow_user_override: formState.allowUserOverride,
    };
    if (formState.apiKey) payload.api_key = formState.apiKey;
    updateMutation.mutate(payload);
  };

  const providerRequest = () => ({
    provider: (activeProvider || formState.provider) as AIProvider,
    api_key: formState.apiKey || null,
    base_url: activeBaseUrl || null,
    model: activeModel || null,
  });

  return (
    <AIRuntimeSettingsForm
      scope="guild"
      scopeLabel="Guild"
      title="Guild AI Runtime Settings"
      description="Override platform AI runtime settings for this guild, including Ollama local-first mode."
      canEdit={canEdit}
      disabledReason="Platform settings currently prevent guild-level overrides."
      formState={
        useInheritedSettings
          ? {
              ...formState,
              provider: activeProvider ?? "",
              baseUrl: activeBaseUrl,
              model: activeModel,
              embeddingModel: activeEmbeddingModel,
              localOnly: activeLocalOnly,
              enabled: settingsQuery.data.effective_enabled,
            }
          : formState
      }
      setFormState={setFormState}
      advancedProfile={profile}
      setAdvancedProfile={setProfile}
      availableModels={availableModels}
      hasExistingKey={hasExistingKey}
      onSubmit={submit}
      onTestConnection={() =>
        activeProvider && testMutation.mutate(providerRequest())
      }
      onFetchModels={() =>
        activeProvider &&
        fetchModelsMutation.mutate({
          provider: activeProvider,
          api_key: formState.apiKey || null,
          base_url: activeBaseUrl || null,
        })
      }
      onCheckOllamaHealth={() =>
        ollamaHealthMutation.mutate({
          api_key: formState.apiKey || null,
          base_url: activeBaseUrl || null,
          model: activeModel || null,
          embedding_model: activeEmbeddingModel || null,
        })
      }
      onRunTestPrompt={() =>
        activeProvider && testMutation.mutate(providerRequest())
      }
      updatePending={updateMutation.isPending}
      testPending={testMutation.isPending}
      fetchModelsPending={fetchModelsMutation.isPending}
      ollamaHealthPending={ollamaHealthMutation.isPending}
      runtimeHealth={runtimeHealth}
      showGuildUserOverride={!useInheritedSettings}
      inheritanceControl={
        <Card className="premium-card">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-sm">Use platform runtime</p>
              <p className="text-muted-foreground text-xs">
                Keep this guild aligned with the platform AI provider.
              </p>
            </div>
            <Switch
              checked={useInheritedSettings}
              disabled={!canEdit}
              onCheckedChange={setUseInheritedSettings}
            />
          </CardContent>
        </Card>
      }
      inheritedSummary={
        useInheritedSettings ? (
          <Card className="premium-card bg-muted/20">
            <CardContent className="flex flex-wrap gap-2 p-4 text-sm">
              <Badge variant="outline">Inherited from platform</Badge>
              <span>
                {settingsQuery.data.effective_provider ?? "No provider"}
              </span>
              <span className="text-muted-foreground">/</span>
              <span>{settingsQuery.data.effective_model ?? "No model"}</span>
            </CardContent>
          </Card>
        ) : null
      }
    />
  );
};
