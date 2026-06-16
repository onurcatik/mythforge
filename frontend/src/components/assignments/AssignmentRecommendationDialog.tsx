import { Loader2, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "robot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApplyAssignment, useAssignmentCapacity, useRecommendAssignment, useRejectAssignment, type AssignmentRecommendation } from "@/hooks/useAssignments";

const pct = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const safeNumber = (value: unknown) => (typeof value === "number" ? value : 0);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTaskId?: number | null;
};

function RecommendationCard({ item, onApply, onReject, pending }: { item: AssignmentRecommendation; onApply: (id: number) => void; onReject: (id: number) => void; pending: boolean }) {
  const breakdown = item.score_breakdown ?? {};
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{item.recommended_user_name ?? `User #${item.recommended_user_id}`}</div>
          <div className="mt-1 text-xs text-muted-foreground">{item.reasoning}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>score {pct(item.score)}</div>
          <div>confidence {pct(item.confidence)}</div>
          <div>{item.mode}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
        <div className="rounded bg-muted px-2 py-1">skill {pct(safeNumber(breakdown.skill_match))}</div>
        <div className="rounded bg-muted px-2 py-1">load {pct(safeNumber(breakdown.workload_balance))}</div>
        <div className="rounded bg-muted px-2 py-1">deadline {pct(safeNumber(breakdown.deadline_feasibility))}</div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => item.id && onApply(item.id)} disabled={!item.id || pending}>Apply</Button>
        <Button size="sm" variant="outline" onClick={() => item.id && onReject(item.id)} disabled={!item.id || pending}>Reject</Button>
      </div>
    </div>
  );
}

export function AssignmentRecommendationDialog({ open, onOpenChange, initialTaskId }: Props) {
  const [taskId, setTaskId] = useState(initialTaskId ? String(initialTaskId) : "");
  const recommend = useRecommendAssignment();
  const apply = useApplyAssignment();
  const reject = useRejectAssignment();
  const capacity = useAssignmentCapacity(open);
  const taskIdNumber = Number(taskId);

  const runRecommend = () => {
    if (!Number.isFinite(taskIdNumber) || taskIdNumber <= 0) return;
    recommend.mutate({ task_id: taskIdNumber, auto_apply: false, confidence_threshold: 0.72 });
  };

  const applyRecommendation = (recommendationId: number) => {
    apply.mutate(
      { recommendation_id: recommendationId },
      {
        onSuccess: (payload) => {
          toast.success(payload.requires_approval ? "Agent approval required before assignment" : "Assignment applied");
          void recommend.mutate({ task_id: taskIdNumber, auto_apply: false, confidence_threshold: 0.72 });
        },
        onError: () => toast.error("Assignment could not be applied"),
      }
    );
  };

  const rejectRecommendation = (recommendationId: number) => {
    reject.mutate(
      { recommendation_id: recommendationId, reason: "Rejected from assignment panel" },
      { onSuccess: () => toast.success("Recommendation rejected"), onError: () => toast.error("Recommendation could not be rejected") }
    );
  };

  const candidates = recommend.data?.candidates ?? [];
  const capacityItems = capacity.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="size-5" /> AI Assignment</DialogTitle>
          <DialogDescription>Recommend the best assignee from capacity, workload, skill, timezone, history and Work Graph risk.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="Task ID" inputMode="numeric" />
            <Button onClick={runRecommend} disabled={recommend.isPending || !Number.isFinite(taskIdNumber) || taskIdNumber <= 0}>
              {recommend.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Recommend
            </Button>
          </div>

          {recommend.error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Recommendation failed.</div>}

          <ScrollArea className="max-h-[52vh] rounded-md border">
            <div className="space-y-3 p-3">
              {candidates.length > 0 ? candidates.map((item) => (
                <RecommendationCard key={`${item.recommended_user_id}-${item.score}`} item={item} onApply={applyRecommendation} onReject={rejectRecommendation} pending={apply.isPending || reject.isPending} />
              )) : (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No recommendation yet.</div>
              )}
            </div>
          </ScrollArea>

          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Users className="size-4" /> Capacity snapshot</div>
            <div className="grid gap-2 text-xs md:grid-cols-2">
              {capacityItems.slice(0, 6).map((item) => (
                <div key={item.user_id} className="rounded bg-muted px-2 py-1">
                  {item.user_name ?? `User #${item.user_id}`} · active {item.active_task_count} · overdue {item.overdue_task_count} · effort {Math.round(item.estimated_effort_minutes / 60)}h
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
