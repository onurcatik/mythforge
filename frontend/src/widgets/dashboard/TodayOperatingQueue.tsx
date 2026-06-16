import { Link } from "@tanstack/react-router";
import { Bot, CalendarClock, CheckCircle2, Clock3, ListChecks } from "lucide-react";

import type { DashboardTaskLike } from "@/features/independent-dashboard/model";
import { EmptyState, LoadingBars } from "@/shared/ui/feedback";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { StatusBadge } from "@/shared/ui/data-display";

type TodayOperatingQueueProps = {
  tasks: Array<DashboardTaskLike & { id?: number | string; title?: string | null }>;
  isLoading?: boolean;
  taskHref?: (id: number | string) => string;
  onAskAI?: () => void;
};

function formatDueDate(value?: string | null) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function TodayOperatingQueue({ tasks, isLoading, taskHref, onAskAI }: TodayOperatingQueueProps) {
  return (
    <Surface padding="lg">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <StatusBadge tone="ai"><ListChecks className="mr-1 size-3" />Today's operating queue</StatusBadge>
            <h2 className="font-semibold text-xl tracking-[-0.03em]">The next work that deserves focus</h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">Sorted by deadline and delivery pressure, ready for AI-assisted triage.</p>
          </Stack>
          <button type="button" onClick={onAskAI} className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 font-medium text-sm text-violet-700 dark:text-violet-200">
            <Cluster gap="xs"><Bot className="size-4" />Prioritize</Cluster>
          </button>
        </Cluster>

        {isLoading ? <LoadingBars /> : null}

        {!isLoading && tasks.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No urgent queue visible" description="When tasks with deadlines appear, this panel becomes the daily execution queue." />
        ) : null}

        {!isLoading && tasks.length > 0 ? (
          <div className="space-y-2">
            {tasks.slice(0, 8).map((task, index) => {
              const content = (
                <Cluster justify="between" className="flex-nowrap">
                  <Cluster gap="sm" className="min-w-0 flex-nowrap">
                    <div className="grid size-9 place-items-center rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] font-semibold text-[color:var(--ifx-text-secondary)] text-xs">
                      {index + 1}
                    </div>
                    <Stack gap="xs" className="min-w-0">
                      <div className="line-clamp-1 font-medium text-sm">{task.title ?? task.name ?? "Untitled task"}</div>
                      <div className="inline-flex items-center gap-2 text-[color:var(--ifx-text-secondary)] text-xs">
                        <Clock3 className="size-3" />{task.task_status?.category ?? "unknown"}
                      </div>
                    </Stack>
                  </Cluster>
                  <StatusBadge tone={task.due_date && new Date(task.due_date).getTime() < Date.now() ? "danger" : "info"}>
                    <CalendarClock className="mr-1 size-3" />{formatDueDate(task.due_date)}
                  </StatusBadge>
                </Cluster>
              );

              return task.id && taskHref ? (
                <Link key={task.id} to={taskHref(task.id)} className="block rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3 transition hover:border-violet-500/30 hover:bg-[color:var(--ifx-surface-raised)]">
                  {content}
                </Link>
              ) : (
                <div key={`${task.title ?? "task"}-${index}`} className="rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-3">
                  {content}
                </div>
              );
            })}
          </div>
        ) : null}
      </Stack>
    </Surface>
  );
}
