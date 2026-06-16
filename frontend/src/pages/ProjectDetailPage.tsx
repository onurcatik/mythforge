import { Link, useParams, useRouter, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  Bot,
  Network,
  SearchX,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  invalidateAllTasks,
  invalidateProject,
  invalidateProjectTaskStatuses,
} from "@/api/query-keys";
import { getOpenAICommandCenter } from "@/components/CommandCenter";
import { GhostButtonLink, PremiumPage } from "@/components/design-system";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ProjectDocumentsSection } from "@/components/projects/ProjectDocumentsSection";
import { ProjectOverviewCard } from "@/components/projects/ProjectOverviewCard";
import { ProjectTasksSection } from "@/components/projects/ProjectTasksSection";
import { WorkGraphImpactDialog } from "@/components/work-graph/WorkGraphImpactDialog";
import { WorkGraphProjectPanel } from "@/components/work-graph/WorkGraphProjectPanel";
import { ProjectOperatingCockpit } from "@/widgets/work-core";
import {
  AssignmentDecisionPanel,
  WorkGraphControlTower,
} from "@/widgets/work-intelligence";
import { StatusMessage } from "@/components/StatusMessage";
import { clearLastUsedProject } from "@/components/tasks/CreateTaskWizard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProject, useProjectTaskStatuses } from "@/hooks/useProjects";
import { useRecordRecentView } from "@/hooks/useRecents";
import { useUsers } from "@/hooks/useUsers";
import { getHttpStatus } from "@/lib/errorMessage";
import { useGuildPath } from "@/lib/guildUrl";
import { Capability, hasCapability } from "@/lib/permissions";

export const ProjectDetailPage = () => {
  const { t } = useTranslation("projects");
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const router = useRouter();
  const { user } = useAuth();
  const gp = useGuildPath();
  const searchParams = useSearch({ strict: false }) as { create?: string };
  const parsedProjectId = Number(projectId);
  const [workGraphOpen, setWorkGraphOpen] = useState(false);

  // Clear ?create from URL when the task composer closes
  const handleComposerOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && searchParams.create) {
        void router.navigate({
          to: ".",
          search: {},
          replace: true,
        });
      }
    },
    [searchParams.create, router],
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      invalidateProject(parsedProjectId),
      invalidateAllTasks(),
      invalidateProjectTaskStatuses(parsedProjectId),
    ]);
  }, [parsedProjectId]);

  const projectQuery = useProject(
    Number.isFinite(parsedProjectId) ? parsedProjectId : null,
  );

  // Tasks query is now inside ProjectTasksSection to support server-side filtering

  const taskStatusesQuery = useProjectTaskStatuses(
    Number.isFinite(parsedProjectId) ? parsedProjectId : null,
  );

  const usersQuery = useUsers();

  const recordViewMutation = useRecordRecentView("project");
  const viewedProjectId = projectQuery.data?.id;
  useEffect(() => {
    if (!viewedProjectId) {
      return;
    }
    recordViewMutation.mutate(viewedProjectId);
  }, [viewedProjectId, recordViewMutation.mutate]);

  // Pure DAC: only users with write access (owner or write level) can be assigned tasks
  // Includes both explicit user permissions and role-based permissions
  const userOptions = useMemo(() => {
    const project = projectQuery.data;
    const allUsers = usersQuery.data ?? [];
    if (!project) {
      return allUsers.map((item) => ({
        id: item.id,
        label: item.full_name ?? item.email,
      }));
    }

    const allowed = new Set<number>();
    // Explicit user permissions
    project?.permissions?.forEach((permission) => {
      if (permission.level === "owner" || permission.level === "write") {
        allowed.add(permission.user_id);
      }
    });

    // Role-based permissions: find roles with write access,
    // then include Initiative members with those roles
    const writeRoleIds = new Set(
      project.role_permissions
        ?.filter((rp) => rp.level === "write")
        .map((rp) => rp.initiative_role_id) ?? [],
    );
    if (writeRoleIds.size > 0) {
      project.initiative?.members?.forEach((member) => {
        if (member.role_id && writeRoleIds.has(member.role_id)) {
          allowed.add(member.user.id);
        }
      });
    }

    return allUsers
      .filter((item) => allowed.has(item.id))
      .map((item) => ({
        id: item.id,
        label: item.full_name ?? item.email,
      }));
  }, [usersQuery.data, projectQuery.data]);

  const project = projectQuery.data;
  const projectName = project?.name;
  useEffect(() => {
    if (typeof document === "undefined" || !projectName) {
      return;
    }
    const previousTitle = document.title || "Mythforge";
    document.title = `${projectName} - Mythforge`;
    return () => {
      document.title = previousTitle;
    };
  }, [projectName]);

  if (!Number.isFinite(parsedProjectId)) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{t("detail.invalidProjectId")}</p>
        <Button asChild variant="link" className="px-0">
          <Link to={gp("/projects")}>{t("detail.backToProjects")}</Link>
        </Button>
      </div>
    );
  }

  if (projectQuery.isLoading || taskStatusesQuery.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">{t("detail.loading")}</p>
    );
  }

  if (projectQuery.isError || taskStatusesQuery.isError || !project) {
    const status =
      getHttpStatus(projectQuery.error) ??
      getHttpStatus(taskStatusesQuery.error);
    const backTo = gp("/projects");
    const backLabel = t("detail.backToProjects");

    if (status === 404 || status === 403) {
      clearLastUsedProject(parsedProjectId);
    }

    if (status === 404) {
      return (
        <StatusMessage
          icon={<SearchX />}
          title={t("detail.notFound")}
          description={t("detail.notFoundDescription")}
          backTo={backTo}
          backLabel={backLabel}
        />
      );
    }
    if (status === 403) {
      return (
        <StatusMessage
          icon={<ShieldAlert />}
          title={t("detail.noAccess")}
          description={t("detail.noAccessDescription")}
          backTo={backTo}
          backLabel={backLabel}
        />
      );
    }
    return (
      <StatusMessage
        icon={<AlertCircle />}
        title={t("detail.loadError")}
        backTo={backTo}
        backLabel={backLabel}
      />
    );
  }

  const initiativeMembership = project.initiative?.members?.find(
    (member) => member.user.id === user?.id,
  );
  const isinitiativePm = initiativeMembership?.role === "project_manager";
  const myLevel = project?.my_permission_level;
  // Pure DAC: write access requires owner or write permission level
  const hasWritePermission = myLevel === "owner" || myLevel === "write";

  // Pure DAC: settings/write access based on permission level
  const canManageSettings = hasWritePermission;
  const canWriteProject = hasWritePermission;
  // Creating documents requires Initiative PM role (backend requirement)
  const canCreateDocuments =
    hasCapability(user, Capability.dataBypass) || isinitiativePm;
  const canAttachDocuments = canWriteProject;
  // Pure DAC: any permission grants view access
  const canViewTaskDetails = Boolean(project && myLevel);
  const projectIsArchived = project.is_archived ?? false;
  const canEditTaskDetails = Boolean(
    project && canWriteProject && !projectIsArchived,
  );

  const handleTaskClick = (taskId: number) => {
    if (!canViewTaskDetails) {
      return;
    }
    router.navigate({ to: gp(`/tasks/${taskId}`) });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <PremiumPage
        eyebrow={project.initiative?.name ?? "Project workspace"}
        title={
          <>
            {project.icon ? <span className="mr-2">{project.icon}</span> : null}
            {project.name}
          </>
        }
        description="A delivery cockpit for tasks, docs, Work Graph impact, blockers and AI-assisted execution decisions."
        actions={
          <>
            <Button
              className="rounded-full"
              onClick={() =>
                getOpenAICommandCenter()?.(
                  `Bu projeyi toparla: ${project.name}. Riskleri, blockerları, stale taskları ve yeniden sıralama önerilerini göster.`,
                )
              }
            >
              <Bot className="size-4" />
              AI project cleanup
            </Button>
            <GhostButtonLink onClick={() => setWorkGraphOpen(true)}>
              <Network className="size-4" />
              Impact
            </GhostButtonLink>
            {canManageSettings ? (
              <GhostButtonLink
                asChild
                aria-label={t("detail.openProjectSettings")}
              >
                <Link to={gp(`/projects/${project.id}/settings`)}>
                  <Settings className="size-4" /> {t("detail.projectSettings")}
                </Link>
              </GhostButtonLink>
            ) : null}
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/70 px-4 py-3 shadow-sm">
          <Breadcrumb>
            <BreadcrumbList>
              {project.initiative && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={gp(`/initiatives/${project.initiative.id}`)}>
                        {project.initiative.name}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{project.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="text-muted-foreground text-xs">
            Permission: {myLevel ?? "read"} ·{" "}
            {projectIsArchived ? "Archived" : "Active"}
          </div>
        </div>

        <ProjectOperatingCockpit
          project={project}
          statusCount={taskStatusesQuery.data?.length ?? 0}
          documentsCount={project.documents?.length ?? 0}
          canWriteProject={Boolean(canWriteProject)}
          canCreateDocuments={Boolean(canCreateDocuments && !projectIsArchived)}
          onCleanup={() =>
            getOpenAICommandCenter()?.(`Bu projeyi toparla: ${project.name}.`)
          }
          onReorder={() =>
            getOpenAICommandCenter()?.(
              `Bu projenin görevlerini risk ve critical path etkisine göre yeniden sırala: ${project.name}.`,
            )
          }
          onAssign={() =>
            getOpenAICommandCenter()?.(
              `Bu projedeki açık görevler için en uygun assignee önerilerini çıkar: ${project.name}.`,
            )
          }
          onDocsToPlan={() =>
            getOpenAICommandCenter()?.(
              `Bu projenin doküman ve yorumlarından uygulanabilir görev planı çıkar: ${project.name}.`,
            )
          }
          onImpact={() => setWorkGraphOpen(true)}
        />

        <WorkGraphControlTower
          projectId={project.id}
          initiativeId={project.initiative_id}
          onOpenImpact={() => setWorkGraphOpen(true)}
        />

        <AssignmentDecisionPanel projectId={project.id} />

        <div className="premium-card rounded-2xl border p-1">
          <ProjectOverviewCard
            project={project}
            projectIsArchived={projectIsArchived}
          />
        </div>
        <div className="premium-card rounded-2xl border p-1">
          <ProjectDocumentsSection
            projectId={project.id}
            initiativeId={project.initiative_id}
            documents={project.documents ?? []}
            canCreate={Boolean(canCreateDocuments && !projectIsArchived)}
            canAttach={Boolean(canAttachDocuments && !projectIsArchived)}
          />
        </div>
        <div className="premium-card rounded-2xl border p-1">
          <WorkGraphProjectPanel
            projectId={project.id}
            onOpenImpact={() => setWorkGraphOpen(true)}
          />
        </div>
        <div className="safe-readable-table premium-card rounded-2xl border p-1">
          <ProjectTasksSection
            projectId={project.id}
            initiativeId={project.initiative_id}
            taskStatuses={taskStatusesQuery.data ?? []}
            userOptions={userOptions}
            canEditTaskDetails={canEditTaskDetails}
            canWriteProject={Boolean(canWriteProject)}
            projectIsArchived={projectIsArchived}
            canViewTaskDetails={canViewTaskDetails}
            onTaskClick={handleTaskClick}
            initialComposerOpen={searchParams.create === "true"}
            onComposerOpenChange={handleComposerOpenChange}
          />
        </div>
        <WorkGraphImpactDialog
          open={workGraphOpen}
          onOpenChange={setWorkGraphOpen}
          defaultEntityType="project"
          defaultEntityId={project.id}
        />
      </PremiumPage>
    </PullToRefresh>
  );
};
