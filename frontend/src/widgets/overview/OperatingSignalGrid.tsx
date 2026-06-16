import { AlertTriangle, Bot, CalendarClock, GitBranch, ListChecks, Users } from "lucide-react";

import { MetricCard } from "@/shared/ui/data-display";
import { ResponsiveGrid } from "@/shared/ui/primitives";

type OperatingSignalGridProps = {
  workspaceHealth?: string;
  activeRisks?: number;
  blockedTasks?: number;
  upcomingDeadlines?: number;
  teamLoad?: string;
  aiActions?: number;
};

export function OperatingSignalGrid({
  workspaceHealth = "--",
  activeRisks = 0,
  blockedTasks = 0,
  upcomingDeadlines = 0,
  teamLoad = "--",
  aiActions = 0,
}: OperatingSignalGridProps) {
  return (
    <ResponsiveGrid variant="metrics">
      <MetricCard icon={ListChecks} label="Workspace health" value={workspaceHealth} helper="Delivery confidence across active work" tone="success" />
      <MetricCard icon={AlertTriangle} label="Active risks" value={activeRisks} helper="Graph and deadline signals" tone={activeRisks > 0 ? "warning" : "success"} />
      <MetricCard icon={GitBranch} label="Blocked tasks" value={blockedTasks} helper="Dependency and blocker pressure" tone={blockedTasks > 0 ? "danger" : "success"} />
      <MetricCard icon={CalendarClock} label="Deadlines" value={upcomingDeadlines} helper="Due soon or at risk" tone="info" />
      <MetricCard icon={Users} label="Team load" value={teamLoad} helper="Capacity balance" tone="neutral" />
      <MetricCard icon={Bot} label="AI next actions" value={aiActions} helper="Suggested operations ready" tone="ai" />
    </ResponsiveGrid>
  );
}
