import { PanelLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { AccessibleErrorBoundary } from "@/shared/ui/feedback";

import type { RouteChromeContext } from "@/app/routes/routeRegistry";
import { defaultRouteContext } from "@/app/routes/routeRegistry";
import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import type { GuildEntry } from "@/hooks/useGuilds";
import {
  ContextTopBar,
  IndependentNavigation,
  MobileNavigationDrawer,
  WorkspaceSwitcher,
} from "@/widgets/navigation";
import { RuntimeStatusBadge } from "@/widgets/ai-runtime";
import { SkipLinks } from "./SkipLinks";
import { StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack } from "@/shared/ui/primitives";

type IndependentAppShellProps = {
  children: ReactNode;
  activeNavigationId?: string;
  workspaceName?: string;
  runtime?: RuntimeHealth;
  routeContext?: RouteChromeContext;
  guilds?: GuildEntry[];
  activeGuildId?: number | null;
  workspaceReadOnly?: boolean;
  canCreateWorkspace?: boolean;
  recentTabs?: ReactNode;
  rightRail?: ReactNode;
  onNavigate?: (href: string) => void;
  onSwitchGuild?: (guildId: number) => void;
  onCreateWorkspace?: () => void;
  onOpenCommand?: () => void;
  onPrimaryAction?: (
    intent?: RouteChromeContext["primaryActionIntent"],
  ) => void;
};

const defaultRuntime: RuntimeHealth = {
  provider: "ollama",
  mode: "local",
  label: "Local Ollama",
  isHealthy: true,
  chatModel: "llama3.1",
  embeddingModel: "nomic-embed-text",
  localOnly: true,
};

export function IndependentAppShell({
  children,
  activeNavigationId,
  workspaceName = "Initiative workspace",
  runtime = defaultRuntime,
  routeContext = defaultRouteContext,
  guilds = [],
  activeGuildId = null,
  workspaceReadOnly = false,
  canCreateWorkspace = false,
  recentTabs,
  rightRail,
  onNavigate,
  onSwitchGuild,
  onCreateWorkspace,
  onOpenCommand,
  onPrimaryAction,
}: IndependentAppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const activeId = activeNavigationId ?? routeContext.activeId;

  return (
    <div className="ifx-shell min-h-screen bg-[color:var(--ifx-surface-canvas)] text-[color:var(--ifx-text-primary)]">
      <SkipLinks />
      <aside
        id="ifx-navigation"
        className="ifx-sidebar fixed inset-y-0 left-0 z-30 hidden w-[20.5rem] border-[color:var(--ifx-border-subtle)] border-r bg-[color:var(--ifx-surface-glass)] p-4 backdrop-blur-xl lg:block"
      >
        <Stack gap="lg" className="h-full">
          <Cluster justify="between" className="px-1">
            <Cluster gap="sm" className="min-w-0 flex-nowrap">
              <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-[var(--ifx-shadow-ai)]">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-sm tracking-[-0.02em]">
                  Mythforge AI
                </div>
                <div className="truncate text-[color:var(--ifx-text-tertiary)] text-xs">
                  {workspaceName}
                </div>
              </div>
            </Cluster>
            <button
              type="button"
              className="rounded-xl p-2 text-[color:var(--ifx-text-secondary)] hover:bg-[color:var(--ifx-surface-muted)]"
              aria-label="Collapse navigation"
            >
              <PanelLeft className="size-4" />
            </button>
          </Cluster>

          <WorkspaceSwitcher
            guilds={guilds}
            activeGuildId={activeGuildId}
            readOnly={workspaceReadOnly}
            canCreate={canCreateWorkspace}
            onSwitch={onSwitchGuild}
            onCreate={onCreateWorkspace}
          />

          <IndependentNavigation activeId={activeId} onNavigate={onNavigate} />

          <div className="mt-auto space-y-3">
            <div className="rounded-[var(--ifx-radius-xl)] border border-violet-500/20 bg-violet-500/10 p-3">
              <Stack gap="sm">
                <Cluster gap="sm">
                  <StatusBadge tone="ai">AI-first</StatusBadge>
                  <StatusBadge tone={workspaceReadOnly ? "warning" : "success"}>
                    {workspaceReadOnly ? "Read-only" : "Writable"}
                  </StatusBadge>
                </Cluster>
                <p className="text-[color:var(--ifx-text-secondary)] text-xs leading-5">
                  New independent shell: route-aware, workspace-aware and ready
                  for AI operations.
                </p>
              </Stack>
            </div>
            <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-3">
              <RuntimeStatusBadge runtime={runtime} />
            </div>
          </div>
        </Stack>
      </aside>

      <MobileNavigationDrawer
        open={mobileNavigationOpen}
        activeId={activeId}
        runtime={runtime}
        guilds={guilds}
        activeGuildId={activeGuildId}
        readOnly={workspaceReadOnly}
        canCreate={canCreateWorkspace}
        onClose={() => setMobileNavigationOpen(false)}
        onNavigate={onNavigate}
        onSwitchGuild={onSwitchGuild}
        onCreateWorkspace={onCreateWorkspace}
      />

      <div className="lg:pl-[20.5rem]">
        <ContextTopBar
          context={routeContext}
          runtime={runtime}
          recentTabs={recentTabs}
          onOpenCommand={onOpenCommand}
          onOpenMobileNav={() => setMobileNavigationOpen(true)}
          onPrimaryAction={() =>
            onPrimaryAction?.(routeContext.primaryActionIntent)
          }
        />
        <div className="flex min-w-0">
          <main
            id="ifx-main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-8 md:py-8 2xl:px-10"
          >
            <AccessibleErrorBoundary label={routeContext.title}>
              {children}
            </AccessibleErrorBoundary>
          </main>
          {rightRail}
        </div>
      </div>
    </div>
  );
}
