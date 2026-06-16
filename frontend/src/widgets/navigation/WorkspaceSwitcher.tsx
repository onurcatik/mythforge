import { Check, ChevronsUpDown, Lock, Plus, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import type { GuildEntry } from "@/hooks/useGuilds";
import { cn } from "@/shared/lib/cn";
import { Cluster, Stack } from "@/shared/ui/primitives";

type WorkspaceSwitcherProps = {
  guilds: GuildEntry[];
  activeGuildId: number | null;
  readOnly?: boolean;
  canCreate?: boolean;
  onSwitch?: (guildId: number) => void;
  onCreate?: () => void;
};

export function WorkspaceSwitcher({
  guilds,
  activeGuildId,
  readOnly = false,
  canCreate = false,
  onSwitch,
  onCreate,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const activeGuild = useMemo(
    () => guilds.find((guild) => guild.id === activeGuildId) ?? guilds[0] ?? null,
    [activeGuildId, guilds]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-raised)] p-3 text-left shadow-[var(--ifx-shadow-sm)] transition hover:border-violet-500/30"
      >
        <Cluster justify="between" className="flex-nowrap">
          <Cluster gap="sm" className="min-w-0 flex-nowrap">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 to-violet-700 font-semibold text-white shadow-[var(--ifx-shadow-ai)] dark:from-violet-500 dark:to-cyan-400">
              {activeGuild?.name?.slice(0, 1).toUpperCase() ?? "I"}
            </div>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-sm tracking-[-0.02em]">
                {activeGuild?.name ?? "No workspace"}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[color:var(--ifx-text-tertiary)] text-xs">
                {readOnly ? <Lock className="size-3" /> : <ShieldCheck className="size-3" />}
                {readOnly ? "Read-only grant" : "Active workspace"}
              </span>
            </span>
          </Cluster>
          <ChevronsUpDown className="size-4 shrink-0 text-[color:var(--ifx-text-tertiary)]" />
        </Cluster>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-[var(--ifx-radius-xl)] border border-[color:var(--ifx-border-subtle)] bg-[color:var(--ifx-surface-overlay)] p-2 shadow-[var(--ifx-shadow-lg)] backdrop-blur-xl">
          <Stack gap="xs">
            {guilds.map((guild) => {
              const selected = guild.id === activeGuildId;
              const isGrant = guild.accessType === "grant";
              return (
                <button
                  key={guild.id}
                  type="button"
                  onClick={() => {
                    onSwitch?.(guild.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2.5 text-left transition",
                    selected
                      ? "bg-violet-500/10 text-[color:var(--ifx-text-primary)]"
                      : "text-[color:var(--ifx-text-secondary)] hover:bg-[color:var(--ifx-surface-muted)] hover:text-[color:var(--ifx-text-primary)]"
                  )}
                >
                  <Cluster justify="between" className="flex-nowrap">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-sm">{guild.name}</span>
                      <span className="text-[color:var(--ifx-text-tertiary)] text-xs">
                        {isGrant ? "Temporary access" : guild.role ?? "Member"}
                      </span>
                    </span>
                    {selected ? <Check className="size-4 text-violet-500" /> : null}
                  </Cluster>
                </button>
              );
            })}
            {canCreate ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate?.();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-2xl border border-dashed border-[color:var(--ifx-border-subtle)] px-3 py-2.5 text-[color:var(--ifx-text-secondary)] text-sm transition hover:border-violet-500/30 hover:text-[color:var(--ifx-text-primary)]"
              >
                <Plus className="size-4" /> New workspace
              </button>
            ) : null}
          </Stack>
        </div>
      ) : null}
    </div>
  );
}
