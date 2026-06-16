import { type FormEvent, useEffect, useState } from "react";

import type {
  AIProvider,
  AIOllamaHealthResponse,
  AITestConnectionResponse,
  UserAISettingsUpdate,
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
  useOllamaHealth,
  useTestAIConnection,
  useUpdateUserAISettings,
  useUserAISettings,
} from "@/hooks/useAISettings";
import { toast } from "@/lib/chesterToast";

const DEFAULT_FORM: RuntimeFormState = {
  enabled: null,
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  embeddingModel: "",
  localOnly: false,
};

export const UserSettingsAIPage = () => {
  const [useInheritedSettings, setUseInheritedSettings] = useState(true);
  const [formState, setFormState] = useState<RuntimeFormState>(DEFAULT_FORM);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [runtimeHealth, setRuntimeHealth] = useState<{
    test?: AITestConnectionResponse | null;
    ollama?: AIOllamaHealthResponse | null;
  }>({});
  const { profile, setProfile, normalizeForProvider } =
    useRuntimeProfile("user");

  const settingsQuery = useUserAISettings();

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
    });
    setHasExistingKey(data.has_api_key);
    normalizeForProvider(
      data.provider ?? data.effective_provider ?? "",
      data.model ?? data.effective_model ?? "",
    );
  }, [settingsQuery.data, normalizeForProvider]);

  const updateMutation = useUpdateUserAISettings({
    onSuccess: (data) => {
      toast.success("Personal AI runtime settings saved.");
      setFormState((prev) => ({ ...prev, apiKey: "" }));
      setHasExistingKey(data.has_api_key);
    },
    onError: () => toast.error("Could not save personal AI runtime settings."),
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

  if (settingsQuery.isLoading)
    return (
      <p className="text-muted-foreground text-sm">
        Loading personal AI runtime settings...
      </p>
    );
  if (settingsQuery.isError || !settingsQuery.data)
    return (
      <p className="text-destructive text-sm">
        Could not load personal AI runtime settings.
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
  const sourceLabel =
    settingsQuery.data.settings_source === "guild"
      ? "guild"
      : settingsQuery.data.settings_source === "user"
        ? "user"
        : "platform";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (useInheritedSettings) {
      updateMutation.mutate({ clear_settings: true });
      return;
    }
    const payload: UserAISettingsUpdate = {
      enabled: formState.enabled,
      provider: formState.provider || null,
      base_url: formState.baseUrl || null,
      model: formState.model || null,
      embedding_model: formState.embeddingModel || null,
      local_only: Boolean(formState.localOnly),
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
      scope="user"
      scopeLabel="User"
      title="Personal AI Runtime Settings"
      description="Choose your own AI provider and local/cloud runtime when your workspace allows user overrides."
      canEdit={canEdit}
      disabledReason="This workspace does not currently allow user-level AI runtime overrides."
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
      inheritanceControl={
        <Card className="premium-card">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-sm">Use inherited runtime</p>
              <p className="text-muted-foreground text-xs">
                Use the {sourceLabel} AI runtime selected for this workspace.
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
              <Badge variant="outline">Inherited from {sourceLabel}</Badge>
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
