import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Loader2, LogOut, Plus, Settings, Ticket, UserCog } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { RecentItemRead } from "@/api/generated/initiativeAPI.schemas";
import {
  getRouteChromeContext,
  resolveWorkspaceHref,
} from "@/app/routes/routeRegistry";
import { IndependentAppShell, useShellShortcuts } from "@/app/shell";
import { evaluateShellAccess } from "@/app/guards";
import { DesignSystemProvider } from "@/app/providers";
import {
  CommandCenter,
  getOpenAICommandCenter,
} from "@/components/CommandCenter";
import {
  CreateDocumentWizard,
  getOpenCreateDocumentWizard,
} from "@/components/documents/CreateDocumentWizard";
import { GuildAccessBanner } from "@/components/guilds/GuildAccessBanner";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import { ProjectActivitySidebar } from "@/components/projects/ProjectActivitySidebar";
import { RecentTabsBar } from "@/components/recents/RecentTabsBar";
import {
  CreateTaskWizard,
  getOpenCreateTaskWizard,
} from "@/components/tasks/CreateTaskWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VersionDialog } from "@/components/VersionDialog";
import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import { useAuth } from "@/hooks/useAuth";
import { useBackButton } from "@/hooks/useBackButton";
import { useGuilds } from "@/hooks/useGuilds";
import { useLegacyFilterStorageMigration } from "@/hooks/useLegacyFilterStorageMigration";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useClearRecentView, useRecents } from "@/hooks/useRecents";
import { useServer } from "@/hooks/useServer";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { chooseNoGuildLayout } from "@/lib/noGuildLayout";
import { canAccessPlatformAdmin } from "@/lib/permissions";
import { getActiveRecentKey } from "@/lib/recentRoute";

/**
 * Loading fallback for lazy-loaded pages inside the main layout.
 */
const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Full-screen loading state shown while auth is being determined.
 */
const FullScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

export const Route = createFileRoute("/_serverRequired/_authenticated")({
  beforeLoad: ({ context, search }) => {
    const { auth, server } = context;
    const justAuthenticated =
      (search as { authenticated?: string })?.authenticated === "1";

    if (!justAuthenticated && !auth?.loading && !auth?.user) {
      const redirectTo = server?.isNativePlatform ? "/login" : "/welcome";
      throw redirect({ to: redirectTo });
    }
  },
  component: AppLayout,
});

const getRuntimeFromStorage = (activeGuildId: number | null): RuntimeHealth => {
  if (typeof window === "undefined") {
    return {
      provider: "ollama",
      mode: "local",
      label: "Local Ollama",
      isHealthy: true,
      chatModel: "llama3.1",
      embeddingModel: "nomic-embed-text",
      localOnly: true,
    };
  }

  const keys = [
    activeGuildId ? `Initiative:ai-runtime:guild:${activeGuildId}` : null,
    "Initiative:ai-runtime:user:default",
    "Initiative:ai-runtime:platform:default",
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as {
        localOnly?: boolean;
        embeddingModel?: string;
      };
      if (parsed.localOnly) {
        return {
          provider: "ollama",
          mode: "local",
          label: "Local Ollama",
          isHealthy: true,
          chatModel: "llama3.1",
          embeddingModel: parsed.embeddingModel || "nomic-embed-text",
          localOnly: true,
        };
      }
    } catch {
      // Ignore malformed local runtime profile entries; backend settings remain authoritative.
    }
  }

  return {
    provider: "openai",
    mode: "cloud",
    label: "Cloud AI",
    isHealthy: true,
    chatModel: "configured model",
    embeddingModel: "configured embedding",
    localOnly: false,
  };
};

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const { isNativePlatform } = useServer();
  const {
    activeGuildId,
    activeGuild,
    activeGuildReadOnly,
    guilds,
    loading: guildsLoading,
    canCreateGuilds,
    createGuild,
    switchGuild,
  } = useGuilds();
  const location = useLocation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { authenticated?: string };
  const justAuthenticated = search?.authenticated === "1";
  const { updateAvailable, closeDialog } = useVersionCheck();
  const openAICommandCenter = () => getOpenAICommandCenter()?.();

  useShellShortcuts({
    onOpenCommand: openAICommandCenter,
    onOpenAI: openAICommandCenter,
  });
  useRealtimeUpdates();
  usePushNotifications();
  useBackButton();
  useLegacyFilterStorageMigration();

  const recentQuery = useRecents({
    enabled: activeGuildId !== null && !loading && !!user,
    staleTime: 30_000,
  });
  const clearRecent = useClearRecentView();

  const routeContext = useMemo(
    () => getRouteChromeContext(location.pathname),
    [location.pathname],
  );
  const runtime = useMemo(
    () => getRuntimeFromStorage(activeGuildId),
    [activeGuildId],
  );

  if (loading || guildsLoading) {
    return <FullScreenLoader />;
  }

  if (!user && !justAuthenticated) {
    const redirectTo = isNativePlatform ? "/login" : "/welcome";
    return <Navigate to={redirectTo} replace />;
  }

  if (user) {
    const isPlatformAdmin = canAccessPlatformAdmin(user);
    const layout = chooseNoGuildLayout({
      hasGuilds: guilds.length > 0,
      pathname: location.pathname,
      isPlatformAdmin,
    });
    if (layout === "shell") {
      return <NoGuildSettingsShell logout={logout} />;
    }
    if (layout === "empty") {
      return (
        <NoGuildState
          canCreateGuilds={canCreateGuilds}
          createGuild={createGuild}
          logout={logout}
          isPlatformAdmin={isPlatformAdmin}
        />
      );
    }
  }

  const shellAccess = evaluateShellAccess({
    isAuthenticated: Boolean(user),
    hasWorkspace: Boolean(activeGuildId),
    isReadOnly: activeGuildReadOnly,
    pathname: location.pathname,
  });

  const handleClearRecent = (item: RecentItemRead) => {
    clearRecent.mutate({
      entityType: item.entity_type,
      entityId: item.entity_id,
    });
  };

  const activeRecentKey = getActiveRecentKey(location.pathname);
  const activeProjectId =
    activeRecentKey?.entityType === "project" ? activeRecentKey.entityId : null;

  const navigateTo = (href: string) => {
    if (href === "ai-command" || href === "#command") {
      getOpenAICommandCenter()?.();
      return;
    }
    const resolved = resolveWorkspaceHref(activeGuildId, href);
    void navigate({ to: resolved as never });
  };

  const handlePrimaryAction = (
    intent?: "ai-command" | "create-task" | "create-document",
  ) => {
    if (intent === "create-task") {
      getOpenCreateTaskWizard()?.();
      return;
    }
    if (intent === "create-document") {
      getOpenCreateDocumentWizard()?.();
      return;
    }
    getOpenAICommandCenter()?.();
  };

  const handleCreateWorkspace = () => {
    void navigate({ to: "/settings" as never });
  };

  return (
    <DesignSystemProvider density="comfortable" brand="linear">
      <CommandCenter />
      <CreateTaskWizard />
      <CreateDocumentWizard />
      <PushPermissionPrompt />
      <IndependentAppShell
        activeNavigationId={routeContext.activeId}
        routeContext={routeContext}
        workspaceName={activeGuild?.name ?? "Mythforge workspace"}
        runtime={runtime}
        guilds={guilds}
        activeGuildId={activeGuildId}
        workspaceReadOnly={Boolean(shellAccess.readOnlyReason)}
        canCreateWorkspace={canCreateGuilds}
        onNavigate={navigateTo}
        onSwitchGuild={(guildId) => void switchGuild(guildId)}
        onCreateWorkspace={handleCreateWorkspace}
        onOpenCommand={openAICommandCenter}
        onPrimaryAction={handlePrimaryAction}
        recentTabs={
          <RecentTabsBar
            items={recentQuery.data}
            loading={recentQuery.isLoading}
            activeKey={activeRecentKey}
            onClose={handleClearRecent}
          />
        }
        rightRail={<ProjectActivitySidebar projectId={activeProjectId} />}
      >
        <GuildAccessBanner />
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </IndependentAppShell>
      <VersionDialog
        mode="update"
        open={updateAvailable.show}
        currentVersion={updateAvailable.version}
        newVersion={updateAvailable.version}
        onClose={closeDialog}
      />
    </DesignSystemProvider>
  );
}

function NoGuildState({
  canCreateGuilds,
  createGuild,
  logout,
  isPlatformAdmin,
}: {
  canCreateGuilds: boolean;
  createGuild: (input: {
    name: string;
    description?: string;
  }) => Promise<unknown>;
  logout: () => void;
  isPlatformAdmin: boolean;
}) {
  const { t } = useTranslation("guilds");
  const [guildName, setGuildName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const trimmed = guildName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createGuild({ name: trimmed });
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        <h1 className="font-bold text-2xl">{t("noGuild.title")}</h1>
        <p className="text-muted-foreground">{t("noGuild.description")}</p>

        {canCreateGuilds && (
          <div className="flex gap-2">
            <Input
              placeholder={t("noGuild.guildNamePlaceholder")}
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !guildName.trim()}
            >
              <Plus className="h-4 w-4" />
              {t("noGuild.create")}
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder={t("noGuild.inviteCodePlaceholder")}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <Button variant="outline" asChild disabled={!inviteCode.trim()}>
            <Link
              to="/invite/$code"
              params={{ code: inviteCode.trim() }}
              disabled={!inviteCode.trim()}
            >
              <Ticket className="h-4 w-4" />
              {t("noGuild.redeem")}
            </Link>
          </Button>
        </div>

        {/* Direct entry points to the user/platform settings pages so a
            user with no memberships can still manage their account
            (e.g. delete it) or, for platform admins, system-wide
            configuration. Without these the only paths off this screen
            are create/join/logout. */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" asChild>
            <Link to="/profile">
              <UserCog className="h-4 w-4" />
              {t("noGuild.accountSettings")}
            </Link>
          </Button>
          {isPlatformAdmin && (
            <Button variant="outline" asChild>
              <Link to="/settings/admin">
                <Settings className="h-4 w-4" />
                {t("noGuild.platformSettings")}
              </Link>
            </Button>
          )}
        </div>

        <Button variant="ghost" onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t("noGuild.logOut")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Minimal layout shown when the user has zero guild memberships but
 * is on a route that doesn't need guild context (``/profile/*``,
 * ``/settings/admin/*``). Renders the matched outlet inside a
 * narrow container with just enough chrome (Back-to-start + logout)
 * to navigate away.
 */
function NoGuildSettingsShell({ logout }: { logout: () => void }) {
  const { t } = useTranslation("guilds");
  return (
    <div className="flex min-h-screen flex-col enterprise-canvas">
      <div
        className="premium-topbar sticky top-0 z-50 flex flex-col border-b backdrop-blur supports-backdrop-filter:bg-card/60"
        style={{ paddingTop: "var(--safe-area-inset-top)" }}
      >
        <div className="flex h-12 items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">{t("noGuild.shellBackToStart")}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t("noGuild.logOut")}
          </Button>
        </div>
      </div>
      <main className="mx-auto min-w-0 px-4 py-5 pb-20 md:px-8 md:py-8 md:pb-20 2xl:max-w-[1640px]">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
