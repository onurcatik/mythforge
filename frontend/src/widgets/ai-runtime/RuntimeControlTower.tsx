import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Cpu,
  GitBranch,
  LockKeyhole,
  Network,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  AIProvider,
  AIOllamaHealthResponse,
  AITestConnectionResponse,
} from "@/api/generated/initiativeAPI.schemas";
import { Button } from "@/components/ui/button";
import { PROVIDER_CONFIGS } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";
import {
  type RuntimeAdvancedProfile,
  type RuntimeMode,
} from "@/features/ai-runtime-settings/providerMetadata";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type RuntimeControlTowerProps = {
  provider: AIProvider | "";
  chatModel?: string | null;
  embeddingModel?: string | null;
  baseUrl?: string | null;
  runtimeMode: RuntimeMode;
  advancedProfile: RuntimeAdvancedProfile;
  testHealth?: AITestConnectionResponse | null;
  ollamaHealth?: AIOllamaHealthResponse | null;
  canEdit?: boolean;
  onTestConnection?: () => void;
  onCheckOllamaHealth?: () => void;
  onRunTestPrompt?: () => void;
  testPending?: boolean;
  ollamaHealthPending?: boolean;
};

const modeCopy: Record<
  RuntimeMode,
  {
    label: string;
    description: string;
    icon: typeof Cloud;
    tone: "success" | "warning" | "info" | "ai";
  }
> = {
  local: {
    label: "Local Ollama runtime",
    description:
      "Workspace prompts, RAG context and agent planning stay on the configured local/self-hosted runtime.",
    icon: Cpu,
    tone: "success",
  },
  hybrid: {
    label: "Hybrid runtime",
    description:
      "The system prefers local execution but may fall back to cloud only when this is explicitly allowed.",
    icon: GitBranch,
    tone: "warning",
  },
  cloud: {
    label: "Cloud runtime",
    description:
      "AI work is routed to the selected cloud provider; use Local AI Mode for privacy-first workspaces.",
    icon: Cloud,
    tone: "info",
  },
};

const capabilityRows = [
  ["RAG answer", "Workspace question answering", "chat"],
  ["RAG embedding", "Workspace memory indexing", "embedding"],
  ["Agent planning", "Plan, diff and approval previews", "agent"],
  ["Command Center", "Intent routing and operations answers", "command"],
  [
    "Assignment rationale",
    "Explain scoring without changing deterministic ranking",
    "assignment",
  ],
] as const;

function RuntimeMeter({
  label,
  value,
  helper,
  tone = "info",
}: {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "success" | "warning" | "info" | "ai";
}) {
  const toneClass = {
    success: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/20",
    warning: "from-amber-500/30 to-amber-500/5 border-amber-500/20",
    info: "from-sky-500/30 to-sky-500/5 border-sky-500/20",
    ai: "from-violet-500/30 to-cyan-500/5 border-violet-500/20",
  }[tone];

  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4", toneClass)}>
      <p className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className="mt-2 font-semibold text-lg tracking-[-0.03em]">{value}</p>
      {helper ? (
        <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-xs leading-5">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function modelAvailable(
  health: AIOllamaHealthResponse | null | undefined,
  model: string | null | undefined,
) {
  if (!model) return false;
  if (!health?.models?.length) return false;
  return (
    health.models.includes(model) ||
    Boolean(health.selected_model_available && health.selected_model === model)
  );
}

export function RuntimeControlTower({
  provider,
  chatModel,
  embeddingModel,
  baseUrl,
  runtimeMode,
  advancedProfile,
  testHealth,
  ollamaHealth,
  canEdit = true,
  onTestConnection,
  onCheckOllamaHealth,
  onRunTestPrompt,
  testPending,
  ollamaHealthPending,
}: RuntimeControlTowerProps) {
  const providerLabel = provider
    ? PROVIDER_CONFIGS[provider].label
    : "Not selected";
  const mode = modeCopy[runtimeMode];
  const ModeIcon = mode.icon;
  const healthOk = ollamaHealth?.ok ?? testHealth?.success ?? false;
  const latency = ollamaHealth?.latency_ms ?? testHealth?.latency_ms ?? null;
  const isLocal = runtimeMode === "local";
  const isRemoteOllama =
    provider === "ollama" &&
    Boolean(baseUrl) &&
    !String(baseUrl).includes("localhost") &&
    !String(baseUrl).includes("127.0.0.1");
  const chatReady =
    provider === "ollama"
      ? modelAvailable(ollamaHealth, chatModel)
      : Boolean(testHealth?.selected_model_available ?? chatModel);
  const embeddingReady =
    provider === "ollama"
      ? Boolean(ollamaHealth?.embedding_model_available)
      : Boolean(embeddingModel || provider === "openai");
  const needsReindex = Boolean(
    embeddingModel &&
    provider === "ollama" &&
    ollamaHealth &&
    !ollamaHealth.embedding_model_available,
  );

  return (
    <Surface tone="ai" padding="lg" className="overflow-hidden">
      <Stack gap="lg">
        <Cluster justify="between" align="start" gap="lg">
          <Stack gap="sm" className="max-w-3xl">
            <Cluster gap="xs">
              <StatusBadge tone={mode.tone} dot>
                <ModeIcon className="mr-1 size-3" />
                {mode.label}
              </StatusBadge>
              <StatusBadge tone={healthOk ? "success" : "warning"}>
                {healthOk ? "Healthy" : "Needs test"}
              </StatusBadge>
              {advancedProfile.localOnly ? (
                <StatusBadge tone="success">
                  <LockKeyhole className="mr-1 size-3" />
                  Cloud blocked
                </StatusBadge>
              ) : null}
            </Cluster>
            <div>
              <h2 className="font-semibold text-2xl tracking-[-0.04em]">
                AI Runtime Control Tower
              </h2>
              <p className="mt-2 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                One premium cockpit for provider routing, local privacy
                guarantees, Ollama readiness and the AI surfaces that depend on
                this runtime.
              </p>
            </div>
          </Stack>
          <Cluster gap="xs" justify="end" className="shrink-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-full bg-background/60"
              onClick={onTestConnection}
              disabled={!provider || !canEdit || testPending}
            >
              <Network
                className={cn("size-4", testPending && "animate-pulse")}
              />
              Test
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full bg-background/60"
              onClick={onCheckOllamaHealth}
              disabled={
                provider !== "ollama" || !canEdit || ollamaHealthPending
              }
            >
              <RefreshCw
                className={cn("size-4", ollamaHealthPending && "animate-spin")}
              />
              Ollama
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={onRunTestPrompt}
              disabled={!provider || !canEdit}
            >
              <Bot className="size-4" />
              Test prompt
            </Button>
          </Cluster>
        </Cluster>

        <div className="grid gap-3 md:grid-cols-4">
          <RuntimeMeter
            label="Provider"
            value={providerLabel}
            helper={baseUrl || "Default provider endpoint"}
            tone={isLocal ? "success" : "info"}
          />
          <RuntimeMeter
            label="Chat model"
            value={chatModel || "Not configured"}
            helper={
              chatReady
                ? "Ready for answers and agents"
                : "Run health check to verify"
            }
            tone={chatReady ? "success" : "warning"}
          />
          <RuntimeMeter
            label="Embedding model"
            value={embeddingModel || "Not configured"}
            helper={
              embeddingReady
                ? "Ready for workspace memory"
                : "Model availability needs attention"
            }
            tone={embeddingReady ? "success" : "warning"}
          />
          <RuntimeMeter
            label="Latency"
            value={
              typeof latency === "number"
                ? `${Math.round(latency)} ms`
                : "Not tested"
            }
            helper="Last runtime check"
            tone={healthOk ? "success" : "ai"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
            <Stack gap="md">
              <Cluster justify="between" align="start">
                <Stack gap="xs">
                  <h3 className="font-semibold tracking-[-0.02em]">
                    Runtime routing matrix
                  </h3>
                  <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                    Every AI product surface should resolve through the same
                    runtime policy instead of making isolated provider
                    decisions.
                  </p>
                </Stack>
                <StatusBadge
                  tone={
                    advancedProfile.localOnly
                      ? "success"
                      : advancedProfile.hybridFallback
                        ? "warning"
                        : "info"
                  }
                >
                  {advancedProfile.localOnly
                    ? "Local-only"
                    : advancedProfile.hybridFallback
                      ? "Hybrid"
                      : "Provider policy"}
                </StatusBadge>
              </Cluster>
              <div className="grid gap-2 md:grid-cols-2">
                {capabilityRows.map(([name, helper, kind]) => {
                  const usesEmbedding = kind === "embedding";
                  const ready = usesEmbedding
                    ? embeddingReady
                    : chatReady || provider !== "ollama";
                  return (
                    <div
                      key={name}
                      className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3"
                    >
                      <Cluster
                        justify="between"
                        gap="sm"
                        className="flex-nowrap"
                      >
                        <Stack gap="xs" className="min-w-0">
                          <p className="font-medium text-sm">{name}</p>
                          <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">
                            {helper}
                          </p>
                        </Stack>
                        {ready ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                        )}
                      </Cluster>
                    </div>
                  );
                })}
              </div>
            </Stack>
          </div>

          <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
            <Stack gap="md">
              <Cluster gap="sm">
                <ShieldCheck className="size-5 text-emerald-500" />
                <h3 className="font-semibold tracking-[-0.02em]">
                  Privacy posture
                </h3>
              </Cluster>
              <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                {mode.description}
              </p>
              <div className="space-y-2">
                <StatusBadge
                  tone={advancedProfile.localOnly ? "success" : "warning"}
                  dot
                >
                  {advancedProfile.localOnly
                    ? "Cloud fallback blocked"
                    : "Cloud fallback not blocked"}
                </StatusBadge>
                <StatusBadge
                  tone={
                    isRemoteOllama ? "warning" : isLocal ? "success" : "info"
                  }
                  dot
                >
                  {isRemoteOllama
                    ? "Remote Ollama endpoint"
                    : isLocal
                      ? "Local/self-hosted AI"
                      : "Cloud provider"}
                </StatusBadge>
                <StatusBadge
                  tone={advancedProfile.jsonMode ? "success" : "warning"}
                  dot
                >
                  {advancedProfile.jsonMode
                    ? "Structured output preferred"
                    : "JSON mode disabled"}
                </StatusBadge>
              </div>
              {isRemoteOllama ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-800 text-xs leading-5 dark:text-amber-100">
                  Remote Ollama is not the same as localhost privacy. Verify
                  network ownership and SSRF allowlist before sending workspace
                  context.
                </div>
              ) : null}
              {needsReindex ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-800 text-xs leading-5 dark:text-amber-100">
                  Embedding model is missing locally. RAG reindex should wait
                  until{" "}
                  <span className="font-mono">
                    ollama pull {embeddingModel}
                  </span>{" "}
                  succeeds.
                </div>
              ) : null}
              {provider === "ollama" && chatModel && !chatReady ? (
                <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3 font-mono text-xs">
                  <Cluster gap="xs" className="flex-nowrap">
                    <Terminal className="size-3.5" />
                    ollama pull {chatModel}
                  </Cluster>
                </div>
              ) : null}
            </Stack>
          </div>
        </div>
      </Stack>
    </Surface>
  );
}
