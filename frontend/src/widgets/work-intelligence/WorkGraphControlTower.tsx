import {
  Activity,
  AlertTriangle,
  GitBranch,
  Loader2,
  Network,
  PlayCircle,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "robot-toast";

import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { OperationCard, SectionHeader } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useRebuildWorkGraph,
  useWorkGraphHealth,
  useWorkGraphRiskMap,
} from "@/hooks/useWorkGraph";
import { cn } from "@/lib/utils";
import { percent, riskTone, toneClass } from "./WorkIntelligenceUtils";

type WorkGraphControlTowerProps = {
  projectId?: number | null;
  initiativeId?: number | null;
  onOpenImpact?: () => void;
};

function CompactMetric({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "low" | "medium" | "high" | "critical" | "neutral" | "ai";
}) {
  return (
    <div className={cn("rounded-2xl border p-4", toneClass(tone))}>
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
        {value}
      </div>
      {helper ? (
        <div className="mt-1 text-xs leading-5 opacity-75">{helper}</div>
      ) : null}
    </div>
  );
}

export function WorkGraphControlTower({
  projectId,
  initiativeId,
  onOpenImpact,
}: WorkGraphControlTowerProps) {
  const health = useWorkGraphHealth(true);
  const risk = useWorkGraphRiskMap(
    {
      project_id: projectId ?? undefined,
      initiative_id: initiativeId ?? undefined,
      limit: 12,
    },
    true,
  );
  const rebuild = useRebuildWorkGraph();
  const topRisk = risk.data?.items?.[0];
  const openBlockers = health.data?.open_blockers ?? 0;
  const dependencies = health.data?.dependencies ?? 0;
  const graphStatus = health.data?.status ?? "degraded";

  const runRebuild = () => {
    rebuild.mutate(
      {
        project_id: projectId ?? undefined,
        initiative_id: initiativeId ?? undefined,
        dry_run: false,
      },
      {
        onSuccess: (payload) => {
          const message =
            "message" in payload
              ? payload.message
              : "Work Graph rebuild queued";
          toast.success(message ?? "Work Graph rebuild queued");
        },
        onError: () => toast.error("Work Graph rebuild could not be started"),
      },
    );
  };

  return (
    <section className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
      <SectionHeader
        eyebrow="Phase 6 · Work Graph intelligence"
        title="Delivery dependency control tower"
        description="Analyze critical paths, blocker propagation, blast radius and rebuild status without exposing permission-restricted graph data."
        action={
          <Badge variant="outline">
            {graphStatus === "ok" ? "Graph healthy" : "Graph degraded"}
          </Badge>
        }
      />

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CompactMetric
          label="Graph nodes"
          value={health.data?.nodes ?? "—"}
          helper="Permission-safe entity map"
          tone="ai"
        />
        <CompactMetric
          label="Edges"
          value={health.data?.edges ?? "—"}
          helper={`${dependencies} dependency links`}
        />
        <CompactMetric
          label="Open blockers"
          value={openBlockers}
          helper="Unresolved propagation risks"
          tone={openBlockers > 0 ? "high" : "low"}
        />
        <CompactMetric
          label="Top risk"
          value={topRisk ? percent(topRisk.score) : "—"}
          helper={topRisk?.node.label ?? "No risk node loaded"}
          tone={topRisk ? riskTone(topRisk.score) : "neutral"}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-2xl border bg-background/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Radar className="size-4" /> Risk map
              </div>
              <p className="text-muted-foreground text-xs">
                Top graph risks ranked by dependency depth, blocker pressure and
                deadline exposure.
              </p>
            </div>
            {risk.isFetching ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <ScrollArea className="max-h-80 pr-3">
            <div className="space-y-2">
              {(risk.data?.items ?? []).length > 0 ? (
                (risk.data?.items ?? []).map((item) => (
                  <a
                    key={`${item.node.entity_type}-${item.node.entity_id}-${item.score}`}
                    href={item.node.link ?? undefined}
                    className="group grid gap-3 rounded-2xl border bg-card/70 p-3 transition hover:border-primary/30 hover:bg-primary/5 md:grid-cols-[minmax(0,1fr)_7rem]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {item.node.entity_type}
                        </Badge>
                        <span className="truncate text-sm font-medium">
                          {item.node.label}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground text-xs">
                        {item.node.status ?? "unknown status"} ·{" "}
                        {item.node.priority ?? "normal priority"} · #
                        {item.node.entity_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "rounded-full border px-2 py-1 text-xs font-medium capitalize",
                          toneClass(item.level),
                        )}
                      >
                        {item.level}
                      </div>
                      <div className="mt-1 text-muted-foreground text-xs">
                        {percent(item.score)}
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                  No risk map available yet. Rebuild the graph or create
                  dependencies/blockers to generate impact signals.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-3">
          <OperationCard
            icon={Network}
            title="Impact mode"
            description="Open a scope-limited graph analysis for a task or project before the schedule slips."
            cta="Analyze"
            onClick={onOpenImpact}
          />
          <OperationCard
            icon={GitBranch}
            title="Critical path"
            description="Ask AI to explain the most fragile downstream delivery chain."
            cta="Explain"
            onClick={() =>
              getOpenAICommandCenter()?.(
                "Bu workspace için critical path, blast radius ve blocker propagation risklerini açıkla.",
              )
            }
          />
          <OperationCard
            icon={Sparkles}
            title="Replan with agent"
            description="Send graph risks to the approval-first planning flow."
            cta="Plan"
            onClick={() =>
              getOpenAICommandCenter()?.(
                "Work Graph risk haritasına göre güvenli yeniden planlama önerisi oluştur.",
              )
            }
          />
          <Button
            className="w-full rounded-2xl"
            variant="outline"
            onClick={runRebuild}
            disabled={rebuild.isPending}
          >
            {rebuild.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Rebuild graph
          </Button>
          <div className="rounded-2xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4" /> Permission-safe graph
            </div>
            Node labels, counts and impact links are scoped by the backend
            permission/RLS contract; this panel does not infer hidden graph
            state.
          </div>
          {health.isError ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 text-xs dark:text-amber-300">
              <AlertTriangle className="mr-1 inline size-3" /> Graph health
              endpoint is unavailable.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
