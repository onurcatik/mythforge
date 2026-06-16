import { Bot, BrainCircuit, GitCompareArrows, Network, Route, Sparkles, Users } from "lucide-react";

import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { ActionPreviewCard, StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

const actions = [
  {
    icon: Sparkles,
    title: "Project cleanup",
    description: "Find stale tasks, unclear deadlines, duplicate work and unresolved blockers.",
    prompt: "Bu workspace'i toparla; stale task, duplicate iş, açık blocker ve belirsiz deadline listesini çıkar.",
    tone: "ai",
  },
  {
    icon: Network,
    title: "Risk scan",
    description: "Read critical path, blast radius and deadline collapse points from Work Graph.",
    prompt: "Bu workspace için Work Graph risklerini, critical path etkisini ve blast radius noktalarını göster.",
    tone: "warning",
  },
  {
    icon: GitCompareArrows,
    title: "Reorder queue",
    description: "Preview a safer order by priority, dependencies, blockers and deadlines.",
    prompt: "Görevleri priority, deadline, blocker, dependency ve critical path etkisine göre yeniden sırala ve diff olarak göster.",
    tone: "info",
  },
  {
    icon: Users,
    title: "Smart assignment",
    description: "Suggest owners using capacity, skill, timezone and graph impact.",
    prompt: "Açık görevler için kapasite, skill, timezone ve risk etkisine göre en uygun assignee önerilerini çıkar.",
    tone: "success",
  },
] as const;

export function AIOperatingPlanPanel() {
  return (
    <Surface tone="ai" padding="lg" className="overflow-hidden">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs" className="max-w-2xl">
            <StatusBadge tone="ai"><BrainCircuit className="mr-1 size-3" />AI operating plan</StatusBadge>
            <h2 className="font-semibold text-2xl tracking-[-0.04em]">Turn the workspace into next actions</h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
              A premium dashboard should not only display work; it should convert ambiguity into approved, audited and executable operations.
            </p>
          </Stack>
          <button
            type="button"
            onClick={() => getOpenAICommandCenter()?.("Bugün uygulanacak en yüksek kaldıraçlı 5 operasyon hamlesini kaynaklarıyla çıkar.")}
            className="rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 font-medium text-sm text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-200"
          >
            <Cluster gap="xs"><Bot className="size-4" />Ask for top 5</Cluster>
          </button>
        </Cluster>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                type="button"
                onClick={() => getOpenAICommandCenter()?.(action.prompt)}
                className="group rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-[var(--ifx-shadow-md)]"
              >
                <Stack gap="md">
                  <Cluster justify="between" className="flex-nowrap">
                    <span className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-2 text-violet-600 dark:text-violet-200">
                      <Icon className="size-5" />
                    </span>
                    <Route className="size-4 text-[color:var(--ifx-text-tertiary)] opacity-0 transition group-hover:opacity-100" />
                  </Cluster>
                  <Stack gap="xs">
                    <h3 className="font-semibold tracking-[-0.02em]">{action.title}</h3>
                    <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{action.description}</p>
                  </Stack>
                </Stack>
              </button>
            );
          })}
        </div>

        <ActionPreviewCard
          title="Suggested operation discipline"
          description="Every AI write action should flow through preview, diff, partial approval, execution and rollback instead of silent mutation."
          actionType="approve"
          before="Unclear work, manual triage and hidden dependency risk"
          after="Audited plan with source cards, graph impact and owner recommendations"
        />
      </Stack>
    </Surface>
  );
}
