import { type FormEvent, useEffect, useState } from "react";

import type {
  AIProvider,
  PlatformAISettingsUpdate,
  AIOllamaHealthResponse,
  AITestConnectionResponse,
} from "@/api/generated/initiativeAPI.schemas";
import {
  AIRuntimeSettingsForm,
  type RuntimeFormState,
} from "@/features/ai-runtime-settings/AIRuntimeSettingsForm";
import { useRuntimeProfile } from "@/features/ai-runtime-settings/useRuntimeProfile";
import {
  useFetchAIModels,
  useOllamaHealth,
  usePlatformAISettings,
  useTestAIConnection,
  useUpdatePlatformAISettings,
} from "@/hooks/useAISettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/chesterToast";
import { Capability, hasCapability } from "@/lib/permissions";

const DEFAULT_FORM: RuntimeFormState = {
  enabled: false,
  provider: "",
  apiKey: "",
  baseUrl: "",
  model: "",
  embeddingModel: "",
  localOnly: false,
  allowGuildOverride: true,
  allowUserOverride: true,
};

export const SettingsAIPage = () => {
  const { user } = useAuth();
  const canManage = hasCapability(user, Capability.configManage);
  const [formState, setFormState] = useState<RuntimeFormState>(DEFAULT_FORM);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [runtimeHealth, setRuntimeHealth] = useState<{
    test?: AITestConnectionResponse | null;
    ollama?: AIOllamaHealthResponse | null;
  }>({});
  const { profile, setProfile, normalizeForProvider } =
    useRuntimeProfile("platform");

  const settingsQuery = usePlatformAISettings({ enabled: canManage });

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data) return;
    setFormState({
      enabled: data.enabled,
      provider: data.provider ?? "",
      apiKey: "",
      baseUrl: data.base_url ?? "",
      model: data.model ?? "",
      embeddingModel: data.embedding_model ?? "",
      localOnly: Boolean(data.local_only),
      allowGuildOverride: data.allow_guild_override,
      allowUserOverride: data.allow_user_override,
    });
    setHasExistingKey(data.has_api_key);
    normalizeForProvider(data.provider ?? "", data.model ?? "");
  }, [settingsQuery.data, normalizeForProvider]);

  const updateMutation = useUpdatePlatformAISettings({
    onSuccess: (data) => {
      toast.success("AI runtime settings saved.");
      setFormState((prev) => ({ ...prev, apiKey: "" }));
      setHasExistingKey(data.has_api_key);
    },
    onError: () => toast.error("Could not save AI runtime settings."),
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

  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        Only platform admins can manage platform AI runtime settings.
      </p>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        Loading AI runtime settings...
      </p>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <p className="text-destructive text-sm">
        Could not load AI runtime settings.
      </p>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: PlatformAISettingsUpdate = {
      enabled: Boolean(formState.enabled),
      provider: formState.provider || null,
      base_url: formState.baseUrl || null,
      model: formState.model || null,
      embedding_model: formState.embeddingModel || null,
      local_only: Boolean(formState.localOnly),
      allow_guild_override: Boolean(formState.allowGuildOverride),
      allow_user_override: Boolean(formState.allowUserOverride),
    };
    if (formState.apiKey) payload.api_key = formState.apiKey;
    updateMutation.mutate(payload);
  };

  const requestPayload = () => ({
    provider: formState.provider as AIProvider,
    api_key: formState.apiKey || null,
    base_url: formState.baseUrl || null,
    model: formState.model || null,
  });

  return (
    <AIRuntimeSettingsForm
      scope="platform"
      scopeLabel="Platform"
      title="AI Runtime Settings"
      description="Control the default OpenAI, Anthropic, Ollama or custom runtime used across the platform."
      canEdit={canManage}
      formState={formState}
      setFormState={setFormState}
      advancedProfile={profile}
      setAdvancedProfile={setProfile}
      availableModels={availableModels}
      hasExistingKey={hasExistingKey}
      onSubmit={submit}
      onTestConnection={() =>
        formState.provider && testMutation.mutate(requestPayload())
      }
      onFetchModels={() =>
        formState.provider &&
        fetchModelsMutation.mutate({
          provider: formState.provider,
          api_key: formState.apiKey || null,
          base_url: formState.baseUrl || null,
        })
      }
      onCheckOllamaHealth={() =>
        ollamaHealthMutation.mutate({
          api_key: formState.apiKey || null,
          base_url: formState.baseUrl || null,
          model: formState.model || null,
          embedding_model: formState.embeddingModel || null,
        })
      }
      onRunTestPrompt={() =>
        formState.provider && testMutation.mutate(requestPayload())
      }
      updatePending={updateMutation.isPending}
      testPending={testMutation.isPending}
      fetchModelsPending={fetchModelsMutation.isPending}
      ollamaHealthPending={ollamaHealthMutation.isPending}
      runtimeHealth={runtimeHealth}
      showPlatformOverrides
    />
  );
};
