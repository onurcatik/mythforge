import { Link, Navigate, useParams } from "@tanstack/react-router";
import { Loader2, SearchX, Settings } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Markdown } from "@/components/Markdown";
import { StatusMessage } from "@/components/StatusMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useGuilds } from "@/hooks/useGuilds";
import {
  canCreate,
  isFeatureEnabled,
  useMyInitiativePermissions,
} from "@/hooks/useInitiativeRoles";
import { useInitiatives } from "@/hooks/useInitiatives";
import { getRoleLabel, useRoleLabels } from "@/hooks/useRoleLabels";
import { InitiativeColorDot } from "@/lib/initiativeColors";

import { DocumentsView } from "./DocumentsPage";
import { CounterGroupsView } from "./initiativeTools/counters/CounterGroupsPage";
import { EventsView } from "./initiativeTools/events/EventsPage";
import { QueuesView } from "./initiativeTools/queues/QueuesPage";
import { ProjectsView } from "./ProjectsPage";

export const initiativeDetailPage = () => {
  const { initiativeId: initiativeIdParam } = useParams({ strict: false }) as {
    initiativeId: string;
  };
  const parsedInitiativeId = Number(initiativeIdParam);
  const hasValidInitiativeId = Number.isFinite(parsedInitiativeId);
  const initiativeId = hasValidInitiativeId ? parsedInitiativeId : 0;
  const { t } = useTranslation(["initiatives", "common"]);
  const { user } = useAuth();
  const { activeGuild } = useGuilds();
  const { data: roleLabels } = useRoleLabels();
  const projectManagerLabel = getRoleLabel("project_manager", roleLabels);
  const memberLabel = getRoleLabel("member", roleLabels);
  const guildAdminLabel = getRoleLabel("admin", roleLabels);

  // Fetch user's permissions for this Initiative
  const { data: permissions, isLoading: permissionsLoading } =
    useMyInitiativePermissions(hasValidInitiativeId ? initiativeId : null);

  const initiativesQuery = useInitiatives({ enabled: hasValidInitiativeId });

  const Initiative =
    hasValidInitiativeId && initiativesQuery.data
      ? (initiativesQuery.data.find((item) => item.id === initiativeId) ?? null)
      : null;
  const isGuildAdmin = activeGuild?.role === "admin";
  const membership =
    Initiative?.members.find((member) => member.user.id === user?.id) ?? null;
  const isinitiativeManager =
    membership?.is_manager || membership?.role === "project_manager";
  const canManageinitiative = Boolean(isGuildAdmin || isinitiativeManager);

  // Determine which features are enabled for this user
  const docsEnabled = isFeatureEnabled(permissions, "docs");
  const projectsEnabled = isFeatureEnabled(permissions, "projects");
  const queuesEnabled = isFeatureEnabled(permissions, "queues");
  const eventsEnabled = isFeatureEnabled(permissions, "events");
  const countersEnabled = isFeatureEnabled(permissions, "counters");
  const canCreateDocs = canCreate(permissions, "docs");
  const canCreateProjects = canCreate(permissions, "projects");
  const canCreateQueues = canCreate(permissions, "queues");
  const canCreateEvents = canCreate(permissions, "events");
  const canCreateCounters = canCreate(permissions, "counters");

  type TabValue = "documents" | "projects" | "queues" | "calendar" | "counters";

  const availableTabs = useMemo<TabValue[]>(() => {
    const tabs: TabValue[] = [];
    if (docsEnabled) tabs.push("documents");
    if (projectsEnabled) tabs.push("projects");
    if (eventsEnabled) tabs.push("calendar");
    if (queuesEnabled) tabs.push("queues");
    if (countersEnabled) tabs.push("counters");
    return tabs;
  }, [
    docsEnabled,
    projectsEnabled,
    queuesEnabled,
    eventsEnabled,
    countersEnabled,
  ]);

  const [activeTab, setActiveTab] = useState<TabValue>(
    availableTabs[0] ?? "documents",
  );

  // Update active tab if current tab becomes unavailable
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  const memberCount = Initiative?.members.length ?? 0;

  const roleBadgeLabel = permissions?.role_display_name
    ? permissions.role_display_name
    : membership
      ? membership.role === "project_manager"
        ? projectManagerLabel
        : memberLabel
      : isGuildAdmin
        ? guildAdminLabel
        : null;

  if (!hasValidInitiativeId) {
    return <Navigate to="/initiatives" replace />;
  }

  if (initiativesQuery.isLoading || permissionsLoading || !initiativesQuery.data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("detail.loadinginitiative")}
      </div>
    );
  }

  if (!Initiative) {
    return (
      <StatusMessage
        icon={<SearchX />}
        title={t("detail.notFound")}
        description={t("detail.notFoundDescription")}
        backTo="/initiatives"
        backLabel={t("detail.backToinitiatives")}
      />
    );
  }

  // If user has no access to any features, show a message
  if (availableTabs.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="link" size="sm" asChild className="px-0">
          <Link to="/initiatives">{t("detail.backToinitiatives")}</Link>
        </Button>
        <div className="rounded-lg border p-6">
          <div className="flex flex-wrap items-center gap-3">
            <InitiativeColorDot color={Initiative.color} className="h-4 w-4" />
            <h1 className="font-semibold text-3xl tracking-tight">
              {Initiative.name}
            </h1>
          </div>
          <p className="mt-4 text-muted-foreground">{t("detail.noAccess")}</p>
        </div>
      </div>
    );
  }

  // Local Suspense fallback for tab content — keeps the spinner below the tabs
  // while a lazily-loaded i18n namespace (queues/events/counters) resolves,
  // instead of letting the suspension bubble up to a full-page fallback.
  const tabFallback = (
    <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("common:loading")}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-4">
          <Button variant="link" size="sm" asChild className="px-0">
            <Link to="/initiatives">{t("detail.backToinitiatives")}</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <InitiativeColorDot color={Initiative.color} className="h-4 w-4" />
            <h1 className="font-semibold text-3xl tracking-tight">
              {Initiative.name}
            </h1>
            {Initiative.is_default ? (
              <Badge variant="outline">{t("detail.default")}</Badge>
            ) : null}
            {roleBadgeLabel ? (
              <Badge variant="secondary">{roleBadgeLabel}</Badge>
            ) : null}
          </div>
          {Initiative.description ? (
            <Markdown
              content={Initiative.description}
              className="text-muted-foreground"
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("noDescription")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            <span>{t("detail.member", { count: memberCount })}</span>
            <span>
              {t("detail.updated", {
                date: new Date(Initiative.updated_at).toLocaleDateString(),
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageinitiative ? (
            <Button variant="outline" asChild>
              <Link
                to="/initiatives/$initiativeId/settings"
                params={{ initiativeId: String(Initiative.id) }}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("detail.initiativeSettings")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
      >
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max">
            {docsEnabled && (
              <TabsTrigger value="documents">
                {t("detail.documents")}
              </TabsTrigger>
            )}
            {projectsEnabled && (
              <TabsTrigger value="projects">{t("detail.projects")}</TabsTrigger>
            )}
            {eventsEnabled && (
              <TabsTrigger value="calendar">{t("detail.calendar")}</TabsTrigger>
            )}
            {queuesEnabled && (
              <TabsTrigger value="queues">{t("detail.queues")}</TabsTrigger>
            )}
            {countersEnabled && (
              <TabsTrigger value="counters">{t("detail.counters")}</TabsTrigger>
            )}
          </TabsList>
        </div>
        {docsEnabled && (
          <TabsContent value="documents" className="mt-6">
            <Suspense fallback={tabFallback}>
              <DocumentsView
                key={`documents-${Initiative.id}`}
                fixedinitiativeId={Initiative.id}
                canCreate={canCreateDocs}
              />
            </Suspense>
          </TabsContent>
        )}
        {projectsEnabled && (
          <TabsContent value="projects" className="mt-6">
            <Suspense fallback={tabFallback}>
              <ProjectsView
                key={`projects-${Initiative.id}`}
                fixedinitiativeId={Initiative.id}
                canCreate={canCreateProjects}
              />
            </Suspense>
          </TabsContent>
        )}
        {eventsEnabled && (
          <TabsContent value="calendar" className="mt-6">
            <Suspense fallback={tabFallback}>
              <EventsView
                key={`calendar-${Initiative.id}`}
                fixedinitiativeId={Initiative.id}
                canCreate={canCreateEvents}
              />
            </Suspense>
          </TabsContent>
        )}
        {queuesEnabled && (
          <TabsContent value="queues" className="mt-6">
            <Suspense fallback={tabFallback}>
              <QueuesView
                key={`queues-${Initiative.id}`}
                fixedinitiativeId={Initiative.id}
                canCreate={canCreateQueues}
              />
            </Suspense>
          </TabsContent>
        )}
        {countersEnabled && (
          <TabsContent value="counters" className="mt-6">
            <Suspense fallback={tabFallback}>
              <CounterGroupsView
                key={`counters-${Initiative.id}`}
                fixedinitiativeId={Initiative.id}
                canCreate={canCreateCounters}
              />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
