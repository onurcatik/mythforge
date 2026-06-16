import { AlertTriangle, CheckCircle2, GitBranch, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "robot-toast";

import { SectionHeader } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBlocker, useCreateDependency, useDeleteDependency, useResolveBlocker, useTaskBlockers, useTaskDependencies, type TaskBlocker } from "@/hooks/useDependenciesBlockers";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { toneClass } from "./WorkIntelligenceUtils";

type DependencyBlockerStudioProps = {
  taskId: number;
  readOnly?: boolean;
};

const severityTone = (severity: TaskBlocker["severity"]) => severity === "critical" ? "critical" : severity === "high" ? "high" : severity === "medium" ? "medium" : "low";

export function DependencyBlockerStudio({ taskId, readOnly = false }: DependencyBlockerStudioProps) {
  const dependencies = useTaskDependencies(taskId, true);
  const blockers = useTaskBlockers(taskId, true);
  const createDependency = useCreateDependency();
  const deleteDependency = useDeleteDependency();
  const createBlocker = useCreateBlocker();
  const resolveBlocker = useResolveBlocker();
  const [targetTaskId, setTargetTaskId] = useState("");
  const [lagHours, setLagHours] = useState("0");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState<TaskBlocker["severity"]>("medium");
  const [resolutionNote, setResolutionNote] = useState("Resolved from Work Intelligence studio");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["dependencies", "task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["blockers", "task", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["work-graph"] });
  };

  const submitDependency = () => {
    const target = Number(targetTaskId);
    const lag = Number(lagHours);
    if (!Number.isFinite(target) || target <= 0 || target === taskId) {
      toast.error("Enter a valid different target task ID");
      return;
    }
    createDependency.mutate({ source_task_id: taskId, target_task_id: target, lag_minutes: Number.isFinite(lag) ? lag * 60 : 0 }, {
      onSuccess: () => {
        toast.success("Dependency created");
        setTargetTaskId("");
        invalidate();
      },
      onError: () => toast.error("Dependency could not be created; cycle detection may have blocked it"),
    });
  };

  const submitBlocker = () => {
    if (!blockerTitle.trim()) {
      toast.error("Blocker title is required");
      return;
    }
    createBlocker.mutate({ task_id: taskId, title: blockerTitle.trim(), reason: blockerReason.trim() || null, severity: blockerSeverity }, {
      onSuccess: () => {
        toast.success("Blocker created");
        setBlockerTitle("");
        setBlockerReason("");
        invalidate();
      },
      onError: () => toast.error("Blocker could not be created"),
    });
  };

  const removeDependency = (dependencyId: number) => {
    deleteDependency.mutate(dependencyId, { onSuccess: () => { toast.success("Dependency deleted"); invalidate(); }, onError: () => toast.error("Dependency could not be deleted") });
  };

  const resolve = (blockerId: number) => {
    resolveBlocker.mutate({ blocker_id: blockerId, resolution_note: resolutionNote || null }, { onSuccess: () => { toast.success("Blocker resolved"); invalidate(); }, onError: () => toast.error("Blocker could not be resolved") });
  };

  const blockerItems = blockers.data?.items ?? [];
  const dependencyItems = dependencies.data?.items ?? [];

  return (
    <section className="premium-card rounded-3xl border bg-card/80 p-5 shadow-sm">
      <SectionHeader
        eyebrow="Phase 6 · Dependency and blocker studio"
        title="Task relationship control"
        description="Create dependency links, document blockers, resolve risk items and trigger Work Graph sync without leaving the task context."
        action={<Badge variant="outline">Task #{taskId}</Badge>}
      />

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border bg-background/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium"><GitBranch className="size-4" /> Dependencies</div>
              <p className="text-muted-foreground text-xs">Cycle-safe task links that feed critical path and blast radius analysis.</p>
            </div>
            {dependencies.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>

          {!readOnly ? (
            <div className="mb-4 grid gap-3 rounded-2xl border bg-card/70 p-3 md:grid-cols-[minmax(0,1fr)_7rem_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="dependency-target">Target task ID</Label>
                <Input id="dependency-target" value={targetTaskId} onChange={(event) => setTargetTaskId(event.target.value)} placeholder="e.g. 128" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dependency-lag">Lag hours</Label>
                <Input id="dependency-lag" value={lagHours} onChange={(event) => setLagHours(event.target.value)} inputMode="numeric" />
              </div>
              <Button className="self-end rounded-full" onClick={submitDependency} disabled={createDependency.isPending}>
                {createDependency.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Link
              </Button>
            </div>
          ) : null}

          <ScrollArea className="max-h-72 pr-3">
            <div className="space-y-2">
              {dependencyItems.length > 0 ? dependencyItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card/70 p-3 text-sm">
                  <div>
                    <div className="font-medium">Task #{item.source_task_id} → Task #{item.target_task_id}</div>
                    <div className="text-muted-foreground text-xs">Lag {Math.round(item.lag_minutes / 60)}h · Project #{item.project_id ?? "—"}</div>
                  </div>
                  {!readOnly ? <Button size="icon" variant="ghost" onClick={() => removeDependency(item.id)} disabled={deleteDependency.isPending}><Trash2 className="size-4" /></Button> : null}
                </div>
              )) : <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">No dependencies linked yet.</div>}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-2xl border bg-background/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4" /> Blockers</div>
              <p className="text-muted-foreground text-xs">Open blockers raise graph risk, assignment pressure and delivery warnings.</p>
            </div>
            {blockers.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>

          {!readOnly ? (
            <div className="mb-4 space-y-3 rounded-2xl border bg-card/70 p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="blocker-title">Blocker title</Label>
                  <Input id="blocker-title" value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)} placeholder="Missing approval, unclear dependency..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Severity</Label>
                  <Select value={blockerSeverity} onValueChange={(value) => setBlockerSeverity(value as TaskBlocker["severity"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea value={blockerReason} onChange={(event) => setBlockerReason(event.target.value)} placeholder="Why is this blocked and what evidence supports it?" />
              <Button className="rounded-full" onClick={submitBlocker} disabled={createBlocker.isPending}>{createBlocker.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create blocker</Button>
            </div>
          ) : null}

          <ScrollArea className="max-h-72 pr-3">
            <div className="space-y-2">
              {blockerItems.length > 0 ? blockerItems.map((item) => (
                <div key={item.id} className="rounded-2xl border bg-card/70 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-1 text-muted-foreground text-xs">{item.reason || "No reason recorded"}</div>
                    </div>
                    <div className={cn("rounded-full border px-2 py-1 text-xs capitalize", toneClass(severityTone(item.severity)))}>{item.severity}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.status}</Badge>
                    <span className="text-muted-foreground text-xs">Owner #{item.owner_user_id ?? "—"}</span>
                    {item.status === "open" && !readOnly ? <Button size="sm" variant="outline" className="rounded-full" onClick={() => resolve(item.id)} disabled={resolveBlocker.isPending}><CheckCircle2 className="size-4" /> Resolve</Button> : null}
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">No open blockers for this task.</div>}
            </div>
          </ScrollArea>
          {!readOnly && blockerItems.some((item) => item.status === "open") ? (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="resolution-note">Resolution note for quick resolve</Label>
              <Input id="resolution-note" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
        <ShieldCheck className="mr-1 inline size-3" /> Changes call existing dependency/blocker APIs, then invalidate Work Graph, assignment and task relationship caches. The backend remains the source of truth for cycle detection and permissions.
      </div>
    </section>
  );
}
