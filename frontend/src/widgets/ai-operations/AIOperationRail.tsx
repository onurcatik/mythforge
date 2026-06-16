import { Bot, CheckCircle2, CircleDashed, FileSearch, GitCompareArrows, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StageState = "idle" | "active" | "done" | "blocked";

type AIOperationRailProps = {
  interpreted?: boolean;
  executing?: boolean;
  completed?: boolean;
  approvalState?: string | null;
  localOnly?: boolean;
};

const stateClass: Record<StageState, string> = {
  idle: "border-border bg-background/70 text-muted-foreground",
  active: "border-primary/30 bg-primary/10 text-primary shadow-sm",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  blocked: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function Stage({ icon: Icon, label, detail, state }: { icon: LucideIcon; label: string; detail: string; state: StageState }) {
  return (
    <div className={cn("rounded-2xl border p-3 transition-all", stateClass[state])}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {state === "active" ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        {label}
      </div>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

export function AIOperationRail({ interpreted, executing, completed, approvalState, localOnly }: AIOperationRailProps) {
  const approvalRequired = approvalState === "approval_required" || approvalState === "pending" || approvalState === "required";
  return (
    <div className="grid gap-2 rounded-3xl border bg-card/70 p-3 shadow-sm md:grid-cols-5">
      <Stage icon={Sparkles} label="Intent" detail="Command is classified before tools run." state={interpreted ? "done" : executing ? "active" : "idle"} />
      <Stage icon={FileSearch} label="Context" detail="RAG, graph and assignment context stay permission-safe." state={executing ? "active" : completed ? "done" : "idle"} />
      <Stage icon={Bot} label="AI runtime" detail={localOnly ? "Local Ollama runtime active." : "Configured cloud or hybrid runtime."} state={localOnly ? "done" : "idle"} />
      <Stage icon={GitCompareArrows} label="Diff" detail="Write actions are previewed before execution." state={approvalRequired ? "blocked" : completed ? "done" : "idle"} />
      <Stage icon={ShieldCheck} label="Audit" detail="Every command gets a policy and audit trail." state={completed ? "done" : "idle"} />
      <div className="md:col-span-5 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Badge variant="outline">approval-first</Badge>
        <Badge variant="outline">source-grounded</Badge>
        <Badge variant="outline">permission-safe</Badge>
        {completed ? <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 size-3" />completed</Badge> : <Badge variant="secondary"><CircleDashed className="mr-1 size-3" />waiting</Badge>}
      </div>
    </div>
  );
}
