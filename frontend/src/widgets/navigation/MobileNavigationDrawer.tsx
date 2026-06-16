import { X } from "lucide-react";

import type { RuntimeHealth } from "@/entities/ai-runtime/model";
import type { GuildEntry } from "@/hooks/useGuilds";
import { RuntimeStatusBadge } from "@/widgets/ai-runtime";
import { WorkspaceSwitcher } from "@/widgets/navigation/WorkspaceSwitcher";
import { IndependentNavigation } from "@/widgets/navigation/IndependentNavigation";
import { Stack } from "@/shared/ui/primitives";

type MobileNavigationDrawerProps = {
  open: boolean;
  activeId: string;
  runtime: RuntimeHealth;
  guilds: GuildEntry[];
  activeGuildId: number | null;
  readOnly?: boolean;
  canCreate?: boolean;
  onClose: () => void;
  onNavigate?: (href: string) => void;
  onSwitchGuild?: (guildId: number) => void;
  onCreateWorkspace?: () => void;
};

export function MobileNavigationDrawer({
  open,
  activeId,
  runtime,
  guilds,
  activeGuildId,
  readOnly,
  canCreate,
  onClose,
  onNavigate,
  onSwitchGuild,
  onCreateWorkspace,
}: MobileNavigationDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close navigation"
      />
      <aside className="absolute inset-y-0 left-0 w-[min(24rem,92vw)] overflow-y-auto border-[color:var(--ifx-border-subtle)] border-r bg-[color:var(--ifx-surface-overlay)] p-4 shadow-[var(--ifx-shadow-lg)]">
        <Stack gap="lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm tracking-[-0.02em]">
                Mythforge AI
              </div>
              <div className="text-[color:var(--ifx-text-tertiary)] text-xs">
                Mobile operation shell
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[color:var(--ifx-border-subtle)] p-2"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          </div>
          <WorkspaceSwitcher
            guilds={guilds}
            activeGuildId={activeGuildId}
            readOnly={readOnly}
            canCreate={canCreate}
            onSwitch={onSwitchGuild}
            onCreate={onCreateWorkspace}
          />
          <IndependentNavigation
            activeId={activeId}
            onNavigate={(href) => {
              onNavigate?.(href);
              onClose();
            }}
          />
          <div className="rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-3">
            <RuntimeStatusBadge runtime={runtime} />
          </div>
        </Stack>
      </aside>
    </div>
  );
}
