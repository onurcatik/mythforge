import { Cloud, CloudOff, Cpu, RotateCw } from "lucide-react";

import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import { providerLabel } from "@/entities/ai-runtime/model";
import { formatDurationMs } from "@/shared/lib/format";
import { Cluster } from "@/shared/ui/primitives";
import { StatusBadge } from "@/shared/ui/data-display";

const modeIcon = {
  cloud: Cloud,
  local: Cpu,
  hybrid: RotateCw,
} as const;

export function RuntimeStatusBadge({ runtime }: { runtime: RuntimeHealth }) {
  const Icon = modeIcon[runtime.mode] ?? CloudOff;
  const tone = runtime.isHealthy ? (runtime.mode === "local" ? "success" : "info") : "warning";
  const provider = providerLabel[runtime.provider];

  return (
    <StatusBadge tone={tone} dot>
      <Cluster gap="xs" className="flex-nowrap">
        <Icon className="size-3.5" />
        <span>{runtime.mode === "local" ? "Local" : runtime.mode === "hybrid" ? "Hybrid" : "Cloud"}</span>
        <span className="text-current/55">/</span>
        <span>{provider}</span>
        {runtime.latencyMs ? <span className="text-current/70">{formatDurationMs(runtime.latencyMs)}</span> : null}
      </Cluster>
    </StatusBadge>
  );
}
