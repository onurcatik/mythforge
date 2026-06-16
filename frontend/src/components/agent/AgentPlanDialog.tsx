import { Bot, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "robot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useAgentSession,
  useApproveAgentPlan,
  useCreateAgentPlan,
  useExecuteAgentPlan,
  useRejectAgentPlan,
  useRollbackAgentPlan,
  type AgentPlanResponse,
  type AgentPlanStep,
} from "@/hooks/useAgentOrchestrator";
import { AgentExecutionResult, AgentPlanSummary, AgentStepList } from "@/widgets/ai-operations";

type AgentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AgentPlanDialog({ open, onOpenChange }: AgentPlanDialogProps) {
  const { t } = useTranslation(["command", "common"]);
  const [goal, setGoal] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [selectedStepIds, setSelectedStepIds] = useState<number[]>([]);
  const createPlan = useCreateAgentPlan();
  const approvePlan = useApproveAgentPlan();
  const executePlan = useExecuteAgentPlan();
  const rejectPlan = useRejectAgentPlan();
  const rollbackPlan = useRollbackAgentPlan();
  const sessionQuery = useAgentSession(sessionId, open && !!sessionId);

  const plan: AgentPlanResponse | undefined = sessionQuery.data ?? createPlan.data;
  const selectableSteps = plan?.steps.filter((step) => ["proposed", "approved", "executed", "failed"].includes(step.status)) ?? [];
  const proposedOrApproved = selectableSteps.filter((step) => ["proposed", "approved"].includes(step.status));
  const selectedApprovedCount = plan?.steps.filter((step) => selectedStepIds.includes(step.id) && step.status === "approved").length ?? 0;
  const selectedProposedCount = plan?.steps.filter((step) => selectedStepIds.includes(step.id) && step.status === "proposed").length ?? 0;

  const executionSummary = executePlan.data;
  const canSubmitGoal = goal.trim().length >= 3 && !createPlan.isPending;
  const canApprove = !!plan && selectedProposedCount > 0 && !approvePlan.isPending;
  const canExecute = !!plan && selectedApprovedCount > 0 && !executePlan.isPending;
  const canRollback = !!executionSummary?.rollback_available && !rollbackPlan.isPending;

  useEffect(() => {
    if (!open) {
      setGoal("");
      setSessionId(null);
      setSelectedStepIds([]);
      createPlan.reset();
      approvePlan.reset();
      executePlan.reset();
      rejectPlan.reset();
      rollbackPlan.reset();
    }
  }, [open]);

  useEffect(() => {
    if (createPlan.data?.session_id) {
      setSessionId(createPlan.data.session_id);
      setSelectedStepIds(createPlan.data.steps.map((step) => step.id).filter(Boolean));
    }
  }, [createPlan.data]);

  useEffect(() => {
    if (sessionQuery.data) {
      const existing = new Set(selectedStepIds);
      const defaultIds = sessionQuery.data.steps
        .filter((step) => ["proposed", "approved"].includes(step.status) && (existing.size === 0 || existing.has(step.id)))
        .map((step) => step.id);
      setSelectedStepIds(defaultIds);
    }
  }, [sessionQuery.data]);

  const toggleStep = (stepId: number) => {
    setSelectedStepIds((current) => (current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId]));
  };

  const create = () => {
    const trimmed = goal.trim();
    if (trimmed.length < 3) return;
    createPlan.mutate(
      { goal: trimmed, max_steps: 24 },
      {
        onError: () => toast.error(t("agent.planFailed")),
      }
    );
  };

  const approve = () => {
    if (!plan) return;
    approvePlan.mutate(
      { session_id: plan.session_id, step_ids: selectedStepIds, expected_plan_version: plan.plan_version },
      {
        onSuccess: () => {
          toast.success(t("agent.approved"));
          void sessionQuery.refetch();
        },
        onError: () => toast.error(t("agent.approvalFailed")),
      }
    );
  };

  const execute = () => {
    if (!plan) return;
    executePlan.mutate(
      { session_id: plan.session_id, step_ids: selectedStepIds, expected_plan_version: plan.plan_version },
      {
        onSuccess: () => {
          toast.success(t("agent.executed"));
          void sessionQuery.refetch();
        },
        onError: () => toast.error(t("agent.executeFailed")),
      }
    );
  };

  const reject = () => {
    if (!plan) return;
    rejectPlan.mutate(
      { session_id: plan.session_id, expected_plan_version: plan.plan_version, reason: "Rejected from Command Center" },
      {
        onSuccess: () => {
          toast.success(t("agent.rejected"));
          void sessionQuery.refetch();
        },
        onError: () => toast.error(t("agent.rejectFailed")),
      }
    );
  };

  const rollback = () => {
    if (!plan) return;
    rollbackPlan.mutate(
      { session_id: plan.session_id, reason: "Rollback requested from Command Center" },
      {
        onSuccess: () => {
          toast.success(t("agent.rolledBack"));
          void sessionQuery.refetch();
        },
        onError: () => toast.error(t("agent.rollbackFailed")),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-grid-bg max-h-[92vh] max-w-7xl overflow-hidden border-primary/10 p-0 shadow-2xl">
        <div className="grid max-h-[92vh] min-h-[74vh] lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
          <section className="border-r bg-background/82 p-5 backdrop-blur-xl md:p-6">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Agent planner</Badge>
                <Badge variant="outline">approval-first</Badge>
                <Badge variant="outline">rollback-aware</Badge>
              </div>
              <DialogTitle className="mt-3 flex items-center gap-3 text-3xl tracking-[-0.04em]">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ai-ring"><Bot className="size-5" /></span>
                {t("agent.title")}
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-6">{t("agent.description")}</DialogDescription>
            </DialogHeader>

            <div className="mt-5 rounded-2xl border bg-card/75 px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><span>{t("agent.safety")}</span></div>
            </div>

            <div className="mt-4 rounded-3xl border bg-card/85 p-3 shadow-sm">
              <Textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder={t("agent.placeholder")}
                className="min-h-36 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    create();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="text-muted-foreground text-xs">Cmd/Ctrl + Enter to create a plan · write steps require approval</div>
                <Button onClick={create} disabled={!canSubmitGoal}>
                  {createPlan.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t("agent.createPlan")}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedStepIds(proposedOrApproved.map((step) => step.id))} disabled={!plan}>
                {t("agent.selectWritable")}
              </Button>
              <Button variant="outline" onClick={approve} disabled={!canApprove}>
                {approvePlan.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("agent.approveSelected")}
              </Button>
              <Button onClick={execute} disabled={!canExecute}>
                {executePlan.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("agent.executeApproved")}
              </Button>
              <Button variant="outline" onClick={reject} disabled={!plan || rejectPlan.isPending}>
                <XCircle className="mr-2 size-4" />
                {t("agent.reject")}
              </Button>
              <Button variant="outline" onClick={rollback} disabled={!canRollback}>
                <RotateCcw className="mr-2 size-4" />
                {t("agent.rollback")}
              </Button>
            </div>

            {createPlan.error && <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{t("agent.planFailed")}</div>}
          </section>

          <section className="min-h-0 bg-card/72 p-5 backdrop-blur-xl md:p-6">
            <ScrollArea className="h-[80vh] pr-3">
              <div className="space-y-4">
                <AgentPlanSummary plan={plan} />
                {plan ? <AgentStepList steps={plan.steps} selectedStepIds={selectedStepIds} onToggleStep={toggleStep} /> : null}
                <AgentExecutionResult execution={executionSummary} />
              </div>
            </ScrollArea>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
