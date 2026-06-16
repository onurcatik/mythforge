import { Bot, Braces, Cpu, FileSearch, RadioTower } from "lucide-react";

import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import { providerLabel } from "@/entities/ai-runtime/model";
import { MetricCard } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { StatusBadge } from "@/shared/ui/data-display";
import { RuntimeStatusBadge } from "./RuntimeStatusBadge";

type RuntimeCapabilityCardProps = {
  runtime: RuntimeHealth;
};

export function RuntimeCapabilityCard({ runtime }: RuntimeCapabilityCardProps) {
  return (
    <Surface tone="glass" padding="lg">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <div className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.2em]">Active AI runtime</div>
            <h3 className="font-semibold text-xl tracking-[-0.03em]">{runtime.label || providerLabel[runtime.provider]}</h3>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
              Runtime state is displayed independently from the old frontend and can be reused by RAG, Agent, Assignment and Command Center screens.
            </p>
          </Stack>
          <RuntimeStatusBadge runtime={runtime} />
        </Cluster>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Bot} label="Chat model" value={runtime.chatModel ?? "Not set"} tone="ai" />
          <MetricCard icon={FileSearch} label="Embedding" value={runtime.embeddingModel ?? "Not set"} tone="info" />
          <MetricCard icon={Cpu} label="Mode" value={runtime.localOnly ? "Local only" : runtime.mode} tone={runtime.localOnly ? "success" : "neutral"} />
          <MetricCard icon={RadioTower} label="Health" value={runtime.isHealthy ? "Online" : "Check"} tone={runtime.isHealthy ? "success" : "warning"} />
        </div>
        <Cluster gap="sm">
          <StatusBadge tone="ai"><Braces className="mr-1 size-3" />JSON-ready</StatusBadge>
          <StatusBadge tone="info">Streaming-aware</StatusBadge>
          <StatusBadge tone={runtime.localOnly ? "success" : "neutral"}>{runtime.localOnly ? "Cloud blocked" : "Fallback configurable"}</StatusBadge>
        </Cluster>
      </Stack>
    </Surface>
  );
}
