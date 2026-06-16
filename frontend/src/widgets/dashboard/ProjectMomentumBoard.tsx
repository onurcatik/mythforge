import { Link } from "@tanstack/react-router";
import { ArrowRight, ListTodo, Star } from "lucide-react";

import type { DashboardProjectLike } from "@/features/independent-dashboard/model";
import { getProjectCompletion } from "@/features/independent-dashboard/model";
import { EmptyState, LoadingBars } from "@/shared/ui/feedback";
import { Cluster, Stack, Surface } from "@/shared/ui/primitives";
import { StatusBadge } from "@/shared/ui/data-display";

export type ProjectMomentumBoardProps = {
  projects: DashboardProjectLike[];
  isLoading?: boolean;
  projectHref: (id: number) => string;
  onPlanWithAI?: () => void;
};

export function ProjectMomentumBoard({ projects, isLoading, projectHref, onPlanWithAI }: ProjectMomentumBoardProps) {
  return (
    <Surface padding="lg">
      <Stack gap="lg">
        <Cluster justify="between" align="start">
          <Stack gap="xs">
            <StatusBadge tone="info"><ListTodo className="mr-1 size-3" />Project momentum</StatusBadge>
            <h2 className="font-semibold text-xl tracking-[-0.03em]">Workstreams moving now</h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">A fast premium read on active project surfaces and completion signal.</p>
          </Stack>
        </Cluster>

        {isLoading ? <LoadingBars /> : null}

        {!isLoading && projects.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No active projects yet"
            description="Create a project or ask the AI operating system to turn a goal into a delivery plan."
            action={
              <button type="button" onClick={onPlanWithAI} className="rounded-full bg-violet-600 px-4 py-2 font-medium text-sm text-white shadow-[var(--ifx-shadow-ai)]">
                Plan with AI
              </button>
            }
          />
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((project) => {
              const completion = getProjectCompletion(project);
              const tone = completion >= 80 ? "success" : completion >= 45 ? "warning" : "neutral";
              return (
                <Link
                  key={project.id}
                  to={projectHref(project.id)}
                  className="group block rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-4 transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:bg-[color:var(--ifx-surface-raised)] hover:shadow-[var(--ifx-shadow-md)]"
                >
                  <Cluster justify="between" className="flex-nowrap">
                    <Cluster gap="sm" className="min-w-0 flex-nowrap">
                      <div className="grid size-11 place-items-center rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] text-lg">
                        {project.icon ?? <ListTodo className="size-5 text-[color:var(--ifx-text-secondary)]" />}
                      </div>
                      <Stack gap="xs" className="min-w-0">
                        <div className="truncate font-semibold tracking-[-0.02em]">{project.name}</div>
                        <div className="text-[color:var(--ifx-text-secondary)] text-xs">{project.task_summary?.completed ?? 0}/{project.task_summary?.total ?? 0} tasks complete</div>
                      </Stack>
                    </Cluster>
                    <Cluster gap="xs" className="shrink-0">
                      {project.is_favorited ? <Star className="size-4 fill-amber-400 text-amber-400" /> : null}
                      <StatusBadge tone={tone}>{completion}%</StatusBadge>
                      <ArrowRight className="size-4 text-[color:var(--ifx-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--ifx-text-primary)]" />
                    </Cluster>
                  </Cluster>
                </Link>
              );
            })}
          </div>
        ) : null}
      </Stack>
    </Surface>
  );
}
