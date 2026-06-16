import {
  Activity,
  Bot,
  Clock3,
  FileText,
  GitCompareArrows,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "robot-toast";

import { ApprovalPill } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  type CommandContext,
  type CommandIntent,
  useCommandHealth,
  useCommandHistory,
  useExecuteCommand,
  useInterpretCommand,
} from "@/hooks/useCommandCenter";
import { useAIEnabled } from "@/hooks/useAIEnabled";
import { AIOperationRail, CommandResultRenderer } from "@/widgets/ai-operations";

const intentLabels: Record<CommandIntent, string> = {
  ask_workspace: "Ask Workspace",
  plan_project: "Plan with Agent",
  summarize_project: "Summarize Project",
  show_risks: "Show Risks",
  reorder_tasks: "Reorder Tasks",
  assign_tasks: "Assign Tasks",
  impact_analysis: "Impact Analysis",
  convert_meeting_notes: "Meeting Notes to Plan",
  create_tasks: "Create Tasks",
  resolve_blockers: "Resolve Blockers",
  project_cleanup: "Project Cleanup",
  open_entity: "Open Entity",
};

const quickCommands: Array<{
  label: string;
  value: string;
  intent?: CommandIntent;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    label: "Projeyi toparla",
    value: "Bu projeyi toparla; stale task, açık blocker, belirsiz deadline ve duplicate işleri listele.",
    intent: "project_cleanup",
    icon: WandSparkles,
    accent: "from-violet-500/15 to-cyan-500/5",
  },
  {
    label: "Riskleri göster",
    value: "Bu workspace için en kritik riskleri, kritik yolu ve deadline çökme noktalarını göster.",
    intent: "show_risks",
    icon: Activity,
    accent: "from-amber-500/15 to-rose-500/5",
  },
  {
    label: "Görevleri sırala",
    value: "Görevleri deadline, priority, dependency, blocker ve critical path etkisine göre yeniden sırala.",
    intent: "reorder_tasks",
    icon: GitCompareArrows,
    accent: "from-blue-500/15 to-violet-500/5",
  },
  {
    label: "Kime atayalım?",
    value: "Seçili görevi kapasite, skill, timezone ve workload verisine göre kime atamalıyız?",
    intent: "assign_tasks",
    icon: UserCheck,
    accent: "from-emerald-500/15 to-cyan-500/5",
  },
  {
    label: "Toplantı notunu plana çevir",
    value:
      "Aşağıdaki toplantı notunu kararlar, action itemlar, ownerlar, deadline ve takip görevleri olarak plana çevir:\n\n",
    intent: "convert_meeting_notes",
    icon: FileText,
    accent: "from-slate-500/12 to-violet-500/5",
  },
  {
    label: "Bu görev gecikirse?",
    value: "Bu görev gecikirse hangi deliverable, user, deadline ve project zincirleri etkilenir?",
    intent: "impact_analysis",
    icon: Network,
    accent: "from-cyan-500/15 to-blue-500/5",
  },
];

const percent = (value?: number | null) =>
  `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`;

type AICommandCenterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: CommandContext;
  initialCommand?: string;
};

export function AICommandCenterDialog({
  open,
  onOpenChange,
  context,
  initialCommand,
}: AICommandCenterDialogProps) {
  const [command, setCommand] = useState(initialCommand ?? "");
  const [selectedIntent, setSelectedIntent] = useState<CommandIntent | null>(null);
  const interpret = useInterpretCommand();
  const execute = useExecuteCommand();
  const history = useCommandHistory(open);
  const health = useCommandHealth(open);
  const aiRuntime = useAIEnabled();

  useEffect(() => {
    if (open && initialCommand) setCommand(initialCommand);
  }, [open, initialCommand]);

  useEffect(() => {
    if (!open) {
      setCommand("");
      setSelectedIntent(null);
      interpret.reset();
      execute.reset();
    }
  }, [open]);

  const effectiveIntent = selectedIntent ?? interpret.data?.intent ?? null;
  const canRun = command.trim().length >= 2 && !execute.isPending;
  const execution = execute.data;

  const policyLine = useMemo(() => {
    if (!health.data) return "Command policy loading";
    return `${health.data.status} · ${health.data.supported_intents.length} intents · writes require approval`;
  }, [health.data]);

  const runInterpret = () => {
    const trimmed = command.trim();
    if (trimmed.length < 2) return;
    interpret.mutate(
      { command: trimmed, context },
      {
        onSuccess: (data) => setSelectedIntent(data.intent),
        onError: () => toast.error("Command interpretation failed."),
      }
    );
  };

  const runCommand = () => {
    const trimmed = command.trim();
    if (trimmed.length < 2) return;
    execute.mutate(
      { command: trimmed, intent: effectiveIntent, context },
      {
        onError: () => toast.error("Command execution failed."),
        onSuccess: () => void history.refetch(),
      }
    );
  };

  const useQuickCommand = (value: string, intent?: CommandIntent) => {
    setCommand(value);
    setSelectedIntent(intent ?? null);
    interpret.reset();
    execute.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-grid-bg max-h-[94vh] max-w-7xl overflow-hidden border-primary/10 p-0 shadow-2xl">
        <div className="grid max-h-[94vh] min-h-[76vh] lg:grid-cols-[minmax(0,1.22fr)_minmax(360px,0.78fr)]">
          <section className="min-w-0 border-r bg-background/78 p-5 backdrop-blur-xl md:p-6">
            <DialogHeader className="mb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  AI operations center
                </Badge>
                <ApprovalPill>approval-first writes</ApprovalPill>
                <Badge variant="outline" className={aiRuntime.data?.local_only ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"}>
                  {aiRuntime.data?.local_only ? "Local Ollama" : aiRuntime.data?.provider ?? "AI runtime"}
                </Badge>
              </div>
              <DialogTitle className="mt-3 flex items-center gap-3 text-3xl tracking-[-0.04em]">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ai-ring">
                  <Bot className="size-5" />
                </span>
                Command Center
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6">
                Ask workspace memory, create agent plans, inspect Work Graph risk and generate smart assignments from a single permission-safe panel. {aiRuntime.data?.local_only ? "Local AI Mode is active; workspace context stays on Ollama." : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 grid gap-2 rounded-2xl border bg-card/75 p-3 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ShieldCheck className="size-4 text-primary" />
                <span>{policyLine}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock3 className="size-3.5" />
                {execution ? `${Math.round(execution.latency_ms)}ms last run` : "Ready for live operation"}
              </div>
            </div>

            <div className="mb-4">
              <AIOperationRail
                interpreted={!!interpret.data}
                executing={execute.isPending}
                completed={!!execution}
                approvalState={execution?.approval_state ?? interpret.data?.execution_mode ?? null}
                localOnly={!!aiRuntime.data?.local_only}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickCommands.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="premium-card group relative overflow-hidden rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
                  onClick={() => useQuickCommand(item.value, item.intent)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                  <div className="relative flex items-start gap-3">
                    <span className="rounded-2xl border bg-background/70 p-2 text-primary">
                      <item.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-sm">{item.label}</span>
                      <span className="mt-1 line-clamp-2 block text-muted-foreground text-xs leading-5">
                        {item.value}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-3xl border bg-card/85 p-3 shadow-sm">
              <Textarea
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="Example: Şu projeyi toparla, riskleri göster, görevleri yeniden sırala..."
                className="min-h-36 resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    runCommand();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {effectiveIntent ? (
                    <Badge variant="secondary">{intentLabels[effectiveIntent]}</Badge>
                  ) : (
                    <Badge variant="outline">intent auto-detect</Badge>
                  )}
                  {interpret.data?.execution_mode === "approval_required" ? (
                    <ApprovalPill>preview/diff required</ApprovalPill>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={runInterpret}
                    disabled={command.trim().length < 2 || interpret.isPending}
                  >
                    {interpret.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                    Interpret
                  </Button>
                  <Button onClick={runCommand} disabled={!canRun}>
                    {execute.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Bot className="mr-2 size-4" />}
                    Run Command
                  </Button>
                </div>
              </div>
            </div>

            {interpret.data ? (
              <div className="mt-4 rounded-2xl border bg-card/80 p-4 text-sm shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{intentLabels[interpret.data.intent]}</Badge>
                  <span className="text-muted-foreground">Confidence {percent(interpret.data.confidence)}</span>
                  <span className="text-muted-foreground">Mode {interpret.data.execution_mode}</span>
                </div>
                <p className="mt-2 text-muted-foreground">{interpret.data.message}</p>
                {interpret.data.safety_flags.length > 0 ? (
                  <div className="mt-2 text-destructive text-xs">
                    Safety flags: {interpret.data.safety_flags.join(", ")}
                  </div>
                ) : null}
              </div>
            ) : null}

            {execute.error ? (
              <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                Command execution failed. Check permissions and backend service health.
              </div>
            ) : null}

            <div className="mt-4">
              <CommandResultRenderer execution={execution} />
            </div>
          </section>

          <aside className="min-h-0 bg-card/78 p-5 backdrop-blur-xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold tracking-[-0.03em]">Command history</div>
                <p className="text-muted-foreground text-xs">Recent AI operations and audit-backed outcomes.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void history.refetch()} disabled={history.isFetching}>
                {history.isFetching ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}
                Refresh
              </Button>
            </div>
            <div className="mt-4 border-t" />
            <ScrollArea className="mt-4 h-[70vh] rounded-2xl border bg-background/55">
              <div className="space-y-2 p-3">
                {(history.data?.items ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-muted-foreground text-sm">
                    No command history yet. Run a project cleanup, risk analysis or workspace question to start the audit trail.
                  </div>
                ) : null}
                {history.data?.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-2xl border bg-card/80 p-4 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                    onClick={() => {
                      setCommand(item.command_preview);
                      setSelectedIntent(item.intent);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{intentLabels[item.intent]}</Badge>
                      <span className="text-muted-foreground text-xs">{Math.round(item.latency_ms)}ms</span>
                    </div>
                    <div className="mt-3 line-clamp-2 font-medium">{item.command_preview}</div>
                    <div className="mt-2 text-muted-foreground text-xs">
                      {item.status} · {item.used_tools.join(", ") || "no tools"}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
