import { Link } from "@tanstack/react-router";
import { Activity, Bot, MessageSquareText, ScrollText } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  type ListTasksApiV1TasksGetParams,
  TaskStatusCategory,
} from "@/api/generated/initiativeAPI.schemas";
import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { InitiativeOverview } from "@/components/dashboard/InitiativeOverview";
import { ProjectHealthList } from "@/components/dashboard/ProjectHealthList";
import { RecentCommentsList } from "@/components/dashboard/RecentCommentsList";
import { VelocityChart } from "@/components/stats/VelocityChart";
import {
  getRiskLevel,
  getTaskPressure,
  getTeamLoadLabel,
  getWorkspaceHealthScore,
  sortRecentProjects,
} from "@/features/independent-dashboard";
import { useRecentComments } from "@/hooks/useComments";
import { useGuilds } from "@/hooks/useGuilds";
import { useInitiatives } from "@/hooks/useInitiatives";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserAISettings } from "@/hooks/useAISettings";
import { useGuildPath } from "@/lib/guildUrl";
import { IndependentActivationLaunchpad } from "@/processes/onboarding";
import { StatusBadge } from "@/shared/ui/data-display";
import { PageFrame, Stack, Surface } from "@/shared/ui/primitives";
import { RuntimeReadinessLaunchCard } from "@/widgets/ai-runtime";
import {
  FrontendQualityGate,
  ResponsiveQualityChecklist,
} from "@/widgets/quality";
import {
  AIOperatingPlanPanel,
  DashboardTrustStrip,
  ExecutiveOperatingHeader,
  ExecutiveSignalGrid,
  ProjectMomentumBoard,
  RiskAndCapacityBoard,
  TodayOperatingQueue,
} from "@/widgets/dashboard";

const DASHBOARD_TASK_PARAMS: ListTasksApiV1TasksGetParams = {
  conditions: [
    {
      field: "status_category",
      op: "in_",
      value: [
        TaskStatusCategory.backlog,
        TaskStatusCategory.todo,
        TaskStatusCategory.in_progress,
      ],
    },
  ],
  sorting: [{ field: "due_date", dir: "asc" }],
  page_size: 12,
};

const RECENT_COMMENTS_PARAMS = { limit: 10 };

export function GuildDashboardPage() {
  const { t } = useTranslation("dashboard");
  const { activeGuildId, activeGuild } = useGuilds();
  const gp = useGuildPath();

  const statsQuery = useUserStats(activeGuildId);
  const projectsQuery = useProjects(undefined, {
    staleTime: 60_000,
    enabled: Boolean(activeGuild),
  });
  const initiativesQuery = useInitiatives({
    staleTime: 60_000,
    enabled: Boolean(activeGuild),
  });
  const upcomingTasksQuery = useTasks(DASHBOARD_TASK_PARAMS, {
    staleTime: 60_000,
    enabled: Boolean(activeGuild),
  });
  const recentCommentsQuery = useRecentComments(RECENT_COMMENTS_PARAMS, {
    staleTime: 60_000,
    enabled: Boolean(activeGuild),
  });
  const aiRuntimeQuery = useUserAISettings();

  const stats = statsQuery.data;
  const projects = projectsQuery.data?.items ?? [];
  const openProjects = projects.filter((project) => !project.is_archived);
  const upcomingTasks = upcomingTasksQuery.data?.items ?? [];
  const pressure = useMemo(
    () => getTaskPressure(upcomingTasks),
    [upcomingTasks],
  );
  const workspaceHealth = getWorkspaceHealthScore(stats, pressure);
  const risk = getRiskLevel(pressure.overdue, pressure.dueSoon);
  const teamLoad = getTeamLoadLabel(pressure.inProgress, pressure.total);
  const recentProjects = useMemo(
    () => sortRecentProjects(openProjects, 6),
    [openProjects],
  );

  return (
    <PageFrame className="space-y-5">
      <ExecutiveOperatingHeader
        workspaceName={activeGuild?.name ?? t("title")}
        projectHref={gp("/projects")}
        docsHref={gp("/documents")}
        healthScore={workspaceHealth}
        localMode
      />

      <DashboardTrustStrip />

      <ExecutiveSignalGrid
        completedThisWeek={stats?.tasks_completed_this_week}
        onTimeRate={stats?.on_time_rate}
        streak={stats?.streak}
        backlogTrend={stats?.backlog_trend}
        workspaceHealth={workspaceHealth}
        overdue={pressure.overdue}
        dueSoon={pressure.dueSoon}
        inProgress={pressure.inProgress}
        teamLoad={teamLoad}
        riskTone={risk.tone}
      />

      <AIOperatingPlanPanel />

      <RiskAndCapacityBoard
        overdue={pressure.overdue}
        dueSoon={pressure.dueSoon}
        inProgress={pressure.inProgress}
        openProjects={openProjects.length}
        riskLabel={risk.label}
        riskHelper={risk.helper}
        riskTone={risk.tone}
        teamLoad={teamLoad}
      />

      <RuntimeReadinessLaunchCard
        provider={
          aiRuntimeQuery.data?.effective_provider ??
          aiRuntimeQuery.data?.provider ??
          null
        }
        chatModel={
          aiRuntimeQuery.data?.effective_model ??
          aiRuntimeQuery.data?.model ??
          null
        }
        embeddingModel={
          aiRuntimeQuery.data?.effective_embedding_model ??
          aiRuntimeQuery.data?.embedding_model ??
          null
        }
        localOnly={
          aiRuntimeQuery.data?.effective_local_only ??
          aiRuntimeQuery.data?.local_only ??
          false
        }
        settingsHref="/profile/ai"
        loading={aiRuntimeQuery.isLoading}
      />

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <FrontendQualityGate />
        <ResponsiveQualityChecklist />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <TodayOperatingQueue
          tasks={upcomingTasks}
          isLoading={upcomingTasksQuery.isLoading}
          taskHref={(id) => gp(`/tasks/${id}`)}
          onAskAI={() =>
            getOpenAICommandCenter()?.(
              "Bugünkü görevleri risk, deadline ve blocker etkisine göre önceliklendir.",
            )
          }
        />
        <IndependentActivationLaunchpad
          hasProjects={openProjects.length > 0}
          hasTasks={upcomingTasks.length > 0}
          localRuntimeVisible
          onRunAI={() =>
            getOpenAICommandCenter()?.(
              "Bu workspace için ilk AI operasyon komutunu çalıştır: riskleri göster ve sonraki 5 aksiyonu öner.",
            )
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ProjectMomentumBoard
          projects={recentProjects}
          isLoading={projectsQuery.isLoading}
          projectHref={(id) => gp(`/projects/${id}`)}
          onPlanWithAI={() =>
            getOpenAICommandCenter()?.(
              "Yeni bir kampanya planla ve görev kırılımı öner.",
            )
          }
        />

        <Surface padding="lg">
          <Stack gap="lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <StatusBadge tone="success">
                  <Activity className="mr-1 size-3" />
                  Velocity
                </StatusBadge>
                <h2 className="mt-3 font-semibold text-xl tracking-[-0.03em]">
                  Delivery trend
                </h2>
                <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                  Use velocity as a planning signal, not a vanity chart.
                </p>
              </div>
              <Link
                to={gp("/user-stats")}
                className="text-[color:var(--ifx-text-secondary)] text-sm hover:text-[color:var(--ifx-text-primary)]"
              >
                View stats
              </Link>
            </div>
            <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-1">
              <VelocityChart data={stats?.velocity_data ?? []} />
            </div>
          </Stack>
        </Surface>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Surface padding="lg">
          <Stack gap="lg">
            <div>
              <StatusBadge tone="info">
                <Bot className="mr-1 size-3" />
                Health list
              </StatusBadge>
              <h2 className="mt-3 font-semibold text-xl tracking-[-0.03em]">
                Project health signals
              </h2>
              <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                Existing backend data displayed inside the independent premium
                dashboard shell.
              </p>
            </div>
            <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-1">
              <ProjectHealthList
                projects={projects}
                isLoading={projectsQuery.isLoading}
              />
            </div>
          </Stack>
        </Surface>

        <Surface padding="lg">
          <Stack gap="lg">
            <div>
              <StatusBadge tone="neutral">
                <MessageSquareText className="mr-1 size-3" />
                Recent context
              </StatusBadge>
              <h2 className="mt-3 font-semibold text-xl tracking-[-0.03em]">
                Workspace conversation pulse
              </h2>
              <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                Comments and decisions that can become RAG context and agent
                planning evidence.
              </p>
            </div>
            <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-1">
              <RecentCommentsList
                comments={recentCommentsQuery.data ?? []}
                isLoading={recentCommentsQuery.isLoading}
              />
            </div>
          </Stack>
        </Surface>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Surface padding="lg">
          <Stack gap="lg">
            <div>
              <StatusBadge tone="ai">
                <ScrollText className="mr-1 size-3" />
                initiatives
              </StatusBadge>
              <h2 className="mt-3 font-semibold text-xl tracking-[-0.03em]">
                Strategic work surfaces
              </h2>
              <p className="mt-1 text-[color:var(--ifx-text-secondary)] text-sm leading-6">
                initiatives remain connected to existing backend behavior while the
                presentation layer is independent.
              </p>
            </div>
            <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-muted)] p-1">
              <InitiativeOverview
                initiatives={initiativesQuery.data ?? []}
                projects={projects}
                isLoading={initiativesQuery.isLoading}
              />
            </div>
          </Stack>
        </Surface>

        <Surface padding="lg" tone="ai">
          <Stack gap="md">
            <StatusBadge tone="ai">Marketable value</StatusBadge>
            <h2 className="font-semibold text-xl tracking-[-0.03em]">
              Why this dashboard sells better
            </h2>
            <p className="text-[color:var(--ifx-text-secondary)] text-sm leading-6">
              It makes the product thesis visible: workspace memory, agent
              planning, graph impact, smart assignment and local AI belong in
              one operating layer.
            </p>
            <button
              type="button"
              onClick={() =>
                getOpenAICommandCenter()?.(
                  "Ürünün AI proje yönetimi değer önerisini bu workspace verileriyle özetle.",
                )
              }
              className="rounded-full bg-white px-4 py-2 font-medium text-sm text-slate-950 shadow-[var(--ifx-shadow-md)] transition hover:-translate-y-0.5 dark:bg-slate-950 dark:text-white"
            >
              Generate sales narrative
            </button>
          </Stack>
        </Surface>
      </section>
    </PageFrame>
  );
}
