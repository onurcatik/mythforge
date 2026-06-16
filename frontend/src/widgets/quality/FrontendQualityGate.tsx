import { Activity, CheckCircle2, Gauge, ShieldCheck, Smartphone, Sparkles, TestTube2, type LucideIcon } from "lucide-react";

import { calculateReadinessScore, getPhaseEightChecklist, getQualitySignals, type QualityChecklistItem, type QualityTone } from "@/shared/lib/quality";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, ResponsiveGrid, Stack, Surface } from "@/shared/ui/primitives";

const toneToBadge: Record<QualityTone, "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
};

const statusIcon: Record<QualityChecklistItem["status"], LucideIcon> = {
  ready: CheckCircle2,
  watch: Activity,
  blocked: TestTube2,
};

const statusTone: Record<QualityChecklistItem["status"], "success" | "warning" | "danger"> = {
  ready: "success",
  watch: "warning",
  blocked: "danger",
};

export function FrontendQualityGate() {
  const checklist = getPhaseEightChecklist();
  const signals = getQualitySignals();
  const readiness = calculateReadinessScore(checklist);

  return (
    <Surface padding="lg" className="overflow-hidden" aria-labelledby="frontend-quality-gate-title">
      <Stack gap="lg">
        <Cluster justify="between" align="start" gap="lg">
          <div>
            <StatusBadge tone="ai"><ShieldCheck className="mr-1 size-3" />Phase 8 QA</StatusBadge>
            <h2 id="frontend-quality-gate-title" className="mt-3 font-semibold text-xl tracking-[-0.03em] md:text-2xl">
              Frontend quality gate
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--ifx-text-secondary)] text-sm leading-6">
              Final hardening for the independent frontend: responsive coverage, accessibility, performance posture, backend contract safety and test readiness.
            </p>
          </div>
          <div className="rounded-[var(--ifx-radius-2xl)] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-right">
            <div className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.18em]">Readiness</div>
            <div className="font-semibold text-3xl tracking-[-0.05em]">{readiness}%</div>
            <div className="text-[color:var(--ifx-text-secondary)] text-xs">install-time checks remain</div>
          </div>
        </Cluster>

        <ResponsiveGrid variant="metrics">
          {signals.map((signal) => (
            <div key={signal.id} className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-4">
              <Stack gap="sm">
                <StatusBadge tone={toneToBadge[signal.tone]}>{signal.label}</StatusBadge>
                <div className="font-semibold text-xl tracking-[-0.04em]">{signal.value}</div>
                <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{signal.helper}</p>
              </Stack>
            </div>
          ))}
        </ResponsiveGrid>

        <div className="grid gap-3 lg:grid-cols-5">
          {checklist.map((item) => {
            const Icon = statusIcon[item.status];
            return (
              <div key={item.id} className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
                <Stack gap="sm">
                  <Cluster justify="between" gap="sm">
                    <div className="rounded-xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-2">
                      <Icon className="size-4" />
                    </div>
                    <StatusBadge tone={statusTone[item.status]}>{item.status}</StatusBadge>
                  </Cluster>
                  <div className="font-medium text-sm">{item.title}</div>
                  <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{item.description}</p>
                </Stack>
              </div>
            );
          })}
        </div>
      </Stack>
    </Surface>
  );
}

export function ResponsiveQualityChecklist() {
  const breakpoints = [
    { label: "Desktop", value: "1440px+", helper: "Data-dense cockpit, full nav and right rail", icon: Gauge },
    { label: "Laptop", value: "1280px", helper: "Compact panels, no shell overflow", icon: Sparkles },
    { label: "Tablet", value: "768px", helper: "Drawer navigation and stacked intelligence cards", icon: Smartphone },
    { label: "Mobile", value: "390px", helper: "Touch-safe command and detail flows", icon: Smartphone },
  ];

  return (
    <Surface padding="lg" tone="glass" aria-labelledby="responsive-quality-title">
      <Stack gap="lg">
        <div>
          <StatusBadge tone="info">Responsive QA</StatusBadge>
          <h2 id="responsive-quality-title" className="mt-3 font-semibold text-xl tracking-[-0.03em]">Viewport coverage</h2>
          <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
            The independent frontend is designed to degrade from operating-room density to mobile command workflows without changing backend behavior.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {breakpoints.map((breakpoint) => {
            const Icon = breakpoint.icon;
            return (
              <div key={breakpoint.label} className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-4">
                <Cluster gap="sm" className="flex-nowrap">
                  <div className="rounded-xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-2">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{breakpoint.label}</div>
                    <div className="text-[color:var(--ifx-text-tertiary)] text-xs">{breakpoint.value}</div>
                  </div>
                </Cluster>
                <p className="mt-3 text-[color:var(--ifx-text-secondary)] text-xs leading-5">{breakpoint.helper}</p>
              </div>
            );
          })}
        </div>
      </Stack>
    </Surface>
  );
}
