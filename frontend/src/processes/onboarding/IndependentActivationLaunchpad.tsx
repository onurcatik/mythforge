import { Bot, CheckCircle2, Circle, DatabaseZap, GitBranch, ServerCog } from "lucide-react";

import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type ActivationLaunchpadProps = {
  hasProjects: boolean;
  hasTasks: boolean;
  localRuntimeVisible?: boolean;
  onRunAI?: () => void;
};

export function IndependentActivationLaunchpad({ hasProjects, hasTasks, localRuntimeVisible, onRunAI }: ActivationLaunchpadProps) {
  const steps = [
    { id: "workspace", label: "Workspace connected", description: "Auth, guild context and permission-safe routes are active.", completed: true, icon: CheckCircle2 },
    { id: "project", label: "Project cockpit ready", description: "Open or create a project to unlock delivery dashboards.", completed: hasProjects, icon: GitBranch },
    { id: "task", label: "Execution queue populated", description: "Tasks power priority, blockers, assignment and risk views.", completed: hasTasks, icon: Circle },
    { id: "rag", label: "Workspace memory available", description: "Docs, tasks and comments can become grounded AI sources.", completed: hasProjects || hasTasks, icon: DatabaseZap },
    { id: "local", label: "AI runtime verified", description: "OpenAI, Anthropic, Ollama or local-only runtime is visible.", completed: Boolean(localRuntimeVisible), icon: ServerCog },
  ];
  const completed = steps.filter((step) => step.completed).length;

  return (
    <Surface tone="glass" padding="lg">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <StatusBadge tone="ai"><Bot className="mr-1 size-3" />Activation</StatusBadge>
            <h2 className="font-semibold text-xl tracking-[-0.03em]">Make the AI operating system valuable fast</h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">Phase 3 adds a marketable first-run path that explains the product value without fake data.</p>
          </Stack>
          <div className="font-semibold text-3xl tracking-[-0.05em]">{completed}/{steps.length}</div>
        </Cluster>
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.completed ? CheckCircle2 : step.icon;
            return (
              <div key={step.id} className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
                <Cluster gap="sm" align="start" className="flex-nowrap">
                  <Icon className={step.completed ? "mt-0.5 size-4 text-emerald-500" : "mt-0.5 size-4 text-[color:var(--ifx-text-tertiary)]"} />
                  <Stack gap="xs">
                    <div className="font-medium text-sm">{step.label}</div>
                    <div className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{step.description}</div>
                  </Stack>
                </Cluster>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onRunAI} className="rounded-full bg-slate-950 px-4 py-2 font-medium text-sm text-white shadow-[var(--ifx-shadow-md)] transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
          <Cluster gap="xs" justify="center"><Bot className="size-4" />Run first AI command</Cluster>
        </button>
      </Stack>
    </Surface>
  );
}
