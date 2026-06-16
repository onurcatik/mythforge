import { TaskStatusCategory } from "@/api/generated/initiativeAPI.schemas";

export type DashboardRiskTone = "success" | "warning" | "danger" | "ai" | "neutral" | "info";

export type DashboardTaskLike = {
  due_date?: string | null;
  task_status?: { category?: TaskStatusCategory | string | null } | null;
  priority?: string | null;
  title?: string | null;
  name?: string | null;
};

export type DashboardProjectLike = {
  id: number;
  name: string;
  icon?: string | null;
  is_archived?: boolean | null;
  updated_at?: string | null;
  task_summary?: {
    total?: number | null;
    completed?: number | null;
  } | null;
  is_favorited?: boolean | null;
};

export type DashboardStatsLike = {
  tasks_completed_this_week?: number | null;
  on_time_rate?: number | null;
  streak?: number | null;
  backlog_trend?: string | null;
  velocity_data?: unknown[] | null;
};

export function getTaskPressure(tasks: DashboardTaskLike[]) {
  const now = Date.now();
  const nextSevenDays = now + 1000 * 60 * 60 * 24 * 7;
  const overdue = tasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < now).length;
  const dueSoon = tasks.filter((task) => {
    if (!task.due_date) return false;
    const dueTime = new Date(task.due_date).getTime();
    return dueTime >= now && dueTime <= nextSevenDays;
  }).length;
  const inProgress = tasks.filter((task) => task.task_status?.category === TaskStatusCategory.in_progress).length;
  const todo = tasks.filter((task) => task.task_status?.category === TaskStatusCategory.todo).length;

  return {
    overdue,
    dueSoon,
    inProgress,
    todo,
    total: tasks.length,
  };
}

export function getWorkspaceHealthScore(stats: DashboardStatsLike | undefined, pressure: ReturnType<typeof getTaskPressure>) {
  const onTime = typeof stats?.on_time_rate === "number" ? stats.on_time_rate : 72;
  const overduePenalty = Math.min(28, pressure.overdue * 7);
  const activeBonus = Math.min(8, pressure.inProgress * 2);
  const trendPenalty = stats?.backlog_trend === "Growing" ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(onTime - overduePenalty + activeBonus - trendPenalty)));
}

export function getWorkspaceHealthTone(score: number): DashboardRiskTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export function getProjectCompletion(project: DashboardProjectLike) {
  const total = project.task_summary?.total ?? 0;
  if (total <= 0) return 0;
  return Math.round(((project.task_summary?.completed ?? 0) / total) * 100);
}

export function getRiskLevel(overdue: number, dueSoon: number) {
  if (overdue >= 3) return { label: "High", tone: "danger" as DashboardRiskTone, helper: "Overdue work needs immediate triage" };
  if (overdue > 0 || dueSoon >= 4) return { label: "Elevated", tone: "warning" as DashboardRiskTone, helper: "Deadline pressure is building" };
  return { label: "Controlled", tone: "success" as DashboardRiskTone, helper: "No critical delivery pressure visible" };
}

export function getTeamLoadLabel(inProgress: number, total: number) {
  if (total === 0) return "No active queue";
  const ratio = inProgress / total;
  if (ratio >= 0.65) return "Focused load";
  if (ratio >= 0.35) return "Balanced";
  return "Planning heavy";
}

export function sortRecentProjects(projects: DashboardProjectLike[], limit = 5) {
  return [...projects]
    .filter((project) => !project.is_archived)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .slice(0, limit);
}
