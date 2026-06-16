import { Activity, Bot, CheckCircle2, FileText, GitCompareArrows, Network, Search, ShieldCheck, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ApprovalPill } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommandExecuteResponse, CommandResult } from "@/hooks/useCommandCenter";
import { ActionPreviewCard, SourceCard } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { clampPercent, shortJson } from "./aiOpsUtils";

const iconForResult = (type?: CommandResult["type"]): LucideIcon => {
  if (type === "agent_plan") return GitCompareArrows;
  if (type === "assignment") return UserCheck;
  if (type === "risk_map" || type === "impact") return Network;
  if (type === "answer") return Search;
  if (type === "cleanup") return Activity;
  return Bot;
};

export function CommandResultRenderer({ execution }: { execution?: CommandExecuteResponse | null }) {
  if (!execution) {
    return (
      <Surface tone="glass" padding="lg" className="rounded-3xl border-dashed">
        <Stack gap="sm" className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div className="font-semibold tracking-[-0.02em]">Ready for an AI operation</div>
          <p className="text-muted-foreground text-sm leading-6">
            Run a command to see grounded answers, agent plans, graph impact, assignment recommendations and approval previews here.
          </p>
        </Stack>
      </Surface>
    );
  }

  const Icon = iconForResult(execution.result.type);
  const requiresApproval = Boolean(execution.approval_state && execution.approval_state !== "none" && execution.approval_state !== "not_required");

  return (
    <ScrollArea className="max-h-[48vh] rounded-3xl border bg-card/80 shadow-sm">
      <div className="space-y-5 p-5">
        <Surface tone="glass" padding="md" className="rounded-2xl">
          <Cluster justify="between" align="start" gap="md">
            <Stack gap="sm" className="min-w-0">
              <Cluster gap="xs">
                <Badge variant="secondary"><Icon className="mr-1 size-3.5" />{execution.result.type}</Badge>
                <Badge variant={execution.status === "failed" ? "destructive" : "outline"}>{execution.status}</Badge>
                <Badge variant="outline">{Math.round(execution.latency_ms)}ms</Badge>
                {requiresApproval ? <ApprovalPill>{execution.approval_state}</ApprovalPill> : null}
              </Cluster>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.035em]">{execution.result.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm leading-6">{execution.result.summary}</p>
              </div>
            </Stack>
            <div className="hidden rounded-2xl border bg-background/70 p-3 text-primary md:block">
              <Icon className="size-6" />
            </div>
          </Cluster>
        </Surface>

        {execution.safety_flags.length > 0 ? (
          <Surface tone="glass" padding="sm" className="rounded-2xl border-amber-500/20 bg-amber-500/5">
            <Cluster gap="sm" align="start">
              <ShieldCheck className="mt-0.5 size-4 text-amber-600" />
              <div className="text-sm">
                <div className="font-medium">Safety checks</div>
                <p className="text-muted-foreground text-xs leading-5">{execution.safety_flags.join(", ")}</p>
              </div>
            </Cluster>
          </Surface>
        ) : null}

        {execution.result.cards.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {execution.result.cards.map((card, index) => (
              <Surface key={`${card.title}-${index}`} tone="glass" padding="md" className="rounded-2xl">
                <Stack gap="sm">
                  <Cluster justify="between" gap="sm" align="start">
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium text-sm">{card.title}</div>
                      {card.description ? <p className="mt-1 line-clamp-3 text-muted-foreground text-xs leading-5">{card.description}</p> : null}
                    </div>
                    <Badge variant="outline">{card.kind}</Badge>
                  </Cluster>
                  {typeof card.score === "number" ? <div className="text-muted-foreground text-xs">Score {clampPercent(card.score)}</div> : null}
                  {card.link ? <a href={card.link} className="text-primary text-xs hover:underline">Open source</a> : null}
                </Stack>
              </Surface>
            ))}
          </div>
        ) : null}

        {execution.result.diff ? (
          <ActionPreviewCard
            title="Proposed change preview"
            description="Machine-readable diff returned by the backend. Write operations still require approval-first execution."
            actionType="update"
            approvalRequired
            before={<pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{shortJson((execution.result.diff as Record<string, unknown>).before ?? {})}</pre>}
            after={<pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{shortJson((execution.result.diff as Record<string, unknown>).after ?? execution.result.diff)}</pre>}
          />
        ) : null}

        {execution.result.sources.length > 0 ? (
          <Stack gap="sm">
            <Cluster justify="between">
              <div className="font-medium text-sm">Grounded sources</div>
              <Badge variant="outline">{execution.result.sources.length} sources</Badge>
            </Cluster>
            <div className="grid gap-2">
              {execution.result.sources.map((source, index) => (
                <SourceCard
                  key={`${source.source_type}-${source.source_id ?? index}`}
                  title={source.title}
                  excerpt={source.excerpt}
                  sourceType={source.source_type}
                  confidence={source.score ?? undefined}
                  href={source.link ?? undefined}
                />
              ))}
            </div>
          </Stack>
        ) : null}

        {execution.result.suggested_actions.length > 0 ? (
          <Surface tone="muted" padding="md" className="rounded-2xl">
            <Stack gap="sm">
              <div className="font-medium text-sm">Suggested next actions</div>
              {execution.result.suggested_actions.map((action) => (
                <Cluster key={action.action_id} gap="sm" className="text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span className="min-w-0 flex-1">{action.label}</span>
                  <Badge variant="outline">{action.intent}</Badge>
                  {action.requires_approval ? <ApprovalPill>approval</ApprovalPill> : null}
                </Cluster>
              ))}
            </Stack>
          </Surface>
        ) : null}

        <div className="rounded-2xl border bg-background/55 p-3 text-muted-foreground text-xs">
          Used tools: {execution.used_tools.join(", ") || "none"}
        </div>
      </div>
    </ScrollArea>
  );
}
