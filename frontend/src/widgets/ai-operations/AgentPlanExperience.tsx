import { CheckCircle2, GitCompareArrows, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AgentExecuteResponse, AgentPlanResponse, AgentPlanStep } from "@/hooks/useAgentOrchestrator";
import { ActionPreviewCard } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { clampPercent, shortJson } from "./aiOpsUtils";

const toneForStep = (status: AgentPlanStep["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "executed") return "default";
  if (status === "failed") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
};

export function AgentPlanSummary({ plan }: { plan?: AgentPlanResponse | null }) {
  if (!plan) {
    return (
      <Surface tone="glass" padding="lg" className="rounded-3xl border-dashed">
        <Stack gap="sm" className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GitCompareArrows className="size-5" />
          </div>
          <div className="font-semibold tracking-[-0.02em]">Create an approval-first plan</div>
          <p className="text-muted-foreground text-sm leading-6">Agent plans will show assumptions, risks, proposed changes, approvals and rollback state.</p>
        </Stack>
      </Surface>
    );
  }

  return (
    <Stack gap="md">
      <div className="grid gap-2 md:grid-cols-4">
        <Surface tone="glass" padding="sm" className="rounded-2xl"><div className="text-muted-foreground text-xs">Confidence</div><div className="mt-1 text-lg font-semibold">{clampPercent(plan.confidence)}</div></Surface>
        <Surface tone="glass" padding="sm" className="rounded-2xl"><div className="text-muted-foreground text-xs">Status</div><div className="mt-1 text-lg font-semibold">{plan.status}</div></Surface>
        <Surface tone="glass" padding="sm" className="rounded-2xl"><div className="text-muted-foreground text-xs">Steps</div><div className="mt-1 text-lg font-semibold">{plan.steps.length}</div></Surface>
        <Surface tone="glass" padding="sm" className="rounded-2xl"><div className="text-muted-foreground text-xs">Context</div><div className="mt-1 text-lg font-semibold">{plan.context_summary.length}</div></Surface>
      </div>

      <ActionPreviewCard title="Plan diff summary" description={plan.diff_summary} actionType="approve" approvalRequired />

      {plan.assumptions.length > 0 ? (
        <Surface tone="glass" padding="md" className="rounded-2xl">
          <Stack gap="sm">
            <Cluster gap="sm"><ShieldCheck className="size-4 text-primary" /><div className="font-medium text-sm">Assumptions</div></Cluster>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              {plan.assumptions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Stack>
        </Surface>
      ) : null}

      {plan.risks.length > 0 ? (
        <Surface tone="glass" padding="md" className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <Stack gap="sm">
            <Cluster gap="sm"><TriangleAlert className="size-4 text-amber-600" /><div className="font-medium text-sm">Plan risks</div></Cluster>
            <div className="grid gap-2">
              {plan.risks.map((risk) => (
                <div key={`${risk.severity}-${risk.title}`} className="rounded-2xl border bg-background/60 p-3 text-sm">
                  <Cluster gap="xs"><Badge variant={risk.severity === "high" ? "destructive" : "outline"}>{risk.severity}</Badge><span className="font-medium">{risk.title}</span></Cluster>
                  <p className="mt-1 text-muted-foreground text-xs leading-5">{risk.mitigation}</p>
                </div>
              ))}
            </div>
          </Stack>
        </Surface>
      ) : null}
    </Stack>
  );
}

type AgentStepListProps = {
  steps: AgentPlanStep[];
  selectedStepIds: number[];
  onToggleStep: (stepId: number) => void;
};

export function AgentStepList({ steps, selectedStepIds, onToggleStep }: AgentStepListProps) {
  if (steps.length === 0) return null;
  return (
    <Stack gap="sm">
      <Cluster justify="between">
        <div className="font-medium text-sm">Approval steps</div>
        <Badge variant="outline">{selectedStepIds.length} selected</Badge>
      </Cluster>
      {steps.map((step) => (
        <label key={step.id} className="grid gap-3 rounded-2xl border bg-card/75 p-4 text-sm shadow-sm md:grid-cols-[auto_1fr]">
          <input
            type="checkbox"
            className="mt-1"
            checked={selectedStepIds.includes(step.id)}
            onChange={() => onToggleStep(step.id)}
            disabled={["executed", "rolled_back", "skipped"].includes(step.status)}
          />
          <Stack gap="sm" className="min-w-0">
            <Cluster gap="xs">
              <Badge variant={toneForStep(step.status)}>{step.status}</Badge>
              <Badge variant="outline">{step.action}</Badge>
              <span className="font-medium">{step.title}</span>
            </Cluster>
            <p className="text-muted-foreground text-sm leading-6">{step.summary}</p>
            <p className="text-muted-foreground text-xs leading-5">{step.rationale}</p>
            {Object.keys(step.diff ?? {}).length > 0 ? (
              <details className="rounded-xl border bg-background/60 p-3">
                <summary className="cursor-pointer text-xs font-medium">View structured diff</summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs">{shortJson(step.diff)}</pre>
              </details>
            ) : null}
            {step.error ? <p className="text-destructive text-xs">{step.error}</p> : null}
          </Stack>
        </label>
      ))}
    </Stack>
  );
}

export function AgentExecutionResult({ execution }: { execution?: AgentExecuteResponse | null }) {
  if (!execution) return null;
  return (
    <Surface tone="glass" padding="md" className="rounded-2xl">
      <Stack gap="sm">
        <Cluster gap="sm"><CheckCircle2 className="size-4 text-primary" /><div className="font-medium text-sm">Execution result</div></Cluster>
        <p className="text-muted-foreground text-sm">{execution.executed.length} executed · {execution.skipped.length} skipped · rollback {execution.rollback_available ? "available" : "not available"}</p>
        {execution.executed.length > 0 ? (
          <div className="grid gap-2">
            {execution.executed.map((item) => (
              <div key={item.step_id} className="rounded-xl border bg-background/60 p-3 text-sm">
                {item.link ? <a href={item.link} className="font-medium text-primary hover:underline">{item.entity_type} #{item.entity_id}</a> : <span className="font-medium">{item.entity_type} #{item.entity_id ?? item.step_id}</span>}
                {item.error ? <p className="mt-1 text-destructive text-xs">{item.error}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </Stack>
    </Surface>
  );
}
