import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import type { AIProvider } from "@/api/generated/initiativeAPI.schemas";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { providerLabel } from "@/entities/ai-runtime/model";

type RuntimeReadinessLaunchCardProps = {
  provider?: AIProvider | null;
  chatModel?: string | null;
  embeddingModel?: string | null;
  localOnly?: boolean | null;
  settingsHref: string;
  loading?: boolean;
};

export function RuntimeReadinessLaunchCard({
  provider,
  chatModel,
  embeddingModel,
  localOnly,
  settingsHref,
  loading,
}: RuntimeReadinessLaunchCardProps) {
  const effectiveProvider = provider ?? null;
  const local = Boolean(localOnly) || effectiveProvider === "ollama";
  const ProviderIcon = local ? Cpu : effectiveProvider ? Cloud : WifiOff;
  const label = effectiveProvider
    ? providerLabel[effectiveProvider]
    : "Not configured";

  return (
    <Surface padding="lg" tone={local ? "ai" : "glass"}>
      <Stack gap="lg">
        <Cluster justify="between" align="start" className="flex-nowrap">
          <Stack gap="xs" className="min-w-0">
            <Cluster gap="xs">
              <StatusBadge
                tone={
                  local ? "success" : effectiveProvider ? "info" : "warning"
                }
                dot
              >
                <ProviderIcon className="mr-1 size-3" />
                {local
                  ? "Local AI ready"
                  : effectiveProvider
                    ? "Cloud runtime"
                    : "Runtime missing"}
              </StatusBadge>
              {localOnly ? (
                <StatusBadge tone="success">
                  <ShieldCheck className="mr-1 size-3" />
                  Cloud blocked
                </StatusBadge>
              ) : null}
            </Cluster>
            <h2 className="font-semibold text-xl tracking-[-0.03em]">
              AI runtime readiness
            </h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
              Make OpenAI, Anthropic, Ollama, custom endpoints and Local AI Mode
              visible before users launch RAG, Agent or Assignment flows.
            </p>
          </Stack>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
            <ProviderIcon className="size-5" />
          </div>
        </Cluster>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
            <p className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.16em]">
              Provider
            </p>
            <p className="mt-1 truncate font-medium text-sm">
              {loading ? "Loading..." : label}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
            <p className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.16em]">
              Chat
            </p>
            <p className="mt-1 truncate font-medium text-sm">
              {chatModel || "Not set"}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
            <p className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.16em]">
              Embedding
            </p>
            <p className="mt-1 truncate font-medium text-sm">
              {embeddingModel || "Not set"}
            </p>
          </div>
        </div>

        <Cluster justify="between" gap="sm">
          <Cluster
            gap="xs"
            className="text-[color:var(--ifx-text-secondary)] text-xs"
          >
            <CheckCircle2 className="size-3.5 text-emerald-500" /> RAG, Agent,
            Command Center and Assignment use this runtime policy.
          </Cluster>
          <Link
            to={settingsHref}
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 font-medium text-sm text-violet-700 transition hover:-translate-y-0.5 hover:bg-violet-500/15 dark:text-violet-200"
          >
            Configure runtime <ArrowRight className="size-4" />
          </Link>
        </Cluster>
      </Stack>
    </Surface>
  );
}
