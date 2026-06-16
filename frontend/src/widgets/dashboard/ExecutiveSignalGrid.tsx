import { AlertTriangle, CalendarClock, CheckCircle2, Flame, GitBranch, TrendingDown, TrendingUp, Users } from "lucide-react";

import type { DashboardRiskTone } from "@/features/independent-dashboard/model";
import { MetricCard } from "@/shared/ui/data-display";
import { ResponsiveGrid } from "@/shared/ui/primitives";

export type ExecutiveSignalGridProps = {
  completedThisWeek?: number | null;
  onTimeRate?: number | null;
  streak?: number | null;
  backlogTrend?: string | null;
  workspaceHealth: number;
  overdue: number;
  dueSoon: number;
  inProgress: number;
  teamLoad: string;
  riskTone: DashboardRiskTone;
};

export function ExecutiveSignalGrid({
  completedThisWeek,
  onTimeRate,
  streak,
  backlogTrend,
  workspaceHealth,
  overdue,
  dueSoon,
  inProgress,
  teamLoad,
  riskTone,
}: ExecutiveSignalGridProps) {
  const BacklogIcon = backlogTrend === "Growing" ? TrendingUp : TrendingDown;

  return (
    <ResponsiveGrid variant="metrics" className="xl:grid-cols-6">
      <MetricCard icon={CheckCircle2} label="Workspace health" value={`${workspaceHealth}%`} helper="Executive delivery confidence" tone={workspaceHealth >= 80 ? "success" : workspaceHealth >= 60 ? "warning" : "danger"} />
      <MetricCard icon={CheckCircle2} label="Completed" value={completedThisWeek ?? "—"} helper="Tasks completed this week" tone="success" />
      <MetricCard icon={CalendarClock} label="On-time rate" value={onTimeRate != null ? `${Math.round(onTimeRate)}%` : "—"} helper={`${dueSoon} due soon`} tone={onTimeRate != null && onTimeRate >= 80 ? "success" : "warning"} />
      <MetricCard icon={AlertTriangle} label="Risk pressure" value={overdue} helper="Overdue tasks visible now" tone={riskTone} />
      <MetricCard icon={GitBranch} label="In progress" value={inProgress} helper="Execution queue moving" tone="info" />
      <MetricCard icon={Users} label="Team load" value={teamLoad} helper={`${streak ?? 0} day streak · ${backlogTrend ?? "stable"}`} tone="ai" trend={<span className="inline-flex items-center gap-1"><BacklogIcon className="size-3" />Backlog {backlogTrend ?? "Stable"}</span>} />
    </ResponsiveGrid>
  );
}
