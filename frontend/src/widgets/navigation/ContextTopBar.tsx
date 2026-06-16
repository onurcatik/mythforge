import { Bell, Bot, Command, Menu, Plus, Search, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import type { RouteChromeContext } from "@/app/routes/routeRegistry";
import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import { RuntimeStatusBadge } from "@/widgets/ai-runtime";
import { KbdHint, StatusBadge } from "@/shared/ui/data-display";
import { Cluster, Stack } from "@/shared/ui/primitives";

type ContextTopBarProps = {
  context: RouteChromeContext;
  runtime: RuntimeHealth;
  recentTabs?: ReactNode;
  onOpenCommand?: () => void;
  onOpenMobileNav?: () => void;
  onPrimaryAction?: () => void;
};

const areaTone: Record<RouteChromeContext["productArea"], "neutral" | "ai" | "success"> = {
  operate: "neutral",
  ai: "ai",
  govern: "success",
};

export function ContextTopBar({
  context,
  runtime,
  recentTabs,
  onOpenCommand,
  onOpenMobileNav,
  onPrimaryAction,
}: ContextTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-[color:var(--ifx-border-subtle)] border-b bg-[color:var(--ifx-surface-glass)]/90 backdrop-blur-xl">
      <div className="px-3 py-3 md:px-5">
        <Cluster justify="between" gap="md" className="flex-nowrap">
          <Cluster gap="sm" className="min-w-0 flex-1 flex-nowrap">
            <button
              type="button"
              onClick={onOpenMobileNav}
              className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] lg:hidden"
              aria-label="Open workspace navigation"
            >
              <Menu className="size-4" />
            </button>
            <button
              type="button"
              onClick={onOpenCommand}
              className="hidden min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-3 py-2 text-left shadow-[var(--ifx-shadow-sm)] transition hover:border-violet-500/30 md:flex md:min-w-[22rem] xl:min-w-[30rem]"
            >
              <Search className="size-4 text-[color:var(--ifx-text-tertiary)]" />
              <span className="min-w-0 flex-1 truncate text-[color:var(--ifx-text-secondary)] text-sm">
                Search entities or run an AI operation...
              </span>
              <KbdHint>⌘K</KbdHint>
            </button>
            <Stack gap="xs" className="min-w-0 md:hidden">
              <span className="truncate font-semibold text-sm">{context.title}</span>
              <span className="truncate text-[color:var(--ifx-text-tertiary)] text-xs">{context.eyebrow}</span>
            </Stack>
          </Cluster>

          <Cluster gap="sm" className="shrink-0 flex-nowrap">
            <RuntimeStatusBadge runtime={runtime} />
            <button
              type="button"
              onClick={onOpenCommand}
              className="grid size-10 place-items-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-700 shadow-[var(--ifx-shadow-sm)] transition hover:-translate-y-0.5 dark:text-violet-300"
              aria-label="Open AI Command Center"
            >
              <Bot className="size-4" />
            </button>
            <button
              type="button"
              className="hidden size-10 place-items-center rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] shadow-[var(--ifx-shadow-sm)] md:grid"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
          </Cluster>
        </Cluster>
      </div>

      <div className="hidden border-[color:var(--ifx-border-subtle)] border-t px-5 py-3 md:block">
        <Cluster justify="between" gap="lg" align="center">
          <Stack gap="xs" className="min-w-0">
            <Cluster gap="sm" className="flex-nowrap">
              <StatusBadge tone={areaTone[context.productArea]}>{context.eyebrow}</StatusBadge>
              <span className="text-[color:var(--ifx-text-tertiary)] text-xs">Independent frontend shell</span>
            </Cluster>
            <div>
              <h1 className="truncate font-semibold text-xl tracking-[-0.04em]">{context.title}</h1>
              <p className="line-clamp-1 text-[color:var(--ifx-text-secondary)] text-sm">{context.description}</p>
            </div>
          </Stack>
          <Cluster gap="sm" className="shrink-0 flex-nowrap">
            <button
              type="button"
              onClick={onOpenCommand}
              className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] px-3 py-2 font-medium text-sm shadow-[var(--ifx-shadow-sm)] transition hover:-translate-y-0.5 hover:border-violet-500/30"
            >
              <Command className="size-4" /> Command
            </button>
            {context.primaryActionLabel ? (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 font-medium text-sm text-white shadow-[var(--ifx-shadow-md)] transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
              >
                {context.primaryActionIntent === "ai-command" ? <Sparkles className="size-4" /> : <Plus className="size-4" />}
                {context.primaryActionLabel}
              </button>
            ) : null}
          </Cluster>
        </Cluster>
      </div>

      {recentTabs ? <div className="border-[color:var(--ifx-border-subtle)] border-t bg-[color:var(--ifx-surface-raised)]/55">{recentTabs}</div> : null}
    </header>
  );
}
