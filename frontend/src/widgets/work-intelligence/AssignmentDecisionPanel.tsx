import { Bot, CheckCircle2, Clock3, Loader2, ShieldCheck, UserCheck, Users, XCircle } from "lucide-react";
import { toast } from "robot-toast";

import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { SectionHeader } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApplyAssignment, useAssignmentCapacity, useRecommendAssignment, useRejectAssignment, useTaskAssignments, type AssignmentRecommendation } from "@/hooks/useAssignments";
import { cn } from "@/lib/utils";
import { hours, percent, toneClass } from "./WorkIntelligenceUtils";

type AssignmentDecisionPanelProps = {
  taskId?: number | null;
  projectId?: number | null;
  compact?: boolean;
};

function ScorePill({ label, value }: { label: string; value: unknown }) {
  const numeric = typeof value === "number" ? value : 0;
  return <div className="rounded-full border bg-background/60 px-2.5 py-1 text-xs"><span className="text-muted-foreground">{label}</span> {percent(numeric)}</div>;
}

function RecommendationRow({ item, onApply, onReject, pending }: { item: AssignmentRecommendation; onApply: (id: number) => void; onReject: (id: number) => void; pending: boolean }) {
  const breakdown = item.score_breakdown ?? {};
  const scoreTone = item.confidence >= 0.78 ? "low" : item.confidence >= 0.55 ? "medium" : "high";
  return (
    <div className="rounded-2xl border bg-card/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary"><UserCheck className="size-4" /></div>
            <div>
              <div className="truncate text-sm font-semibold">{item.recommended_user_name ?? `User #${item.recommended_user_id}`}</div>
              <div className="text-muted-foreground text-xs">{item.mode} · {item.policy_decision}</div>
            </div>
          </div>
          <p className="mt-3 text-muted-foreground text-xs leading-5">{item.reasoning}</p>
        </div>
        <div className="text-right">
          <div className={cn("rounded-full border px-2 py-1 text-xs font-medium", toneClass(scoreTone))}>{percent(item.confidence)}</div>
          <div className="mt-1 text-muted-foreground text-xs">score {percent(item.score)}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ScorePill label="skill" value={breakdown.skill_match} />
        <ScorePill label="capacity" value={breakdown.workload_balance} />
        <ScorePill label="deadline" value={breakdown.deadline_feasibility} />
        <ScorePill label="timezone" value={breakdown.timezone_fit} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" disabled={!item.id || pending} onClick={() => item.id && onApply(item.id)}><CheckCircle2 className="size-4" /> Apply</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={!item.id || pending} onClick={() => item.id && onReject(item.id)}><XCircle className="size-4" /> Reject</Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => getOpenAICommandCenter()?.(`Bu assignment önerisini Work Graph etkisi, kapasite ve deadline açısından açıkla: task ${item.task_id}`)}><Bot className="size-4" /> Explain</Button>
      </div>
    </div>
  );
}

export function AssignmentDecisionPanel({ taskId, projectId, compact = false }: AssignmentDecisionPanelProps) {
  const recommend = useRecommendAssignment();
  const apply = useApplyAssignment();
  const reject = useRejectAssignment();
  const existing = useTaskAssignments(taskId, Boolean(taskId));
  const capacity = useAssignmentCapacity(true);
  const recommendations = recommend.data?.candidates?.length ? recommend.data.candidates : existing.data ?? [];

  const runRecommend = () => {
    if (!taskId) {
      getOpenAICommandCenter()?.("Bu project için açık görevleri kapasite, skill, timezone ve Work Graph riskine göre kime atamalıyız?");
      return;
    }
    recommend.mutate({ task_id: taskId, force_refresh: true, auto_apply: false, confidence_threshold: 0.72 }, { onError: () => toast.error("Assignment recommendation failed") });
  };

  const applyRecommendation = (recommendationId: number) => {
    apply.mutate({ recommendation_id: recommendationId }, { onSuccess: (payload) => toast.success(payload.requires_approval ? "Agent approval required" : "Assignment applied"), onError: () => toast.error("Assignment could not be applied") });
  };

  const rejectRecommendation = (recommendationId: number) => {
    reject.mutate({ recommendation_id: recommendationId, reason: "Rejected from phase 6 assignment panel" }, { onSuccess: () => toast.success("Recommendation rejected"), onError: () => toast.error("Recommendation could not be rejected") });
  };

  const capacityItems = capacity.data?.items ?? [];
  const overloaded = capacityItems.filter((item) => item.overdue_task_count > 0 || item.deadline_pressure_count > 2).slice(0, 4);

  return (
    <section className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
      <SectionHeader
        eyebrow="Phase 6 · Assignment intelligence"
        title={taskId ? "AI assignment decision panel" : "Capacity & assignment map"}
        description="Score assignees by capacity, skill fit, deadline feasibility, timezone overlap and graph impact while keeping write actions approval-safe."
        action={<Badge variant="outline">{projectId ? `Project #${projectId}` : "Workspace scope"}</Badge>}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="rounded-full" onClick={runRecommend} disabled={recommend.isPending}>
          {recommend.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
          {taskId ? "Recommend assignee" : "Ask AI for assignments"}
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => getOpenAICommandCenter()?.(taskId ? `Bu görevi kime atayalım? Task ID: ${taskId}` : "Bu proje için kapasite ve assignment risklerini göster.")}>
          <Bot className="size-4" /> Agent view
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><UserCheck className="size-4" /> Recommendations</div>
          <ScrollArea className={compact ? "max-h-80 pr-3" : "max-h-[28rem] pr-3"}>
            <div className="space-y-3">
              {recommendations.length > 0 ? recommendations.map((item) => (
                <RecommendationRow key={`${item.id ?? item.recommended_user_id}-${item.task_id}`} item={item} onApply={applyRecommendation} onReject={rejectRecommendation} pending={apply.isPending || reject.isPending} />
              )) : (
                <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">No assignment recommendation loaded yet. Run a recommendation or open a task with assignment history.</div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Users className="size-4" /> Capacity snapshot</div>
            <div className="space-y-2">
              {capacityItems.slice(0, 6).map((item) => (
                <div key={item.user_id} className="rounded-2xl border bg-card/70 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.user_name ?? `User #${item.user_id}`}</span>
                    <Badge variant="outline">{item.role}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-muted-foreground">
                    <span>active {item.active_task_count}</span>
                    <span>overdue {item.overdue_task_count}</span>
                    <span>{hours(item.estimated_effort_minutes)}</span>
                  </div>
                </div>
              ))}
              {capacityItems.length === 0 ? <div className="rounded-2xl border border-dashed p-4 text-muted-foreground text-xs">Capacity data unavailable.</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><ShieldCheck className="size-4" /> Fairness-safe display</div>
            Raw performance data is not exposed; users see fit categories, capacity pressure and approval-safe decisions.
          </div>
          {overloaded.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
              <Clock3 className="mr-1 inline size-3" /> {overloaded.length} operators show deadline or overdue pressure.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
