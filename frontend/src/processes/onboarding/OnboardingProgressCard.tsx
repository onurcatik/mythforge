import { CheckCircle2, Circle, Sparkles } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  completed?: boolean;
};

const defaultSteps: OnboardingStep[] = [
  { id: "workspace", label: "Workspace connected", description: "Confirm auth, permissions and workspace context.", completed: true },
  { id: "project", label: "First project mapped", description: "Create or open a project delivery cockpit." },
  { id: "ai", label: "Run first AI command", description: "Ask the workspace or generate an approval-first plan." },
  { id: "local", label: "Verify AI runtime", description: "Check OpenAI, Anthropic, Ollama or local-only mode." },
];

export function OnboardingProgressCard({ steps = defaultSteps }: { steps?: OnboardingStep[] }) {
  const completed = steps.filter((step) => step.completed).length;

  return (
    <Surface tone="glass" padding="lg">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <StatusBadge tone="ai"><Sparkles className="mr-1 size-3" />Activation path</StatusBadge>
            <h3 className="font-semibold text-xl tracking-[-0.03em]">Make the AI operating system useful fast</h3>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">This independent onboarding pattern is designed to sell the product value without fake data.</p>
          </Stack>
          <div className="font-semibold text-2xl tracking-[-0.04em]">{completed}/{steps.length}</div>
        </Cluster>
        <div className="space-y-2">
          {steps.map((step) => {
            const Icon = step.completed ? CheckCircle2 : Circle;
            return (
              <div key={step.id} className="flex gap-3 rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
                <Icon className={cn("mt-0.5 size-4", step.completed ? "text-emerald-500" : "text-[color:var(--ifx-text-tertiary)]")} />
                <Stack gap="xs">
                  <div className="font-medium text-sm">{step.label}</div>
                  <div className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{step.description}</div>
                </Stack>
              </div>
            );
          })}
        </div>
      </Stack>
    </Surface>
  );
}
