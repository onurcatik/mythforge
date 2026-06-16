import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  Gauge,
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  Network,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  WifiOff,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";

import type {
  AIProvider,
  AIOllamaHealthResponse,
  AITestConnectionResponse,
} from "@/api/generated/initiativeAPI.schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelCombobox } from "@/components/ui/model-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumPage,
  SignalCard,
} from "@/components/design-system/PremiumPage";
import { RuntimeControlTower } from "@/widgets/ai-runtime";
import {
  getModelsForProvider,
  getProvidersForScope,
  PROVIDER_CONFIGS,
} from "@/lib/ai-providers";
import { cn } from "@/lib/utils";
import {
  getModelInstallHint,
  getRuntimeMode,
  normalizeAdvancedProfile,
  PROVIDER_CAPABILITIES,
  PROVIDER_RUNTIME_COPY,
  type RuntimeAdvancedProfile,
} from "./providerMetadata";

export type RuntimeFormState = {
  enabled: boolean | null;
  provider: AIProvider | "";
  apiKey: string;
  baseUrl: string;
  model: string;
  embeddingModel: string;
  localOnly: boolean;
  allowGuildOverride?: boolean | null;
  allowUserOverride?: boolean | null;
};

type RuntimeHealthState = {
  test?: AITestConnectionResponse | null;
  ollama?: AIOllamaHealthResponse | null;
};

type AIRuntimeSettingsFormProps = {
  scope: "platform" | "guild" | "user";
  scopeLabel: string;
  title: string;
  description: string;
  canEdit: boolean;
  disabledReason?: ReactNode;
  formState: RuntimeFormState;
  setFormState: (
    updater: RuntimeFormState | ((prev: RuntimeFormState) => RuntimeFormState),
  ) => void;
  advancedProfile: RuntimeAdvancedProfile;
  setAdvancedProfile: (
    updater:
      | RuntimeAdvancedProfile
      | ((prev: RuntimeAdvancedProfile) => RuntimeAdvancedProfile),
  ) => void;
  availableModels: string[];
  hasExistingKey: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTestConnection: () => void;
  onFetchModels: () => void;
  onCheckOllamaHealth: () => void;
  onRunTestPrompt?: () => void;
  updatePending: boolean;
  testPending: boolean;
  fetchModelsPending: boolean;
  ollamaHealthPending: boolean;
  runtimeHealth: RuntimeHealthState;
  inheritanceControl?: ReactNode;
  inheritedSummary?: ReactNode;
  showPlatformOverrides?: boolean;
  showGuildUserOverride?: boolean;
};

const numberFromInput = (value: string, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const capabilityTone = (capability: string) => {
  if (capability === "Local" || capability === "Private")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (capability === "Cloud")
    return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (capability === "Custom")
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300";
};

function ProviderBadgeList({ provider }: { provider: AIProvider | "" }) {
  if (!provider) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {PROVIDER_CAPABILITIES[provider].map((capability) => (
        <Badge
          key={capability}
          variant="outline"
          className={cn("rounded-full", capabilityTone(capability))}
        >
          {capability}
        </Badge>
      ))}
    </div>
  );
}

function RuntimeModeCard({
  provider,
  profile,
}: {
  provider: AIProvider | "";
  profile: RuntimeAdvancedProfile;
}) {
  const mode = getRuntimeMode(provider, profile);
  const Icon = mode === "local" ? Cpu : mode === "hybrid" ? GitBranch : Cloud;
  const title =
    mode === "local"
      ? "Local AI"
      : mode === "hybrid"
        ? "Hybrid fallback"
        : "Cloud AI";
  const copy =
    mode === "local"
      ? "Workspace context stays on the configured local/self-hosted runtime."
      : mode === "hybrid"
        ? "Local runtime is preferred; cloud fallback must remain explicitly allowed."
        : "Cloud provider is the active runtime for AI calls.";

  return (
    <SignalCard
      icon={Icon}
      label="Runtime mode"
      value={title}
      helper={copy}
      tone={mode === "local" ? "success" : mode === "hybrid" ? "warning" : "ai"}
    />
  );
}

function HealthPanel({
  provider,
  health,
}: {
  provider: AIProvider | "";
  health: RuntimeHealthState;
}) {
  const hasHealth = Boolean(health.test || health.ollama);
  const ok = health.ollama?.ok ?? health.test?.success ?? false;
  const models = health.ollama?.models ?? health.test?.available_models ?? [];
  const latency = health.ollama?.latency_ms ?? health.test?.latency_ms ?? null;
  const message =
    health.ollama?.message ??
    health.test?.message ??
    "No connection test has been run yet.";

  return (
    <Card className="premium-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Runtime health</CardTitle>
            <CardDescription>
              Connection, selected model and provider capability status.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full",
              ok
                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "border-muted-foreground/20 text-muted-foreground",
            )}
          >
            {hasHealth ? (ok ? "Healthy" : "Needs attention") : "Not tested"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Provider
            </p>
            <p className="mt-1 font-medium text-sm">
              {provider ? PROVIDER_CONFIGS[provider].label : "Not selected"}
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Latency
            </p>
            <p className="mt-1 font-medium text-sm">
              {typeof latency === "number" ? `${Math.round(latency)} ms` : "—"}
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-3">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
              Models found
            </p>
            <p className="mt-1 font-medium text-sm">{models?.length ?? 0}</p>
          </div>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-3 text-sm",
            ok ? "border-emerald-500/20 bg-emerald-500/5" : "bg-muted/30",
          )}
        >
          <div className="flex items-start gap-2">
            {ok ? (
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
            ) : (
              <WifiOff className="mt-0.5 size-4 text-muted-foreground" />
            )}
            <p className="text-muted-foreground leading-6">{message}</p>
          </div>
        </div>
        {health.ollama?.embedding_model ? (
          <div
            className={cn(
              "rounded-2xl border p-3 text-sm",
              health.ollama.embedding_model_available
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-amber-500/20 bg-amber-500/5",
            )}
          >
            <p className="font-medium">
              Embedding model: {health.ollama.embedding_model}
            </p>
            <p className="text-muted-foreground text-xs">
              {health.ollama.embedding_model_available
                ? "Available for local RAG indexing."
                : "Not found; run the matching ollama pull command before local RAG reindex."}
            </p>
          </div>
        ) : null}
        {models && models.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {models.slice(0, 10).map((model) => (
              <Badge key={model} variant="secondary" className="rounded-full">
                {model}
              </Badge>
            ))}
            {models.length > 10 ? (
              <Badge variant="outline" className="rounded-full">
                +{models.length - 10} more
              </Badge>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AIRuntimeSettingsForm({
  scope,
  scopeLabel,
  title,
  description,
  canEdit,
  disabledReason,
  formState,
  setFormState,
  advancedProfile,
  setAdvancedProfile,
  availableModels,
  hasExistingKey,
  onSubmit,
  onTestConnection,
  onFetchModels,
  onCheckOllamaHealth,
  onRunTestPrompt,
  updatePending,
  testPending,
  fetchModelsPending,
  ollamaHealthPending,
  runtimeHealth,
  inheritanceControl,
  inheritedSummary,
  showPlatformOverrides,
  showGuildUserOverride,
}: AIRuntimeSettingsFormProps) {
  const providerConfig = formState.provider
    ? PROVIDER_CONFIGS[formState.provider]
    : null;
  const providerCopy = formState.provider
    ? PROVIDER_RUNTIME_COPY[formState.provider]
    : null;
  const showApiKeyField = providerConfig?.requiresApiKey ?? false;
  const showBaseUrlField = providerConfig?.requiresBaseUrl ?? false;
  const modelOptions = getModelsForProvider(
    formState.provider,
    availableModels,
  );
  const effectiveProfile = {
    ...advancedProfile,
    embeddingModel: formState.embeddingModel || advancedProfile.embeddingModel,
    localOnly: formState.localOnly || advancedProfile.localOnly,
  };
  const runtimeMode = getRuntimeMode(formState.provider, effectiveProfile);
  const modelHint = getModelInstallHint(formState.provider, formState.model);
  const canRunOllamaHealth = formState.provider === "ollama";

  const updateAdvanced = <K extends keyof RuntimeAdvancedProfile>(
    key: K,
    value: RuntimeAdvancedProfile[K],
  ) => {
    setAdvancedProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleProviderChange = (value: string) => {
    if (!value) return;
    const provider = value as AIProvider;
    const config = PROVIDER_CONFIGS[provider];
    setFormState((prev) => ({
      ...prev,
      provider,
      baseUrl: config?.defaultBaseUrl ?? "",
      model: config?.defaultModels[0] ?? "",
      embeddingModel:
        provider === "ollama"
          ? "nomic-embed-text"
          : provider === "openai"
            ? "text-embedding-3-small"
            : prev.embeddingModel,
      localOnly: provider === "ollama" ? prev.localOnly : false,
    }));
    setAdvancedProfile((prev) =>
      normalizeAdvancedProfile(provider, config?.defaultModels[0] ?? "", prev),
    );
  };

  return (
    <PremiumPage
      eyebrow={`${scopeLabel} AI runtime`}
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onTestConnection}
            disabled={!formState.provider || testPending}
          >
            {testPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Gauge className="mr-2 size-4" />
            )}
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onCheckOllamaHealth}
            disabled={!canRunOllamaHealth || ollamaHealthPending}
          >
            {ollamaHealthPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Cpu className="mr-2 size-4" />
            )}
            Ollama health
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={onRunTestPrompt}
            disabled={!formState.provider}
          >
            <Bot className="mr-2 size-4" />
            Test prompt
          </Button>
        </div>
      }
    >
      <form className="space-y-6" onSubmit={onSubmit}>
        {!canEdit ? (
          <Card className="premium-card border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Lock className="mt-0.5 size-4 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium">Read-only runtime settings</p>
                <div className="text-muted-foreground">
                  {disabledReason ??
                    "You do not have permission to modify these settings."}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <RuntimeModeCard
            provider={formState.provider}
            profile={effectiveProfile}
          />
          <SignalCard
            icon={Database}
            label="RAG embedding"
            value={advancedProfile.embeddingModel || "Not set"}
            helper="Embedding model can be different from chat model."
            tone="default"
          />
          <SignalCard
            icon={ShieldCheck}
            label="Privacy guard"
            value={
              effectiveProfile.localOnly
                ? "Local-only"
                : runtimeMode === "hybrid"
                  ? "Fallback allowed"
                  : "Cloud allowed"
            }
            helper="Local-only prevents cloud fallback for sensitive workspace context."
            tone={
              effectiveProfile.localOnly
                ? "success"
                : runtimeMode === "hybrid"
                  ? "warning"
                  : "ai"
            }
          />
        </div>

        {inheritanceControl ? inheritanceControl : null}
        {inheritedSummary ? inheritedSummary : null}

        <RuntimeControlTower
          provider={formState.provider}
          chatModel={formState.model}
          embeddingModel={
            formState.embeddingModel || advancedProfile.embeddingModel
          }
          baseUrl={formState.baseUrl}
          runtimeMode={runtimeMode}
          advancedProfile={effectiveProfile}
          testHealth={runtimeHealth.test}
          ollamaHealth={runtimeHealth.ollama}
          canEdit={canEdit}
          onTestConnection={onTestConnection}
          onCheckOllamaHealth={onCheckOllamaHealth}
          onRunTestPrompt={onRunTestPrompt}
          testPending={testPending}
          ollamaHealthPending={ollamaHealthPending}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Provider & model routing</CardTitle>
              <CardDescription>
                Select the runtime used by RAG, Agent Orchestrator, Command
                Center and assignment flows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${scope}-ai-enabled`}>AI runtime</Label>
                  <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">Enable AI features</p>
                      <p className="text-muted-foreground text-xs">
                        Controls AI features at this scope.
                      </p>
                    </div>
                    <Switch
                      id={`${scope}-ai-enabled`}
                      checked={formState.enabled ?? false}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({
                          ...prev,
                          enabled: Boolean(checked),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${scope}-ai-provider`}>Provider</Label>
                  <Select
                    value={formState.provider}
                    onValueChange={handleProviderChange}
                    disabled={!canEdit}
                  >
                    <SelectTrigger id={`${scope}-ai-provider`}>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {getProvidersForScope(scope).map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {PROVIDER_CONFIGS[provider].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ProviderBadgeList provider={formState.provider} />
                </div>
              </div>

              {providerCopy ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                      <Network className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {providerCopy.title}
                      </p>
                      <p className="text-muted-foreground text-sm leading-6">
                        {providerCopy.description}
                      </p>
                      <p className="text-amber-700 text-xs leading-5 dark:text-amber-300">
                        {providerCopy.risk}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {showApiKeyField ? (
                <div className="space-y-2">
                  <Label htmlFor={`${scope}-ai-api-key`}>
                    API key / secret
                  </Label>
                  <div className="relative">
                    <KeyRound className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
                    <Input
                      id={`${scope}-ai-api-key`}
                      type="password"
                      className="pl-9"
                      value={formState.apiKey}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          apiKey: event.target.value,
                        }))
                      }
                      placeholder={
                        hasExistingKey
                          ? "Existing secret is saved; enter a new value to replace it"
                          : "Paste provider secret"
                      }
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Secrets are write-only and never rendered back in plain
                    text.
                  </p>
                </div>
              ) : null}

              {showBaseUrlField ? (
                <div className="space-y-2">
                  <Label htmlFor={`${scope}-ai-base-url`}>Base URL</Label>
                  <Input
                    id={`${scope}-ai-base-url`}
                    value={formState.baseUrl}
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder={
                      providerConfig?.defaultBaseUrl ??
                      "https://api.example.com/v1"
                    }
                  />
                  {formState.provider === "ollama" &&
                  formState.baseUrl.trim().startsWith("http://") ? (
                    <p className="flex items-center gap-2 text-amber-700 text-xs dark:text-amber-300">
                      <AlertTriangle className="size-3.5" /> HTTP is expected
                      for localhost Ollama, but remote HTTP should be avoided.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {formState.provider ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Chat model</Label>
                    <ModelCombobox
                      models={modelOptions}
                      value={formState.model}
                      onValueChange={(value) => {
                        setFormState((prev) => ({ ...prev, model: value }));
                        setAdvancedProfile((prev) =>
                          normalizeAdvancedProfile(
                            formState.provider,
                            value,
                            prev,
                          ),
                        );
                      }}
                      placeholder={
                        providerConfig?.modelPlaceholder ??
                        "Select or type model"
                      }
                      onOpen={onFetchModels}
                      isLoading={fetchModelsPending}
                    />
                    {modelHint ? (
                      <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 font-mono text-xs">
                        <Terminal className="size-3.5 text-muted-foreground" />
                        {modelHint}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${scope}-embedding-model`}>
                      Embedding model
                    </Label>
                    <Input
                      id={`${scope}-embedding-model`}
                      value={
                        formState.embeddingModel ||
                        advancedProfile.embeddingModel
                      }
                      disabled={!canEdit}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFormState((prev) => ({
                          ...prev,
                          embeddingModel: value,
                        }));
                        updateAdvanced("embeddingModel", value);
                      }}
                      placeholder={
                        formState.provider === "ollama"
                          ? "nomic-embed-text"
                          : "text-embedding-3-small"
                      }
                    />
                    <p className="text-muted-foreground text-xs">
                      Changing embeddings may require a RAG reindex.
                    </p>
                  </div>
                </div>
              ) : null}

              {showPlatformOverrides ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">
                        Allow guild override
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Guild admins can choose their own runtime.
                      </p>
                    </div>
                    <Switch
                      checked={formState.allowGuildOverride ?? true}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({
                          ...prev,
                          allowGuildOverride: Boolean(checked),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">Allow user override</p>
                      <p className="text-muted-foreground text-xs">
                        Users can set personal runtime preferences.
                      </p>
                    </div>
                    <Switch
                      checked={formState.allowUserOverride ?? true}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({
                          ...prev,
                          allowUserOverride: Boolean(checked),
                        }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {showGuildUserOverride ? (
                <div className="flex items-center justify-between rounded-2xl border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Allow user override</p>
                    <p className="text-muted-foreground text-xs">
                      Members can use their personal provider when allowed.
                    </p>
                  </div>
                  <Switch
                    checked={formState.allowUserOverride ?? true}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({
                        ...prev,
                        allowUserOverride: Boolean(checked),
                      }))
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <HealthPanel provider={formState.provider} health={runtimeHealth} />

            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SlidersHorizontal className="size-4" /> Advanced runtime
                  profile
                </CardTitle>
                <CardDescription>
                  Frontend runtime metadata for validation, UX and future
                  backend expansion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={advancedProfile.temperature}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateAdvanced(
                          "temperature",
                          numberFromInput(event.target.value, 0.2),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max tokens</Label>
                    <Input
                      type="number"
                      min="256"
                      value={advancedProfile.maxTokens}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateAdvanced(
                          "maxTokens",
                          numberFromInput(event.target.value, 4096),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Context window</Label>
                    <Input
                      type="number"
                      min="1024"
                      value={advancedProfile.contextWindow}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateAdvanced(
                          "contextWindow",
                          numberFromInput(event.target.value, 8192),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeout seconds</Label>
                    <Input
                      type="number"
                      min="5"
                      value={advancedProfile.timeoutSeconds}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateAdvanced(
                          "timeoutSeconds",
                          numberFromInput(event.target.value, 60),
                        )
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">Streaming responses</p>
                      <p className="text-muted-foreground text-xs">
                        Show partial output in AI Command Center when supported.
                      </p>
                    </div>
                    <Switch
                      checked={advancedProfile.streaming}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        updateAdvanced("streaming", Boolean(checked))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">
                        Structured JSON mode
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Prefer validated JSON for RAG, Agent and command
                        outputs.
                      </p>
                    </div>
                    <Switch
                      checked={advancedProfile.jsonMode}
                      disabled={!canEdit || formState.provider === "anthropic"}
                      onCheckedChange={(checked) =>
                        updateAdvanced("jsonMode", Boolean(checked))
                      }
                    />
                  </div>
                  {formState.provider === "ollama" ? (
                    <>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-emerald-500/5 px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">
                            Local-only privacy mode
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Block cloud fallback for sensitive workspace data.
                          </p>
                        </div>
                        <Switch
                          checked={
                            formState.localOnly || advancedProfile.localOnly
                          }
                          disabled={!canEdit}
                          onCheckedChange={(checked) => {
                            const localOnly = Boolean(checked);
                            setFormState((prev) => ({
                              ...prev,
                              localOnly,
                              provider: localOnly ? "ollama" : prev.provider,
                              baseUrl:
                                localOnly && !prev.baseUrl
                                  ? "http://localhost:11434"
                                  : prev.baseUrl,
                              model:
                                localOnly && !prev.model
                                  ? "llama3.2"
                                  : prev.model,
                              embeddingModel:
                                localOnly && !prev.embeddingModel
                                  ? "nomic-embed-text"
                                  : prev.embeddingModel,
                            }));
                            setAdvancedProfile((prev) => ({
                              ...prev,
                              localOnly,
                              hybridFallback: localOnly
                                ? false
                                : prev.hybridFallback,
                            }));
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-amber-500/5 px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">
                            Hybrid cloud fallback
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Allow fallback only when local-only mode is
                            disabled.
                          </p>
                        </div>
                        <Switch
                          checked={advancedProfile.hybridFallback}
                          disabled={
                            !canEdit ||
                            formState.localOnly ||
                            advancedProfile.localOnly
                          }
                          onCheckedChange={(checked) =>
                            updateAdvanced("hybridFallback", Boolean(checked))
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                {formState.provider === "custom" ? (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Chat path</Label>
                        <Input
                          value={advancedProfile.customChatPath}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateAdvanced("customChatPath", event.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Embedding path</Label>
                        <Input
                          value={advancedProfile.customEmbeddingPath}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateAdvanced(
                              "customEmbeddingPath",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Auth header name</Label>
                        <Input
                          value={advancedProfile.customAuthHeaderName}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateAdvanced(
                              "customAuthHeaderName",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle>Runtime impact matrix</CardTitle>
            <CardDescription>
              Current model routing across the AI product surface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                [
                  "RAG workspace memory",
                  formState.embeddingModel ||
                    advancedProfile.embeddingModel ||
                    formState.model ||
                    "Not configured",
                  "Embeddings + answer synthesis",
                ],
                [
                  "Agent Orchestrator",
                  formState.model || "Not configured",
                  "Plan preview, diff and approval",
                ],
                [
                  "AI Command Center",
                  formState.model || "Not configured",
                  "Intent routing and answers",
                ],
                [
                  "Assignment Engine",
                  formState.model || "Deterministic scoring",
                  "Recommendations + rationale",
                ],
              ].map(([label, value, helper]) => (
                <div key={label} className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                    {label}
                  </p>
                  <p className="mt-2 font-semibold text-sm">{value}</p>
                  <p className="mt-1 text-muted-foreground text-xs leading-5">
                    {helper}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card border-amber-500/20 bg-amber-500/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Compatibility note</p>
                <p className="text-muted-foreground leading-6">
                  Provider, base URL, chat model, embedding model and Local AI
                  Mode are saved through the backend settings API. Temperature,
                  context window and UI-only fallback preferences remain in the
                  local runtime profile until first-class backend fields are
                  added.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/90 p-4">
          <div className="text-sm">
            <p className="font-medium">
              Unsaved backend changes are applied only after Save.
            </p>
            <p className="text-muted-foreground">
              Advanced profile edits are retained locally for this{" "}
              {scopeLabel.toLowerCase()} runtime screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setAdvancedProfile((prev) =>
                  normalizeAdvancedProfile(
                    formState.provider,
                    formState.model,
                    prev,
                  ),
                )
              }
              disabled={!canEdit}
            >
              <RotateCcw className="mr-2 size-4" /> Normalize profile
            </Button>
            <Button type="submit" disabled={!canEdit || updatePending}>
              {updatePending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 size-4" />
              )}
              Save runtime settings
            </Button>
          </div>
        </div>
      </form>
    </PremiumPage>
  );
}
