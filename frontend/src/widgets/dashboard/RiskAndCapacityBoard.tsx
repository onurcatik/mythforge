import { AlertTriangle, CalendarClock, GitBranch, ShieldAlert, Users } from "lucide-react";
import type { ReactNode } from "react";

import type { DashboardRiskTone } from "@/features/independent-dashboard/model";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";

type RiskAndCapacityBoardProps = {
  overdue: number;
  dueSoon: number;
  inProgress: number;
  openProjects: number;
  riskLabel: string;
  riskHelper: string;
  riskTone: DashboardRiskTone;
  teamLoad: string;
};

type HeatCellProps = {
  label: ReactNode;
  value: ReactNode;
  tone: DashboardRiskTone;
  helper: ReactNode;
};

function HeatCell({ label, value, tone, helper }: HeatCellProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-4">
      <Cluster justify="between" className="mb-3">
        <div className="text-[color:var(--ifx-text-tertiary)] text-xs uppercase tracking-[0.18em]">{label}</div>
        <StatusBadge tone={tone}>{value}</StatusBadge>
      </Cluster>
      <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">{helper}</p>
    </div>
  );
}

export function RiskAndCapacityBoard({ overdue, dueSoon, inProgress, openProjects, riskLabel, riskHelper, riskTone, teamLoad }: RiskAndCapacityBoardProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Surface padding="lg">
        <Stack gap="lg">
          <Cluster justify="between" align="start">
            <Stack gap="xs">
              <StatusBadge tone="warning"><ShieldAlert className="mr-1 size-3" />Risk map</StatusBadge>
              <h2 className="font-semibold text-xl tracking-[-0.03em]">Delivery pressure before it becomes expensive</h2>
              <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">Phase 3 brings dashboard-level risk visibility without changing backend contracts.</p>
            </Stack>
            <StatusBadge tone={riskTone} dot>{riskLabel}</StatusBadge>
          </Cluster>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HeatCell label="Overdue" value={overdue} tone={overdue > 0 ? "danger" : "success"} helper="Tasks already past due date and visible in the current queue." />
            <HeatCell label="Due soon" value={dueSoon} tone={dueSoon >= 4 ? "warning" : "info"} helper="Upcoming deadline pressure for the next seven days." />
            <HeatCell label="In progress" value={inProgress} tone="ai" helper="Current execution focus that may need priority control." />
            <HeatCell label="Projects" value={openProjects} tone="neutral" helper="Open delivery surfaces included in the operating dashboard." />
          </div>
          <div className="rounded-[var(--ifx-radius-xl)] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100">
            <Cluster gap="sm" align="start" className="flex-nowrap">
              <AlertTriangle className="mt-0.5 size-4" />
              <span>{riskHelper}</span>
            </Cluster>
          </div>
        </Stack>
      </Surface>

      <Surface padding="lg" tone="glass">
        <Stack gap="lg">
          <Cluster justify="between">
            <StatusBadge tone="ai"><Users className="mr-1 size-3" />Capacity</StatusBadge>
            <StatusBadge tone="neutral">{teamLoad}</StatusBadge>
          </Cluster>
          <Stack gap="md">
            <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
              <Cluster justify="between">
                <span className="text-[color:var(--ifx-text-secondary)] text-sm">Execution load</span>
                <span className="font-semibold text-2xl tracking-[-0.04em]">{inProgress}</span>
              </Cluster>
            </div>
            <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
              <Cluster justify="between">
                <span className="inline-flex items-center gap-2 text-[color:var(--ifx-text-secondary)] text-sm"><CalendarClock className="size-4" />Deadline load</span>
                <span className="font-semibold text-2xl tracking-[-0.04em]">{dueSoon}</span>
              </Cluster>
            </div>
            <div className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-4">
              <Cluster justify="between">
                <span className="inline-flex items-center gap-2 text-[color:var(--ifx-text-secondary)] text-sm"><GitBranch className="size-4" />Project surfaces</span>
                <span className="font-semibold text-2xl tracking-[-0.04em]">{openProjects}</span>
              </Cluster>
            </div>
          </Stack>
        </Stack>
      </Surface>
    </div>
  );
}
